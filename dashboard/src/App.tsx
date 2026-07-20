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
  scanLogsForward,
  reconcileFeedEvents,
  comparePulseEventsNewestFirst,
  classifyPendingReports,
  loadFeedCache,
  saveFeedCache,
  DEPLOY_BLOCK,
  REORG_OVERLAP_BLOCKS,
  type PulseEvent,
  type PendingReportState,
  shortAddr,
  explorerTx,
  explorerAddr,
  scanAddr,
  EXPLORER,
  SCAN,
} from "./chain";
import { decodeEventLog, type Address, type Hex, type Log } from "viem";

type Awaiting = PendingReportState | null;

type CardRow = {
  target: Address;
  watched: boolean;
  settled: boolean;
  scanOK: boolean;
  visionOK: boolean;
  dualOK: boolean;
  checkedAt: number;
  evidenceHash: Hex;
  /** For never-settled cards: which attestor's report is still missing. */
  awaiting: Awaiting;
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
      const logIndex = Number(log.logIndex ?? 0);
      const key = `${tx}:${logIndex}`;
      if (d.eventName === "DualStatusPulse") {
        return {
          key,
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
          logIndex,
        };
      }
      if (d.eventName === "DualStatusSettled") {
        return {
          key,
          kind: "Settled",
          target: args.target,
          scanOK: args.scanOK,
          visionOK: args.visionOK,
          dualOK: args.dualOK,
          at: Number(args.checkedAt),
          tx,
          blockNumber,
          logIndex,
        };
      }
      if (d.eventName === "Reported") {
        return {
          key,
          kind: "Reported",
          target: args.target,
          attestor: args.attestor,
          scanOK: args.scanOK,
          visionOK: args.visionOK,
          at: Number(args.at),
          tx,
          blockNumber,
          logIndex,
        };
      }
      if (d.eventName === "Watched") {
        return {
          key,
          kind: "Watched",
          target: args.target,
          attestor: args.by,
          at: Number(args.at),
          tx,
          blockNumber,
          logIndex,
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

const FOUNDRY_VERIFY_DOCS =
  "https://docs.monad.xyz/guides/verify-smart-contract/foundry";
const SOURCIFY_VERIFIER = "https://sourcify.dev/#/verifier";

function awaitingText(
  c: CardRow,
  attestors: { a: string; b: string } | null,
): string {
  if (c.awaiting === "A")
    return `awaiting attestor A${attestors ? ` · ${shortAddr(attestors.a)}` : ""}`;
  if (c.awaiting === "B")
    return `awaiting attestor B${attestors ? ` · ${shortAddr(attestors.b)}` : ""}`;
  if (c.awaiting === "disagree")
    return "attestors disagree — awaiting matching re-checks";
  if (c.awaiting === "stale")
    return "matching reports missed the settlement window — re-check required";
  return "awaiting both attestors";
}

function TwinCard({
  c,
  index,
  flipped,
  attestors,
}: {
  c: CardRow;
  index: number;
  flipped: boolean;
  attestors: { a: string; b: string } | null;
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
      {state === "fail" && (
        <p className="agree-note">
          The twins agree — unverified on <em>both</em> explorers.
        </p>
      )}
      {c.settled && !c.scanOK && (
        <p className="remedy">
          Monadscan fix:{" "}
          <a href={FOUNDRY_VERIFY_DOCS} target="_blank" rel="noreferrer">
            forge verify with an Etherscan API key ↗
          </a>
        </p>
      )}
      {c.settled && !c.visionOK && (
        <p className="remedy">
          MonadVision fix:{" "}
          <a href={SOURCIFY_VERIFIER} target="_blank" rel="noreferrer">
            submit source via Sourcify ↗
          </a>
        </p>
      )}
      <footer className="tcard-foot">
        <span>
          {c.settled ? `settled ${fmtWhen(c.checkedAt)}` : awaitingText(c, attestors)}
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
  // Feed scan frontier: every block in [DEPLOY_BLOCK, frontier] has been
  // scanned for events (in this browser — persisted in localStorage).
  const frontierRef = useRef<bigint | null>(null);
  const feedMapRef = useRef<Map<string, PulseEvent>>(new Map());
  const [backfilling, setBackfilling] = useState(false);

  const configured = TWIN !== "0x0000000000000000000000000000000000000000";

  /**
   * Scan the next slice of history, merge events, persist, and return all known
   * events newest first.
   */
  const advanceFeed = useCallback(
    async (latest: bigint): Promise<PulseEvent[]> => {
      if (frontierRef.current === null) {
        const cached = loadFeedCache();
        frontierRef.current = cached ? cached.frontier : DEPLOY_BLOCK - 1n;
        if (cached) {
          for (const e of cached.events) feedMapRef.current.set(e.key, e);
        }
      }
      const previousFrontier = frontierRef.current;
      const nearHeadThreshold =
        latest > REORG_OVERLAP_BLOCKS ? latest - REORG_OVERLAP_BLOCKS : 0n;
      const from =
        previousFrontier >= nearHeadThreshold
          ? previousFrontier >= DEPLOY_BLOCK + REORG_OVERLAP_BLOCKS
            ? previousFrontier - REORG_OVERLAP_BLOCKS + 1n
            : DEPLOY_BLOCK
          : previousFrontier + 1n;
      if (from <= latest) {
        // Far behind (cold cache) → backfill hard so historical events surface
        // within ~a minute; caught up → gentle steady-state paging.
        const behind =
          latest - (previousFrontier > latest ? latest : previousFrontier);
        const pageBudget = behind > 40_000n ? 500 : 120;
        const { logs, scannedTo } = await scanLogsForward({
          address: TWIN,
          from,
          to: latest,
          pageBudget,
        });
        if (scannedTo >= from) {
          const replacements: PulseEvent[] = [];
          for (const log of logs) {
            const event = decodeAny(log);
            if (event) replacements.push(event);
          }
          const replaceTo =
            scannedTo === latest && previousFrontier > latest
              ? previousFrontier
              : scannedTo;
          const reconciled = reconcileFeedEvents(
            feedMapRef.current.values(),
            replacements,
            from,
            replaceTo,
          );
          feedMapRef.current = new Map(
            reconciled.map((event) => [event.key, event]),
          );
        }
        frontierRef.current =
          previousFrontier > latest && scannedTo === latest
            ? latest
            : scannedTo > previousFrontier
              ? scannedTo
              : previousFrontier;
        saveFeedCache(frontierRef.current, [...feedMapRef.current.values()]);
      }
      setBackfilling(frontierRef.current < latest);
      const events = [...feedMapRef.current.values()].sort(
        comparePulseEventsNewestFirst,
      );
      return events;
    },
    [],
  );

  const targetsRef = useRef<Address[]>([]);
  const cardRowsRef = useRef<Map<string, CardRow>>(new Map());
  const inFlight = useRef(false);

  const attestorsRef = useRef<{ a: Address; b: Address } | null>(null);

  const readCardRow = useCallback(async (target: Address): Promise<CardRow> => {
    const c = await client.readContract({
      address: TWIN,
      abi: twinAbi,
      functionName: "getCard",
      args: [target],
    });
    // For never-settled cards, name the attestor whose report is missing.
    let awaiting: Awaiting = null;
    const att = attestorsRef.current;
    if (c[0] && !c[1] && att) {
      const [ra, rb] = await Promise.all([
        client.readContract({
          address: TWIN,
          abi: twinAbi,
          functionName: "reports",
          args: [target, att.a],
        }),
        client.readContract({
          address: TWIN,
          abi: twinAbi,
          functionName: "reports",
          args: [target, att.b],
        }),
      ]);
      awaiting = classifyPendingReports(
        { scanOK: ra[0], visionOK: ra[1], exists: ra[4] },
        { scanOK: rb[0], visionOK: rb[1], exists: rb[4] },
      );
    }
    return {
      target,
      watched: c[0],
      settled: c[1],
      scanOK: c[2],
      visionOK: c[3],
      dualOK: c[4],
      checkedAt: Number(c[5]),
      evidenceHash: c[6],
      awaiting,
    };
  }, []);

  /** Merge freshly-read rows, re-derive ordered card list, flag state flips. */
  const applyRows = useCallback((rows: CardRow[]) => {
    for (const r of rows) cardRowsRef.current.set(r.target.toLowerCase(), r);
    const ordered = targetsRef.current
      .map((t) => cardRowsRef.current.get(t.toLowerCase()))
      .filter((r): r is CardRow => Boolean(r));

    // status flips are the product's heartbeat — flag them for the UI
    const prev = prevStates.current;
    const changed = new Set<string>();
    for (const r of ordered) {
      const s = stateOf(r);
      const p = prev.get(r.target);
      if (p && p !== s) changed.add(r.target);
    }
    prevStates.current = new Map(ordered.map((r) => [r.target, stateOf(r)]));
    if (changed.size > 0) {
      setFlipped(changed);
      setTimeout(() => setFlipped(new Set()), 1400);
    }
    setCards(ordered);
  }, []);

  /**
   * initial=true: full read behind a loading screen. initial=false: quiet
   * background pass that refreshes contract state without flashing "Syncing…".
   */
  const sync = useCallback(
    async (initial: boolean) => {
      if (!configured) {
        setError("Set VITE_TWINCHECK to the deployed TwinCheck address.");
        setLoading(false);
        return;
      }
      if (inFlight.current) return;
      inFlight.current = true;
      if (initial) setLoading(true);
      try {
        if (initial) {
          const code = await client.getCode({ address: TWIN });
          if (!code || code === "0x") {
            throw new Error(`No contract code at ${TWIN}`);
          }
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
        attestorsRef.current = { a, b };
        setAttestors({ a, b });
        setBlock(latest);

        // Diff-based target list: only indexes we have not read yet.
        const n = Number(count);
        const known = targetsRef.current.length;
        for (let i = known; i < n; i++) {
          const t = await client.readContract({
            address: TWIN,
            abi: twinAbi,
            functionName: "watchedAt",
            args: [BigInt(i)],
          });
          targetsRef.current.push(t);
        }

        const feedPromise = advanceFeed(latest)
          .then((events) => setFeed(events.slice(0, 80)))
          .catch(() => undefined);

        // Cards come from contract STATE (watchedCount/watchedAt) — they must
        // paint immediately and never wait on the historical log scan.
        const cardTargets = new Map<string, Address>();
        for (const t of targetsRef.current) cardTargets.set(t.toLowerCase(), t);
        const rows: CardRow[] = [];
        let failedRows = 0;
        for (const t of cardTargets.values()) {
          try {
            rows.push(await readCardRow(t));
          } catch {
            failedRows++;
          }
        }
        if (rows.length > 0 || initial) applyRows(rows);
        setError(
          failedRows > 0
            ? `${failedRows} card${failedRows === 1 ? "" : "s"} could not be refreshed.`
            : null,
        );
        if (initial) setLoading(false); // cards are live; the feed fills in behind
        await feedPromise;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (initial) setLoading(false);
        inFlight.current = false;
      }
    },
    [configured, advanceFeed, applyRows, readCardRow],
  );

  useEffect(() => {
    sync(true);
    const id = setInterval(() => sync(false), 20_000);
    return () => clearInterval(id);
  }, [sync]);

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
            <button
              type="button"
              className="btn"
              onClick={() => sync(false)}
              disabled={loading}
            >
              Refresh
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
                attestors={attestors}
              />
            ))}
          </div>
        )}
      </section>

      <section className="ledger" aria-label="Onchain pulse">
        <div className="section-head">
          <h2>Onchain pulse</h2>
          <span className="ledger-note">
            {backfilling
              ? "catching up on history — the full feed since deploy fills in as older blocks are scanned"
              : "every watch, report, settle, and flip since the contract was deployed"}
          </span>
        </div>
        <ol className="feed">
          {feed.length === 0 && (
            <li className="feed-empty">
              {backfilling
                ? "Reading event history from the chain…"
                : "Quiet — no TwinCheck events yet. New pulses land here when the attestors re-check."}
            </li>
          )}
          {feed.map((e) => (
            <li key={e.key} className="feed-item">
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
                      {e.dualOK
                        ? "dual ok"
                        : e.scanOK !== e.visionOK
                          ? "split"
                          : "both fail"}
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
