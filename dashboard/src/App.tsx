import { useCallback, useEffect, useMemo, useState } from "react";
import { keccak256, stringToBytes, type Address, type Hex } from "viem";
import {
  LEDGER,
  POOL_LABEL,
  SEAT_A_LABEL,
  SEAT_B_LABEL,
  MONAD_CHAIN_ID,
  MONAD_RPC,
  client,
  fleetAbi,
  spendEvent,
  softStopEvent,
  hardStopEvent,
  deniedEvent,
  seatRegisteredEvent,
  logToEvent,
  type ChainEvent,
  shortAddr,
  shortBytes,
  explorerTx,
  explorerAddr,
} from "./chain";

type SeatView = {
  label: string;
  seatId: Hex;
  controller: Address;
  cap: bigint;
  spent: bigint;
  remaining: bigint;
  windowSeconds: bigint;
  exists: boolean;
};

type PoolView = {
  poolId: Hex;
  admin: Address;
  ceiling: bigint;
  spent: bigint;
  remaining: bigint;
  exists: boolean;
};

function pct(used: bigint, cap: bigint): number {
  if (cap === 0n) return 0;
  return Math.min(100, Number((used * 10000n) / cap) / 100);
}

function formatUnits(u: bigint): string {
  // micro-USD display: 1e6 → $1.00
  const neg = u < 0n;
  const v = neg ? -u : u;
  const whole = v / 1_000_000n;
  const frac = (v % 1_000_000n).toString().padStart(6, "0").slice(0, 2);
  return `${neg ? "-" : ""}$${whole}.${frac}`;
}

function meterClass(p: number): string {
  if (p >= 95) return "meter danger";
  if (p >= 80) return "meter warn";
  return "meter";
}

