import {
  createPublicClient,
  http,
  parseAbiItem,
  type Address,
  type Hex,
  type Log,
} from "viem";

export const MONAD_CHAIN_ID = 10143;
export const MONAD_RPC =
  import.meta.env.VITE_MONAD_RPC_URL || "https://testnet-rpc.monad.xyz";
export const EXPLORER =
  import.meta.env.VITE_MONAD_EXPLORER || "https://testnet.monadvision.com";
export const SCAN =
  import.meta.env.VITE_MONADSCAN || "https://testnet.monadscan.com";

const DEFAULT_TWIN = "0x0000000000000000000000000000000000000000";

function resolveTwin(): Address {
  const raw = (import.meta.env.VITE_TWINCHECK || DEFAULT_TWIN).toString().trim();
  return raw as Address;
}

export const TWIN = resolveTwin();

export const client = createPublicClient({
  chain: {
    id: MONAD_CHAIN_ID,
    name: "Monad Testnet",
    nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
    rpcUrls: { default: { http: [MONAD_RPC] } },
  },
  transport: http(MONAD_RPC),
});

export const twinAbi = [
  {
    type: "function",
    name: "getCard",
    stateMutability: "view",
    inputs: [{ name: "target", type: "address" }],
    outputs: [
      { name: "watched", type: "bool" },
      { name: "settled", type: "bool" },
      { name: "scanOK", type: "bool" },
      { name: "visionOK", type: "bool" },
      { name: "isDualOK", type: "bool" },
      { name: "checkedAt", type: "uint64" },
      { name: "evidenceHash", type: "bytes32" },
    ],
  },
  {
    type: "function",
    name: "watchedCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "watchedAt",
    stateMutability: "view",
    inputs: [{ name: "i", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "reports",
    stateMutability: "view",
    inputs: [
      { name: "target", type: "address" },
      { name: "attestor", type: "address" },
    ],
    outputs: [
      { name: "scanOK", type: "bool" },
      { name: "visionOK", type: "bool" },
      { name: "evidenceHash", type: "bytes32" },
      { name: "reportedAt", type: "uint64" },
      { name: "exists", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "attestorA",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "attestorB",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
] as const;

export const watchedEvent = parseAbiItem(
  "event Watched(address indexed target, address indexed by, uint64 at)",
);
export const reportedEvent = parseAbiItem(
  "event Reported(address indexed target, address indexed attestor, bool scanOK, bool visionOK, bytes32 evidenceHash, uint64 at)",
);
export const settledEvent = parseAbiItem(
  "event DualStatusSettled(address indexed target, bool scanOK, bool visionOK, bool dualOK, bytes32 evidenceHash, uint64 checkedAt)",
);
export const pulseEvent = parseAbiItem(
  "event DualStatusPulse(address indexed target, bool prevScanOK, bool prevVisionOK, bool scanOK, bool visionOK, bool dualOK, uint64 checkedAt)",
);

export type PulseEvent = {
  /** Stable identity: `${tx}:${logIndex}` — used for dedupe + React keys. */
  key: string;
  kind: "Pulse" | "Settled" | "Reported" | "Watched";
  target: Address;
  scanOK?: boolean;
  visionOK?: boolean;
  dualOK?: boolean;
  prevScanOK?: boolean;
  prevVisionOK?: boolean;
  attestor?: Address;
  tx: Hex;
  blockNumber: bigint;
  logIndex: number;
  at?: number;
};

export type PendingReportState = "A" | "B" | "both" | "disagree" | "stale";

export function classifyPendingReports(
  a: { scanOK: boolean; visionOK: boolean; exists: boolean },
  b: { scanOK: boolean; visionOK: boolean; exists: boolean },
): PendingReportState {
  if (!a.exists && !b.exists) return "both";
  if (!a.exists) return "A";
  if (!b.exists) return "B";
  return a.scanOK !== b.scanOK || a.visionOK !== b.visionOK
    ? "disagree"
    : "stale";
}

export function comparePulseEventsNewestFirst(
  a: PulseEvent,
  b: PulseEvent,
): number {
  if (a.blockNumber !== b.blockNumber) {
    return a.blockNumber > b.blockNumber ? -1 : 1;
  }
  return b.logIndex - a.logIndex;
}

export function shortAddr(a: string): string {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—";
}

export function explorerTx(hash: string): string {
  return `${EXPLORER}/tx/${hash}`;
}

export function explorerAddr(addr: string): string {
  return `${EXPLORER}/address/${addr}`;
}

export function scanAddr(addr: string): string {
  return `${SCAN}/address/${addr}`;
}

/** Monad public RPC caps eth_getLogs to a 100-block range. */
export const LOG_PAGE_SIZE = 100n;
export const REORG_OVERLAP_BLOCKS = 64n;

/**
 * Block the TwinCheck contract was deployed at (from the forge broadcast,
 * broadcast/DeployTwinCheck.s.sol/10143/run-latest.json). Scanning starts
 * here — nothing earlier can contain TwinCheck events.
 */
export const DEPLOY_BLOCK = BigInt(
  import.meta.env.VITE_TWINCHECK_DEPLOY_BLOCK || "46027838",
);

/**
 * Scan [from, to] FORWARD in ≤100-block pages, stopping once `pageBudget`
 * pages have been fetched. Returns the logs found plus the last block
 * actually covered, so callers can persist a frontier and resume next poll.
 */
export async function scanLogsForward(opts: {
  address: Address;
  from: bigint;
  to: bigint;
  pageBudget?: number;
  concurrency?: number;
}): Promise<{ logs: Log[]; scannedTo: bigint; failed: boolean }> {
  const pageBudget = opts.pageBudget ?? 200;
  const concurrency = opts.concurrency ?? 5;
  if (opts.from > opts.to) {
    return { logs: [], scannedTo: opts.to, failed: false };
  }

  const ranges: { from: bigint; to: bigint }[] = [];
  let from = opts.from;
  for (let i = 0; i < pageBudget && from <= opts.to; i++) {
    const to = from + LOG_PAGE_SIZE - 1n < opts.to ? from + LOG_PAGE_SIZE - 1n : opts.to;
    ranges.push({ from, to });
    from = to + 1n;
  }

  const out: Log[] = [];
  let scannedTo = opts.from - 1n;
  for (let i = 0; i < ranges.length; i += concurrency) {
    const batch = ranges.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      batch.map((r) =>
        client.getLogs({ address: opts.address, fromBlock: r.from, toBlock: r.to }),
      ),
    );
    // Advance the frontier only across the LEADING run of successful pages. A
    // single failed getLogs (transient RPC 429/timeout) then neither discards
    // logs already collected nor skips a block — the frontier stops at the last
    // confirmed page and the next poll resumes exactly there.
    for (let j = 0; j < results.length; j++) {
      const res = results[j];
      if (res.status !== "fulfilled") {
        return { logs: out, scannedTo, failed: true };
      }
      out.push(...res.value);
      scannedTo = batch[j].to;
    }
    // Monad public RPC allows 25 req/s per IP — pace the backfill so the
    // dashboard never trips the limit (and leaves headroom for card reads).
    if (i + concurrency < ranges.length) {
      await new Promise((r) => setTimeout(r, 350));
    }
  }
  return { logs: out, scannedTo, failed: false };
}

export function reconcileFeedEvents(
  existing: Iterable<PulseEvent>,
  replacements: Iterable<PulseEvent>,
  from: bigint,
  to: bigint,
): PulseEvent[] {
  const events = new Map<string, PulseEvent>();
  for (const event of existing) {
    if (event.blockNumber < from || event.blockNumber > to) {
      events.set(event.key, event);
    }
  }
  for (const event of replacements) events.set(event.key, event);
  return [...events.values()];
}

export function reconcileFeedHead(
  existing: Iterable<PulseEvent>,
  frontier: bigint,
  latest: bigint,
  deployBlock = DEPLOY_BLOCK,
  overlap = REORG_OVERLAP_BLOCKS,
): {
  frontier: bigint;
  events: PulseEvent[];
  rescanFrom: bigint | null;
} {
  const events = [...existing];
  if (frontier <= latest) {
    return { frontier, events, rescanFrom: null };
  }
  if (latest < deployBlock) {
    return {
      frontier: deployBlock - 1n,
      events: [],
      rescanFrom: null,
    };
  }
  const rescanFrom =
    latest - deployBlock + 1n > overlap
      ? latest - overlap + 1n
      : deployBlock;
  return {
    frontier: latest,
    events: reconcileFeedEvents(events, [], rescanFrom, frontier),
    rescanFrom,
  };
}

// ── Feed cache (localStorage) ────────────────────────────────────────────────
// The full history from DEPLOY_BLOCK is scanned once per browser; afterwards
// each poll only fetches blocks past the persisted frontier.

type StoredEvent = Omit<PulseEvent, "blockNumber"> & { blockNumber: string };
type FeedCacheShape = {
  version: number;
  frontier: string;
  events: StoredEvent[];
};

// Bump whenever the scan's start block or event shape changes — a stale cached
// frontier from an earlier DEPLOY_BLOCK would otherwise skip the backfill and
// leave the feed permanently empty.
const FEED_CACHE_VERSION = 4;

function feedCacheKey(): string {
  return `twincheck.feed.v${FEED_CACHE_VERSION}.${MONAD_CHAIN_ID}.${TWIN.toLowerCase()}`;
}

export function loadFeedCache(): { frontier: bigint; events: PulseEvent[] } | null {
  try {
    const raw = localStorage.getItem(feedCacheKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FeedCacheShape;
    if (parsed.version !== FEED_CACHE_VERSION || !Array.isArray(parsed.events)) {
      return null;
    }
    return {
      frontier: BigInt(parsed.frontier),
      events: parsed.events.map((e) => ({ ...e, blockNumber: BigInt(e.blockNumber) })),
    };
  } catch {
    return null;
  }
}

export function saveFeedCache(frontier: bigint, events: PulseEvent[]): void {
  try {
    const shape: FeedCacheShape = {
      version: FEED_CACHE_VERSION,
      frontier: frontier.toString(),
      events: events.map((e) => ({ ...e, blockNumber: e.blockNumber.toString() })),
    };
    localStorage.setItem(feedCacheKey(), JSON.stringify(shape));
  } catch {
    /* private mode / quota — cache is an optimization, not a requirement */
  }
}
