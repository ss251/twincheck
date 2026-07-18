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
  logToEvent,
  type ChainEvent,
  shortAddr,
  shortBytes,
  explorerTx,
  explorerAddr,
} from "./chain";

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

  const configured = Boolean(STAMP && STAMP.startsWith("0x") && STAMP.length === 42);

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
      const fromBlock = bn > 120_000n ? bn - 120_000n : 0n;

      const [commits, accepts, rejects, denieds] = await Promise.all([
        client.getLogs({ address: STAMP, event: committedEvent, fromBlock, toBlock: bn }),
        client.getLogs({ address: STAMP, event: acceptedEvent, fromBlock, toBlock: bn }),
        client.getLogs({ address: STAMP, event: rejectedEvent, fromBlock, toBlock: bn }),
        client.getLogs({ address: STAMP, event: deniedEvent, fromBlock, toBlock: bn }),
      ]);

      const merged: ChainEvent[] = [];
      for (const log of [...commits, ...accepts, ...rejects, ...denieds]) {
        const ev = logToEvent(log as any);
        if (ev) merged.push(ev);
      }
      merged.sort((x, y) => (x.blockNumber < y.blockNumber ? 1 : -1));
      setEvents(merged.slice(0, 100));
      setStats({
        committed: commits.length,
        accepted: accepts.length,
        denied: denieds.length,
        rejected: rejects.length,
      });
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
