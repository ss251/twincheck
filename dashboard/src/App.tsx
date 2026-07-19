import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type CardState = "pending" | "dual" | "split" | "fail";

function stateOf(c: CardRow): CardState {
  if (!c.settled) return "pending";
  if (c.dualOK) return "dual";
  if (c.scanOK !== c.visionOK) return "split";
  return "fail";
}

const VERDICT: Record<CardState, { word: string; cls: string }> = {
  dual: { word: "Dual OK", cls: "v-dual" },
  split: { word: "Split", cls: "v-split" },
  fail: { word: "Both fail", cls: "v-fail" },
  pending: { word: "Pending", cls: "v-pending" },
};

function fmtWhen(s: number): string {
  return new Date(s * 1000).toISOString().slice(5, 16).replace("T", " ") + " UTC";
}

function IconCheck() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12.5l4.6 4.5L19 7"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCross() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6.5 6.5l11 11M17.5 6.5l-11 11"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconDot() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3.2" fill="currentColor" opacity="0.7" />
    </svg>
  );
}

function Half({
  side,
  label,
  ok,
  settled,
}: {
  side: "l" | "r";
  label: string;
  ok: boolean;
  settled: boolean;
}) {
  const st = !settled ? "h-idle" : ok ? "h-ok" : "h-no";
  return (
    <div className={`half ${side === "l" ? "hl" : "hr"} ${st}`}>
      <div className="col">
        <span className="side">{label}</span>
        <span className="mark">
          {!settled ? <IconDot /> : ok ? <IconCheck /> : <IconCross />}
        </span>
        <span className="word">
          {!settled ? "awaiting" : ok ? "verified" : "unverified"}
        </span>
      </div>
    </div>
  );
}

function TwinCard({
  c,
  index,
  flipped,
}: {
  c: CardRow;
  index: number;
  flipped: boolean;
}) {
  const state = stateOf(c);
  const v = VERDICT[state];
  return (
    <article
      className={`tcard s-${state}${flipped ? " flip" : ""}`}
      style={{ animationDelay: `${Math.min(index * 45, 360)}ms` }}
    >
      <header className="tcard-top">
        <a
          className="addr"
          href={explorerAddr(c.target)}
          target="_blank"
          rel="noreferrer"
        >
          {shortAddr(c.target)}
        </a>
        <span className={`verdict ${v.cls}`}>{v.word}</span>
      </header>
      <code className="fulladdr">{c.target}</code>
      <div
        className="twins"
        role="img"
        aria-label={
          c.settled
            ? `Monadscan ${c.scanOK ? "verified" : "not verified"}; MonadVision ${
                c.visionOK ? "verified" : "not verified"
              }`
            : "Awaiting both attestors"
        }
      >
        <div className="crack" aria-hidden />
        <Half side="l" label="Monadscan" ok={c.scanOK} settled={c.settled} />
        <Half side="r" label="MonadVision" ok={c.visionOK} settled={c.settled} />
      </div>
      <footer className="tcard-foot">
        <span>
          {c.settled ? `settled ${fmtWhen(c.checkedAt)}` : "awaiting dual attestors"}
        </span>
        <span className="links">
          <a href={scanAddr(c.target)} target="_blank" rel="noreferrer">
            scan ↗
          </a>
          <a href={explorerAddr(c.target)} target="_blank" rel="noreferrer">
            vision ↗
          </a>
        </span>
      </footer>
    </article>
  );
}

