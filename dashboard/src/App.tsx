import { useCallback, useEffect, useState } from "react";
import {
  STAMP,
  MONAD_CHAIN_ID,
  MONAD_RPC,
  client,
  committedEvent,
  acceptedEvent,
  rejectedEvent,
  deniedEvent,
  getAllLogsPaged,
  type ChainEvent,
  shortAddr,
  shortBytes,
  explorerTx,
  explorerAddr,
} from "./chain";
import { type Log, decodeEventLog, getEventSelector, type Hex } from "viem";

const EVENT_BY_NAME = {
  Committed: committedEvent,
  Accepted: acceptedEvent,
  Rejected: rejectedEvent,
  Denied: deniedEvent,
} as const;

function decodeLog(log: Log, eventName: keyof typeof EVENT_BY_NAME): ChainEvent | null {
  try {
    const decoded = decodeEventLog({
      abi: [EVENT_BY_NAME[eventName]],
      data: log.data,
      topics: log.topics as [Hex, ...Hex[]],
    });
    const args = decoded.args as any;
    const tx = log.transactionHash as Hex;
    const blockNumber = log.blockNumber ?? 0n;
    if (eventName === "Committed") {
      return {
        kind: "Committed",
        taskId: args.taskId,
        worker: args.worker,
        evidenceHash: args.evidenceHash,
        gatePass: args.gatePass,
        tx,
        blockNumber,
      };
    }
    if (eventName === "Accepted") {
      return {
        kind: "Accepted",
        taskId: args.taskId,
        accepter: args.accepter,
        evidenceHash: args.evidenceHash,
        tx,
        blockNumber,
      };
    }
    if (eventName === "Rejected") {
      return {
        kind: "Rejected",
        taskId: args.taskId,
        accepter: args.accepter,
        reason: args.reason,
        tx,
        blockNumber,
      };
    }
    return {
      kind: "Denied",
      taskId: args.taskId,
      caller: args.caller,
      providedHash: args.providedHash,
      expectedHash: args.expectedHash,
      tx,
      blockNumber,
    };
  } catch {
    return null;
  }
}

export function App() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<ChainEvent[]>([]);
  const [block, setBlock] = useState<bigint | null>(null);
  const [stats, setStats] = useState({
    committed: 0,
    accepted: 0,
    denied: 0,
    rejected: 0,
  });

  const configured = Boolean(
    STAMP && /^0x[0-9a-fA-F]{40}$/.test(STAMP.trim()),
  );

  const refresh = useCallback(async () => {
    if (!configured) {
      setError(
        "VITE_DONESTAMP is not set. Deploy DoneStamp, then set the address in dashboard env.",
      );
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const code = await client.getCode({ address: STAMP });
      if (!code || code === "0x") {
        throw new Error(`No contract bytecode at ${STAMP} on Monad testnet.`);
      }
      const bn = await client.getBlockNumber();
      setBlock(bn);

      // Monad public RPC: eth_getLogs limited to 100-block ranges — page ≤100 windows.
      // 20 * 100 blocks, 5 concurrent pages — stays under Monad's 100-block eth_getLogs limit
      const raw = await getAllLogsPaged({
        address: STAMP,
        toBlock: bn,
        maxPages: 20,
        concurrency: 5,
      });
      const sig = {
        Committed: getEventSelector(committedEvent),
        Accepted: getEventSelector(acceptedEvent),
        Rejected: getEventSelector(rejectedEvent),
        Denied: getEventSelector(deniedEvent),
      };

      const merged: ChainEvent[] = [];
      let committed = 0;
      let accepted = 0;
      let rejected = 0;
      let denied = 0;

      for (const log of raw) {
        const topic0 = log.topics[0];
        let eventName: keyof typeof EVENT_BY_NAME | undefined;
        if (topic0 === sig.Committed) eventName = "Committed";
        else if (topic0 === sig.Accepted) eventName = "Accepted";
        else if (topic0 === sig.Rejected) eventName = "Rejected";
        else if (topic0 === sig.Denied) eventName = "Denied";
        if (!eventName) continue;

        const decoded = decodeLog(log, eventName);
        if (!decoded) continue;
        if (eventName === "Committed") committed++;
        if (eventName === "Accepted") accepted++;
        if (eventName === "Rejected") rejected++;
        if (eventName === "Denied") denied++;
        merged.push(decoded);
      }

      merged.sort((x, y) => (x.blockNumber < y.blockNumber ? 1 : -1));
      setEvents(merged.slice(0, 100));
      setStats({ committed, accepted, denied, rejected });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [configured]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 12_000);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <div className="app">
      <header className="masthead">
        <p className="eyebrow">Monad testnet · dual-principal done receipts</p>
        <h1>DoneStamp</h1>
        <p className="lede">
          Agents claim &quot;done.&quot; That used to be vibes. Now the worker posts gate hashes
          onchain and a <em>second principal</em> must re-run and co-sign. Worker cannot forge
          the accepter. Accepter cannot backdate the commit. CodexBar tracks usage — this tracks{" "}
          <strong>completion integrity</strong>.
        </p>
        <div className="meta-row">
          <span className="pill">
            <span className={`dot ${error ? "err" : configured ? "" : "warn"}`} />
            chain {MONAD_CHAIN_ID}
          </span>
          <span className="pill">block {block?.toString() ?? "—"}</span>
          {configured ? (
            <a className="pill" href={explorerAddr(STAMP)} target="_blank" rel="noreferrer">
              stamp {shortAddr(STAMP)}
            </a>
          ) : (
            <span className="pill">stamp unset</span>
          )}
          <button className="refresh" type="button" onClick={() => void refresh()} disabled={loading}>
            {loading ? "reading…" : "refresh"}
          </button>
        </div>
      </header>

      {error && (
        <div className="banner" role="alert">
          <strong>Onchain read issue.</strong> {error}
        </div>
      )}

      <div className="grid seats">
        <div className="card">
          <h2>Committed</h2>
          <div className="sub">worker posts gate claim</div>
          <p style={{ fontFamily: "var(--font-display)", fontSize: "2.4rem", margin: "0.5rem 0" }}>
            {stats.committed}
          </p>
          <div className="principal">Principal A · worker EOA</div>
        </div>
        <div className="card">
          <h2>Accepted</h2>
          <div className="sub">second principal co-signs</div>
          <p style={{ fontFamily: "var(--font-display)", fontSize: "2.4rem", margin: "0.5rem 0" }}>
            {stats.accepted}
          </p>
          <div className="principal">Principal B · accepter EOA · isDone = true</div>
        </div>
        <div className="card">
          <h2>Denied / Rejected</h2>
          <div className="sub">loud proof failures</div>
          <p style={{ fontFamily: "var(--font-display)", fontSize: "2.4rem", margin: "0.5rem 0" }}>
            {stats.denied + stats.rejected}
          </p>
          <div className="principal">
            Denied = evidence mismatch · Rejected = explicit no
          </div>
        </div>
      </div>

      <section className="section">
        <div className="section-head">
          <h2>Event tape</h2>
          <span>Committed · Accepted · Denied · Rejected</span>
        </div>
        <div className="feed">
          {events.length === 0 ? (
            <div className="empty">
              No logs yet. Run <code>donestamp commit</code> as worker A, then{" "}
              <code>donestamp accept</code> as accepter B — or force a Denied with wrong evidence.
            </div>
          ) : (
            events.map((ev, i) => <EventRow key={`${ev.tx}-${ev.kind}-${i}`} ev={ev} />)
          )}
        </div>
      </section>

      <footer className="footer">
        <span>RPC {MONAD_RPC.replace("https://", "")} · views + logs only (no placeholders)</span>
        <span>
          {configured ? (
            <a href={explorerAddr(STAMP)} target="_blank" rel="noreferrer">
              verified source on explorer
            </a>
          ) : (
            "awaiting deploy"
          )}
        </span>
      </footer>
    </div>
  );
}

