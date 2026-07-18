import { useCallback, useEffect, useMemo, useState } from "react";
import {
  TWIN,
  MONAD_CHAIN_ID,
  client,
  twinAbi,
  watchedEvent,
  reportedEvent,
  settledEvent,
  pulseEvent,
  getAllLogsPaged,
  type PulseEvent,
  shortAddr,
  explorerTx,
  explorerAddr,
  scanAddr,
  EXPLORER,
  SCAN,
} from "./chain";
import { decodeEventLog, type Address, type Hex, type Log } from "viem";

type CardRow = {
  target: Address;
  watched: boolean;
  settled: boolean;
  scanOK: boolean;
  visionOK: boolean;
  dualOK: boolean;
  checkedAt: number;
  evidenceHash: Hex;
};

const EVENTS = [watchedEvent, reportedEvent, settledEvent, pulseEvent] as const;

function decodeAny(log: Log): PulseEvent | null {
  for (const abi of EVENTS) {
    try {
      const d = decodeEventLog({
        abi: [abi],
        data: log.data,
        topics: log.topics as [Hex, ...Hex[]],
      });
      const args = d.args as any;
      const tx = log.transactionHash as Hex;
      const blockNumber = log.blockNumber ?? 0n;
      if (d.eventName === "DualStatusPulse") {
        return {
          kind: "Pulse",
          target: args.target,
          prevScanOK: args.prevScanOK,
          prevVisionOK: args.prevVisionOK,
          scanOK: args.scanOK,
          visionOK: args.visionOK,
          dualOK: args.dualOK,
          at: Number(args.checkedAt),
          tx,
          blockNumber,
        };
      }
      if (d.eventName === "DualStatusSettled") {
        return {
          kind: "Settled",
          target: args.target,
          scanOK: args.scanOK,
          visionOK: args.visionOK,
          dualOK: args.dualOK,
          at: Number(args.checkedAt),
          tx,
          blockNumber,
        };
      }
      if (d.eventName === "Reported") {
        return {
          kind: "Reported",
          target: args.target,
          attestor: args.attestor,
          scanOK: args.scanOK,
          visionOK: args.visionOK,
          at: Number(args.at),
          tx,
          blockNumber,
        };
      }
      if (d.eventName === "Watched") {
        return {
          kind: "Watched",
          target: args.target,
          attestor: args.by,
          at: Number(args.at),
          tx,
          blockNumber,
        };
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

function Badge({ ok, label }: { ok: boolean | null; label: string }) {
  const cls =
    ok === null ? "badge badge-muted" : ok ? "badge badge-ok" : "badge badge-bad";
  return (
    <span className={cls}>
      <span className="dot" aria-hidden />
      {label}
    </span>
  );
}

export default function App() {
  const [cards, setCards] = useState<CardRow[]>([]);
  const [feed, setFeed] = useState<PulseEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attestors, setAttestors] = useState<{ a: string; b: string } | null>(
    null,
  );
  const [filter, setFilter] = useState<"all" | "dual" | "split" | "fail">("all");
  const [query, setQuery] = useState("");
  const [block, setBlock] = useState<bigint>(0n);

  const configured = TWIN !== "0x0000000000000000000000000000000000000000";

  const load = useCallback(async () => {
    if (!configured) {
      setError("Set VITE_TWINCHECK to the deployed TwinCheck address.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const code = await client.getCode({ address: TWIN });
      if (!code || code === "0x") {
        throw new Error(`No contract code at ${TWIN}`);
      }
      const [a, b, count, latest] = await Promise.all([
        client.readContract({
          address: TWIN,
          abi: twinAbi,
          functionName: "attestorA",
        }),
        client.readContract({
          address: TWIN,
          abi: twinAbi,
          functionName: "attestorB",
        }),
        client.readContract({
          address: TWIN,
          abi: twinAbi,
          functionName: "watchedCount",
        }),
        client.getBlockNumber(),
      ]);
      setAttestors({ a, b });
      setBlock(latest);

      const n = Number(count);
      const targets: Address[] = [];
      for (let i = 0; i < n; i++) {
        const t = await client.readContract({
          address: TWIN,
          abi: twinAbi,
          functionName: "watchedAt",
          args: [BigInt(i)],
        });
        targets.push(t);
      }

      const rows: CardRow[] = [];
      for (const target of targets) {
        const c = await client.readContract({
          address: TWIN,
          abi: twinAbi,
          functionName: "getCard",
          args: [target],
        });
        rows.push({
          target,
          watched: c[0],
          settled: c[1],
          scanOK: c[2],
          visionOK: c[3],
          dualOK: c[4],
          checkedAt: Number(c[5]),
          evidenceHash: c[6],
        });
      }
      setCards(rows);

      const logs = await getAllLogsPaged({
        address: TWIN,
        toBlock: latest,
        maxPages: 50,
      });
      const events: PulseEvent[] = [];
      for (const log of logs) {
        const e = decodeAny(log);
        if (e) events.push(e);
      }
      events.sort((x, y) => Number(y.blockNumber - x.blockNumber));
      setFeed(events.slice(0, 80));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [configured]);

  useEffect(() => {
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, [load]);

  const stats = useMemo(() => {
    const settled = cards.filter((c) => c.settled);
    return {
      watched: cards.length,
      settled: settled.length,
      dual: settled.filter((c) => c.dualOK).length,
      split: settled.filter((c) => c.scanOK !== c.visionOK).length,
      fail: settled.filter((c) => !c.scanOK && !c.visionOK).length,
    };
  }, [cards]);

  const filtered = useMemo(() => {
    let list = cards;
    if (filter === "dual") list = list.filter((c) => c.settled && c.dualOK);
    if (filter === "split")
      list = list.filter((c) => c.settled && c.scanOK !== c.visionOK);
    if (filter === "fail")
      list = list.filter((c) => c.settled && !c.scanOK && !c.visionOK);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((c) => c.target.toLowerCase().includes(q));
    }
    return list;
  }, [cards, filter, query]);

  return (
    <div className="page">
      <header className="hero">
        <div className="hero-top">
          <div>
            <p className="eyebrow">Monad · protocols#369</p>
            <h1>TwinCheck</h1>
            <p className="lede">
              Dual-explorer source verification for the official{" "}
              <a
                href="https://github.com/monad-crypto/protocols"
                target="_blank"
                rel="noreferrer"
              >
                monad-crypto/protocols
              </a>{" "}
              address book. Monadscan <em>and</em> MonadVision — both, or it
              fails.
            </p>
          </div>
          <button type="button" className="btn" onClick={load} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        <div className="meta-row">
          <a href={explorerAddr(TWIN)} target="_blank" rel="noreferrer">
            Contract {shortAddr(TWIN)}
          </a>
          <span className="sep">·</span>
          <span>chain {MONAD_CHAIN_ID}</span>
          <span className="sep">·</span>
          <span>block {block.toString()}</span>
          {attestors && (
            <>
              <span className="sep">·</span>
              <span>
                A {shortAddr(attestors.a)} / B {shortAddr(attestors.b)}
              </span>
            </>
          )}
        </div>

        <div className="stats">
          <div className="stat">
            <span className="stat-n">{stats.watched}</span>
            <span className="stat-l">watched</span>
          </div>
          <div className="stat">
            <span className="stat-n">{stats.settled}</span>
            <span className="stat-l">settled</span>
          </div>
          <div className="stat ok">
            <span className="stat-n">{stats.dual}</span>
            <span className="stat-l">dual OK</span>
          </div>
          <div className="stat warn">
            <span className="stat-n">{stats.split}</span>
            <span className="stat-l">split</span>
          </div>
          <div className="stat bad">
            <span className="stat-n">{stats.fail}</span>
            <span className="stat-l">both fail</span>
          </div>
        </div>
      </header>

      {error && <div className="banner error">{error}</div>}

      <section className="panel">
        <div className="panel-head">
          <h2>Dual-verify cards</h2>
          <div className="controls">
            <input
              className="input"
              placeholder="Filter address…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="chips">
              {(
                [
                  ["all", "All"],
                  ["dual", "Dual OK"],
                  ["split", "Split"],
                  ["fail", "Both fail"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  className={filter === k ? "chip on" : "chip"}
                  onClick={() => setFilter(k)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading && cards.length === 0 ? (
          <p className="muted">Loading cards from chain…</p>
        ) : filtered.length === 0 ? (
          <p className="muted">
            No cards yet. Run{" "}
            <code>bun run src/index.ts run --limit 5</code> in <code>cli/</code>.
          </p>
        ) : (
          <div className="card-grid">
            {filtered.map((c) => (
              <article
                key={c.target}
                className={
                  !c.settled
                    ? "card"
                    : c.dualOK
                      ? "card card-ok"
                      : c.scanOK !== c.visionOK
                        ? "card card-split"
                        : "card card-bad"
                }
              >
                <div className="card-addr">
                  <a href={explorerAddr(c.target)} target="_blank" rel="noreferrer">
                    {shortAddr(c.target)}
                  </a>
                  <code className="full">{c.target}</code>
                </div>
                <div className="badges">
                  <Badge
                    ok={c.settled ? c.scanOK : null}
                    label="Monadscan"
                  />
                  <Badge
                    ok={c.settled ? c.visionOK : null}
                    label="MonadVision"
                  />
                  <Badge
                    ok={c.settled ? c.dualOK : null}
                    label={c.settled ? (c.dualOK ? "dual OK" : "not dual") : "pending"}
                  />
                </div>
                <div className="card-foot">
                  <span>
                    {c.settled
                      ? `settled · ${new Date(c.checkedAt * 1000).toISOString()}`
                      : "awaiting dual attestors"}
                  </span>
                  <span className="links">
                    <a href={scanAddr(c.target)} target="_blank" rel="noreferrer">
                      scan
                    </a>
                    <a href={explorerAddr(c.target)} target="_blank" rel="noreferrer">
                      vision
                    </a>
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Live pulse feed</h2>
          <p className="muted tight">
            On-chain events from TwinCheck · paged ≤100 blocks (Monad RPC limit)
          </p>
        </div>
        <ul className="feed">
          {feed.length === 0 && (
            <li className="muted">No events in recent blocks.</li>
          )}
          {feed.map((e, i) => (
            <li key={`${e.tx}-${i}`} className={`feed-item kind-${e.kind}`}>
              <span className="kind">{e.kind}</span>
              <span className="target">{shortAddr(e.target)}</span>
              {e.kind === "Pulse" && (
                <span className="detail">
                  {e.prevScanOK ? "S✓" : "S✗"}
                  {e.prevVisionOK ? "V✓" : "V✗"} → {e.scanOK ? "S✓" : "S✗"}
                  {e.visionOK ? "V✓" : "V✗"}
                  {e.dualOK ? " · dual" : ""}
                </span>
              )}
              {(e.kind === "Settled" || e.kind === "Reported") && (
                <span className="detail">
                  {e.scanOK ? "scan✓" : "scan✗"} ·{" "}
                  {e.visionOK ? "vision✓" : "vision✗"}
                  {e.dualOK != null ? (e.dualOK ? " · dual" : " · split") : ""}
                </span>
              )}
              <a className="tx" href={explorerTx(e.tx)} target="_blank" rel="noreferrer">
                tx
              </a>
            </li>
          ))}
        </ul>
      </section>

      <footer className="foot">
        <p>
          Problem:{" "}
          <a
            href="https://github.com/monad-crypto/protocols/issues/369"
            target="_blank"
            rel="noreferrer"
          >
            protocols#369
          </a>{" "}
          — automatic dual verify on Monadscan + MonadVision. Explorers:{" "}
          <a href={SCAN} target="_blank" rel="noreferrer">
            scan
          </a>{" "}
          ·{" "}
          <a href={EXPLORER} target="_blank" rel="noreferrer">
            vision
          </a>
          . Zero mocks — every card is dual-principal onchain.
        </p>
      </footer>
    </div>
  );
}