function Pair({ s, v }: { s?: boolean; v?: boolean }) {
  return (
    <span
      className="pair"
      title={`scan ${s ? "verified" : "unverified"} · vision ${v ? "verified" : "unverified"}`}
    >
      <i className={s ? "p-ok" : "p-no"} />
      <i className={v ? "p-ok" : "p-no"} />
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
  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  const prevStates = useRef<Map<string, CardState>>(new Map());

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

      // status flips are the product's heartbeat — flag them for the UI
      const prev = prevStates.current;
      const changed = new Set<string>();
      for (const r of rows) {
        const s = stateOf(r);
        const p = prev.get(r.target);
        if (p && p !== s) changed.add(r.target);
      }
      prevStates.current = new Map(rows.map((r) => [r.target, stateOf(r)]));
      if (changed.size > 0) {
        setFlipped(changed);
        setTimeout(() => setFlipped(new Set()), 1400);
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

  const unsettled = stats.watched - stats.settled;

  return (
    <div className="page">
      <header className="masthead">
        <div className="mast-top">
          <p className="eyebrow">Monad Testnet · protocols #369</p>
          <div className="live">
            <span className="live-dot" aria-hidden />
            <span>
              block{" "}
              <span className="blocknum" key={block.toString()}>
                {block.toString()}
              </span>
            </span>
            <button type="button" className="btn" onClick={load} disabled={loading}>
              {loading ? "Syncing…" : "Refresh"}
            </button>
          </div>
        </div>

        <h1 className="wordmark" data-text="TwinCheck">
          TwinCheck
        </h1>

        <p className="lede">
          One contract, two explorers. TwinCheck watches the official{" "}
          <a
            href="https://github.com/monad-crypto/protocols"
            target="_blank"
            rel="noreferrer"
          >
            monad-crypto/protocols
          </a>{" "}
          address book and settles onchain whether <strong>Monadscan</strong> and{" "}
          <strong>MonadVision</strong> agree that a contract&rsquo;s source is
          verified. Both, or it fails.
        </p>

        <div className="meta">
          <a href={explorerAddr(TWIN)} target="_blank" rel="noreferrer">
            contract {shortAddr(TWIN)}
          </a>
          <span className="sep">/</span>
          <span>chain {MONAD_CHAIN_ID}</span>
          {attestors && (
            <>
              <span className="sep">/</span>
              <span>
                attestors {shortAddr(attestors.a)} · {shortAddr(attestors.b)}
              </span>
            </>
          )}
        </div>
      </header>

      {error && <div className="banner">{error}</div>}

      <section className="scoreboard" aria-label="Agreement scoreboard">
        <div className="tally">
          <div className="t">
            <span className="t-n">{stats.watched}</span>
            <span className="t-l">Watched</span>
          </div>
          <div className="t">
            <span className="t-n">{stats.settled}</span>
            <span className="t-l">Settled</span>
          </div>
          <div className="t t-ok">
            <span className="t-n">{stats.dual}</span>
            <span className="t-l">Dual OK</span>
          </div>
          <div className={stats.split > 0 ? "t t-split" : "t t-split t-zero"}>
            <span className="t-n">{stats.split}</span>
            <span className="t-l">Split</span>
          </div>
          <div className={stats.fail > 0 ? "t t-bad" : "t t-bad t-zero"}>
            <span className="t-n">{stats.fail}</span>
            <span className="t-l">Both fail</span>
          </div>
        </div>

        {stats.watched > 0 && (
          <>
            <div className="consensus" aria-hidden>
              {stats.dual > 0 && (
                <span
                  className="cseg cseg-dual"
                  style={{ flexGrow: stats.dual }}
                  title={`${stats.dual} dual OK`}
                />
              )}
              {stats.split > 0 && (
                <span
                  className="cseg cseg-split"
                  style={{ flexGrow: stats.split }}
                  title={`${stats.split} split`}
                />
              )}
              {stats.fail > 0 && (
                <span
                  className="cseg cseg-fail"
                  style={{ flexGrow: stats.fail }}
                  title={`${stats.fail} both fail`}
                />
              )}
              {unsettled > 0 && (
                <span
                  className="cseg cseg-idle"
                  style={{ flexGrow: unsettled }}
                  title={`${unsettled} unsettled`}
                />
              )}
            </div>
            <p className="consensus-caption">
              {stats.settled} of {stats.watched} settled —{" "}
              <b className="cap-ok">{stats.dual} dual&nbsp;ok</b> ·{" "}
              <b>{stats.split} split</b> ·{" "}
              <b className="cap-bad">{stats.fail} both&nbsp;fail</b>
            </p>
          </>
        )}
      </section>

      <section aria-label="Verdicts">
        <div className="section-head">
          <h2>
            Verdicts
            <span className="count">· {filtered.length}</span>
          </h2>
          <div className="controls">
            <input
              className="input"
              placeholder="0x…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Filter by address"
            />
            <div className="chips" role="group" aria-label="Filter by verdict">
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
          <p className="empty">Reading the chain…</p>
        ) : filtered.length === 0 ? (
          <p className="empty">
            {cards.length === 0 ? (
              <>
                No contracts watched yet. Run{" "}
                <code>bun run src/index.ts run --limit 5</code> in <code>cli/</code>.
              </>
            ) : (
              "No verdicts match."
            )}
          </p>
        ) : (
          <div className="card-grid">
            {filtered.map((c, i) => (
              <TwinCard
                key={c.target}
                c={c}
                index={i}
                flipped={flipped.has(c.target)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="ledger" aria-label="Onchain pulse">
        <div className="section-head">
          <h2>Onchain pulse</h2>
          <span className="ledger-note">
            live TwinCheck events · paged ≤100 blocks (Monad RPC)
          </span>
        </div>
        <ol className="feed">
          {feed.length === 0 && (
            <li className="feed-empty">
              Quiet — no TwinCheck events in the last ~5,000 blocks. Settled
              verdicts hold above; new pulses land here when the attestors
              re-check.
            </li>
          )}
          {feed.map((e, i) => (
            <li key={`${e.tx}-${i}`} className="feed-item">
              <span
                className={
                  e.kind === "Pulse"
                    ? "kind k-pulse"
                    : e.kind === "Settled"
                      ? e.dualOK
                        ? "kind k-settled-ok"
                        : "kind k-settled-no"
                      : "kind k-quiet"
                }
              >
                {e.kind}
              </span>
              <span className="feed-target">{shortAddr(e.target)}</span>
              <span className="detail">
                {e.kind === "Pulse" && (
                  <>
                    <Pair s={e.prevScanOK} v={e.prevVisionOK} />
                    <span className="arrow">→</span>
                    <Pair s={e.scanOK} v={e.visionOK} />
                    <span className={e.dualOK ? "d-word d-ok" : "d-word d-bad"}>
                      {e.dualOK ? "dual ok" : "not dual"}
                    </span>
                  </>
                )}
                {e.kind === "Settled" && (
                  <>
                    <Pair s={e.scanOK} v={e.visionOK} />
                    <span className={e.dualOK ? "d-word d-ok" : "d-word d-bad"}>
                      {e.dualOK
                        ? "dual ok"
                        : e.scanOK !== e.visionOK
                          ? "split"
                          : "both fail"}
                    </span>
                  </>
                )}
                {e.kind === "Reported" && (
                  <>
                    <Pair s={e.scanOK} v={e.visionOK} />
                    {e.attestor && (
                      <span className="d-word">by {shortAddr(e.attestor)}</span>
                    )}
                  </>
                )}
                {e.kind === "Watched" && (
                  <span className="d-word">added to the watch-list</span>
                )}
              </span>
              <a
                className="tx"
                href={explorerTx(e.tx)}
                target="_blank"
                rel="noreferrer"
              >
                tx ↗
              </a>
            </li>
          ))}
        </ol>
      </section>

      <footer className="foot">
        <p>
          Built for{" "}
          <a
            href="https://github.com/monad-crypto/protocols/issues/369"
            target="_blank"
            rel="noreferrer"
          >
            protocols#369
          </a>{" "}
          — automated dual source-verification across{" "}
          <a href={SCAN} target="_blank" rel="noreferrer">
            Monadscan
          </a>{" "}
          and{" "}
          <a href={EXPLORER} target="_blank" rel="noreferrer">
            MonadVision
          </a>
          . Every verdict is settled by two independent attestors, onchain. Zero
          mocks.
        </p>
      </footer>
    </div>
  );
}