function EventRow({ ev }: { ev: ChainEvent }) {
  if (ev.kind === "Committed") {
    return (
      <div className="feed-row">
        <span className="tag spend">Committed</span>
        <div className="feed-body">
          task <code>{shortBytes(ev.taskId)}</code> · gate {ev.gatePass ? "PASS" : "FAIL"} ·
          evidence <code>{shortBytes(ev.evidenceHash)}</code>
          <br />
          worker{" "}
          <a href={explorerAddr(ev.worker)} target="_blank" rel="noreferrer">
            {shortAddr(ev.worker)}
          </a>
        </div>
        <a href={explorerTx(ev.tx)} target="_blank" rel="noreferrer">
          tx
        </a>
      </div>
    );
  }
  if (ev.kind === "Accepted") {
    return (
      <div className="feed-row">
        <span className="tag seat">Accepted</span>
        <div className="feed-body">
          task <code>{shortBytes(ev.taskId)}</code> · isDone
          <br />
          accepter{" "}
          <a href={explorerAddr(ev.accepter)} target="_blank" rel="noreferrer">
            {shortAddr(ev.accepter)}
          </a>
        </div>
        <a href={explorerTx(ev.tx)} target="_blank" rel="noreferrer">
          tx
        </a>
      </div>
    );
  }
  if (ev.kind === "Denied") {
    return (
      <div className="feed-row">
        <span className="tag denied">Denied</span>
        <div className="feed-body">
          task <code>{shortBytes(ev.taskId)}</code> · provided{" "}
          <code>{shortBytes(ev.providedHash)}</code> ≠ expected{" "}
          <code>{shortBytes(ev.expectedHash)}</code>
          <br />
          caller{" "}
          <a href={explorerAddr(ev.caller)} target="_blank" rel="noreferrer">
            {shortAddr(ev.caller)}
          </a>
        </div>
        <a href={explorerTx(ev.tx)} target="_blank" rel="noreferrer">
          tx
        </a>
      </div>
    );
  }
  return (
    <div className="feed-row">
      <span className="tag hard">Rejected</span>
      <div className="feed-body">
        task <code>{shortBytes(ev.taskId)}</code> · reason <code>{shortBytes(ev.reason)}</code>
        <br />
        accepter{" "}
        <a href={explorerAddr(ev.accepter)} target="_blank" rel="noreferrer">
          {shortAddr(ev.accepter)}
        </a>
      </div>
      <a href={explorerTx(ev.tx)} target="_blank" rel="noreferrer">
        tx
      </a>
    </div>
  );
}