export function App() {
  const poolId = useMemo(() => keccak256(stringToBytes(POOL_LABEL)), []);
  const seatAId = useMemo(() => keccak256(stringToBytes(SEAT_A_LABEL)), []);
  const seatBId = useMemo(() => keccak256(stringToBytes(SEAT_B_LABEL)), []);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [seatA, setSeatA] = useState<SeatView | null>(null);
  const [seatB, setSeatB] = useState<SeatView | null>(null);
  const [pool, setPool] = useState<PoolView | null>(null);
  const [events, setEvents] = useState<ChainEvent[]>([]);
  const [block, setBlock] = useState<bigint | null>(null);

  const configured = Boolean(LEDGER && LEDGER.startsWith("0x") && LEDGER.length === 42);

  const loadSeat = async (label: string, seatId: Hex): Promise<SeatView> => {
    const [tuple, remaining] = await Promise.all([
      client.readContract({
        address: LEDGER,
        abi: fleetAbi,
        functionName: "seats",
        args: [seatId],
      }),
      client.readContract({
        address: LEDGER,
        abi: fleetAbi,
        functionName: "remaining",
        args: [seatId],
      }),
    ]);
    const [controller, , spent, cap, , windowSeconds, exists] = tuple;
    return {
      label,
      seatId,
      controller,
      spent,
      cap,
      remaining,
      windowSeconds,
      exists,
    };
  };

  const refresh = useCallback(async () => {
    if (!configured) {
      setError(
        "VITE_FLEETLEDGER is not set. Deploy FleetLedger (D2), then set the address in dashboard/.env / Vercel env.",
      );
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const code = await client.getCode({ address: LEDGER });
      if (!code || code === "0x") {
        throw new Error(`No contract bytecode at ${LEDGER} on Monad testnet.`);
      }

      const bn = await client.getBlockNumber();
      setBlock(bn);

      const [a, b, poolTuple, poolRem] = await Promise.all([
        loadSeat(SEAT_A_LABEL, seatAId),
        loadSeat(SEAT_B_LABEL, seatBId),
        client.readContract({
          address: LEDGER,
          abi: fleetAbi,
          functionName: "pools",
          args: [poolId],
        }),
        client.readContract({
          address: LEDGER,
          abi: fleetAbi,
          functionName: "poolRemaining",
          args: [poolId],
        }),
      ]);
      setSeatA(a);
      setSeatB(b);
      const [admin, , spent, ceiling, , , exists] = poolTuple;
      setPool({
        poolId,
        admin,
        spent,
        ceiling,
        remaining: poolRem,
        exists,
      });

      // Event history: last ~50k blocks or from 0 if chain is short for this deploy.
      const fromBlock = bn > 80_000n ? bn - 80_000n : 0n;
      const [spends, softs, hards, denieds, seats] = await Promise.all([
        client.getLogs({ address: LEDGER, event: spendEvent, fromBlock, toBlock: bn }),
        client.getLogs({ address: LEDGER, event: softStopEvent, fromBlock, toBlock: bn }),
        client.getLogs({ address: LEDGER, event: hardStopEvent, fromBlock, toBlock: bn }),
        client.getLogs({ address: LEDGER, event: deniedEvent, fromBlock, toBlock: bn }),
        client.getLogs({
          address: LEDGER,
          event: seatRegisteredEvent,
          fromBlock,
          toBlock: bn,
        }),
      ]);

      const merged: ChainEvent[] = [];
      for (const log of [...spends, ...softs, ...hards, ...denieds, ...seats]) {
        const ev = logToEvent(log as any);
        if (ev) merged.push(ev);
      }
      merged.sort((x, y) => {
        if (x.blockNumber === y.blockNumber) return 0;
        return x.blockNumber < y.blockNumber ? 1 : -1;
      });
      setEvents(merged.slice(0, 80));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [configured, poolId, seatAId, seatBId]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 12_000);
    return () => clearInterval(t);
  }, [refresh]);

  const poolPct = pool && pool.ceiling > 0n ? pct(pool.spent, pool.ceiling) : 0;

  return (
    <div className="app">
      <header className="masthead">
        <p className="eyebrow">Monad testnet · shared-pool quota commons</p>
        <h1>FleetMeter</h1>
        <p className="lede">
          Live counters for a multi-provider AI fleet. Two independent principals share one
          ceiling — neither can forge the other&apos;s spend. Events are the append-only
          history; storage holds only what{" "}
          <code style={{ fontFamily: "var(--font-mono)" }}>canSpawn</code> needs.
        </p>
        <div className="meta-row">
          <span className="pill">
            <span className={`dot ${error ? "err" : configured ? "" : "warn"}`} />
            chain {MONAD_CHAIN_ID}
          </span>
          <span className="pill">block {block?.toString() ?? "—"}</span>
          {configured ? (
            <a className="pill" href={explorerAddr(LEDGER)} target="_blank" rel="noreferrer">
              ledger {shortAddr(LEDGER)}
            </a>
          ) : (
            <span className="pill">ledger unset</span>
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
        <SeatCard title="Principal A" seat={seatA} label={SEAT_A_LABEL} />
        <SeatCard title="Principal B" seat={seatB} label={SEAT_B_LABEL} />
        <div className="card">
          <h2>Shared pool</h2>
          <div className="sub">
            {POOL_LABEL} · {shortBytes(poolId)}
          </div>
          {pool?.exists ? (
            <>
              <div className={meterClass(poolPct)}>
                <span style={{ width: `${poolPct}%` }} />
              </div>
              <div className="stat-row">
                <span>
                  used <strong>{poolPct.toFixed(1)}%</strong>
                </span>
                <span>
                  remaining <strong>{formatUnits(pool.remaining)}</strong>
                </span>
              </div>
              <div className="stat-row">
                <span>
                  spent {formatUnits(pool.spent)} / ceiling {formatUnits(pool.ceiling)}
                </span>
              </div>
              <div className="principal">
                Pool admin{" "}
                <a href={explorerAddr(pool.admin)} target="_blank" rel="noreferrer">
                  {shortAddr(pool.admin)}
                </a>
                <br />
                Both seats debit this ceiling. That is the multi-party trust point.
              </div>
            </>
          ) : (
            <p className="empty">Pool not registered on this ledger yet.</p>
          )}
        </div>
      </div>

      <section className="section">
        <div className="section-head">
          <h2>Event tape</h2>
          <span>Spend · SoftStop · HardStop · Denied · SeatRegistered</span>
        </div>
        <div className="feed">
          {events.length === 0 ? (
            <div className="empty">
              No logs yet for this contract range. After deploy,{" "}
              <code>fleetmeter post</code> and a denied{" "}
              <code>fleetmeter gate --signal</code> will land here with explorer links.
            </div>
          ) : (
            events.map((ev, i) => <EventRow key={`${ev.tx}-${ev.kind}-${i}`} ev={ev} />)
          )}
        </div>
      </section>

      <footer className="footer">
        <span>
          RPC {MONAD_RPC.replace("https://", "")} · data from contract views + logs (no
          placeholders)
        </span>
        <span>
          {configured ? (
            <a href={explorerAddr(LEDGER)} target="_blank" rel="noreferrer">
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

function SeatCard({
  title,
  seat,
  label,
}: {
  title: string;
  seat: SeatView | null;
  label: string;
}) {
  if (!seat) {
    return (
      <div className="card">
        <h2>{title}</h2>
        <div className="sub">{label}</div>
        <p className="empty">Loading seat…</p>
      </div>
    );
  }
  if (!seat.exists) {
    return (
      <div className="card">
        <h2>{title}</h2>
        <div className="sub">{label}</div>
        <p className="empty">Seat not registered.</p>
      </div>
    );
  }
  const used = seat.cap > seat.remaining ? seat.cap - seat.remaining : 0n;
  const p = pct(used, seat.cap);
  return (
    <div className="card">
      <h2>{title}</h2>
      <div className="sub">
        {label} · window {seat.windowSeconds.toString()}s
      </div>
      <div className={meterClass(p)}>
        <span style={{ width: `${p}%` }} />
      </div>
      <div className="stat-row">
        <span>
          window used <strong>{p.toFixed(1)}%</strong>
        </span>
        <span>
          remaining <strong>{formatUnits(seat.remaining)}</strong>
        </span>
      </div>
      <div className="stat-row">
        <span>
          cap {formatUnits(seat.cap)} · live remaining from{" "}
          <code>remaining()</code>
        </span>
      </div>
      <div className="principal">
        Controller{" "}
        <a href={explorerAddr(seat.controller)} target="_blank" rel="noreferrer">
          {shortAddr(seat.controller)}
        </a>
        <br />
        Only this principal (or pool orchestrator) may{" "}
        <code>postSpend</code> for this seat.
      </div>
    </div>
  );
}

function EventRow({ ev }: { ev: ChainEvent }) {
  if (ev.kind === "Spend") {
    return (
      <div className="feed-row">
        <span className="tag spend">Spend</span>
        <div className="feed-body">
          seat <code>{shortBytes(ev.seatId)}</code> · {formatUnits(ev.units)} · after{" "}
          {formatUnits(ev.seatSpentAfter)} seat / {formatUnits(ev.poolSpentAfter)} pool
          <br />
          spender{" "}
          <a href={explorerAddr(ev.spender)} target="_blank" rel="noreferrer">
            {shortAddr(ev.spender)}
          </a>
        </div>
        <a href={explorerTx(ev.tx)} target="_blank" rel="noreferrer">
          tx
        </a>
      </div>
    );
  }
  if (ev.kind === "SoftStop" || ev.kind === "HardStop") {
    return (
      <div className="feed-row">
        <span className={`tag ${ev.kind === "SoftStop" ? "soft" : "hard"}`}>{ev.kind}</span>
        <div className="feed-body">
          seat <code>{shortBytes(ev.seatId)}</code> · {(ev.bps / 100).toFixed(1)}% of cap (
          {formatUnits(ev.spent)} / {formatUnits(ev.cap)})
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
          seat <code>{shortBytes(ev.seatId)}</code> · cost {formatUnits(ev.cost)} · reporter{" "}
          <a href={explorerAddr(ev.reporter)} target="_blank" rel="noreferrer">
            {shortAddr(ev.reporter)}
          </a>
        </div>
        <a href={explorerTx(ev.tx)} target="_blank" rel="noreferrer">
          tx
        </a>
      </div>
    );
  }
  if (ev.kind === "SeatRegistered") {
    return (
      <div className="feed-row">
        <span className="tag seat">Seat</span>
        <div className="feed-body">
          registered <code>{shortBytes(ev.seatId)}</code> · controller{" "}
          <a href={explorerAddr(ev.controller)} target="_blank" rel="noreferrer">
            {shortAddr(ev.controller)}
          </a>{" "}
          · cap {formatUnits(ev.capUnits)}
        </div>
        <a href={explorerTx(ev.tx)} target="_blank" rel="noreferrer">
          tx
        </a>
      </div>
    );
  }
  return null;
}
