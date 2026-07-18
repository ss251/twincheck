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

/** Deployed DoneStamp on Monad testnet (DEPLOYMENTS.md). Env overrides when set. */
const DEFAULT_STAMP = "0x6e234b4839641158B4E88Db59037B178BfcC31C8";

function resolveStamp(): Address {
  const raw = (
    import.meta.env.VITE_DONESTAMP ||
    import.meta.env.VITE_FLEETLEDGER ||
    DEFAULT_STAMP
  )
    .toString()
    .trim();
  return raw as Address;
}

export const STAMP = resolveStamp();

export const client = createPublicClient({
  chain: {
    id: MONAD_CHAIN_ID,
    name: "Monad Testnet",
    nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
    rpcUrls: { default: { http: [MONAD_RPC] } },
  },
  transport: http(MONAD_RPC),
});

export const stampAbi = [
  {
    type: "function",
    name: "isDone",
    stateMutability: "view",
    inputs: [{ name: "taskId", type: "bytes32" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "isPending",
    stateMutability: "view",
    inputs: [{ name: "taskId", type: "bytes32" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "receipts",
    stateMutability: "view",
    inputs: [{ name: "taskId", type: "bytes32" }],
    outputs: [
      { name: "worker", type: "address" },
      { name: "accepter", type: "address" },
      { name: "specHash", type: "bytes32" },
      { name: "evidenceHash", type: "bytes32" },
      { name: "gatePass", type: "bool" },
      { name: "accepted", type: "bool" },
      { name: "rejected", type: "bool" },
      { name: "committedAt", type: "uint64" },
      { name: "decidedAt", type: "uint64" },
      { name: "exists", type: "bool" },
    ],
  },
] as const;

export const committedEvent = parseAbiItem(
  "event Committed(bytes32 indexed taskId, address indexed worker, bytes32 specHash, bytes32 evidenceHash, bool gatePass, uint64 committedAt)",
);
export const acceptedEvent = parseAbiItem(
  "event Accepted(bytes32 indexed taskId, address indexed accepter, bytes32 evidenceHash, uint64 decidedAt)",
);
export const rejectedEvent = parseAbiItem(
  "event Rejected(bytes32 indexed taskId, address indexed accepter, bytes32 reason, uint64 decidedAt)",
);
export const deniedEvent = parseAbiItem(
  "event Denied(bytes32 indexed taskId, address indexed caller, bytes32 providedHash, bytes32 expectedHash)",
);

export type ChainEvent =
  | {
      kind: "Committed";
      taskId: Hex;
      worker: Address;
      evidenceHash: Hex;
      gatePass: boolean;
      tx: Hex;
      blockNumber: bigint;
    }
  | {
      kind: "Accepted";
      taskId: Hex;
      accepter: Address;
      evidenceHash: Hex;
      tx: Hex;
      blockNumber: bigint;
    }
  | {
      kind: "Rejected";
      taskId: Hex;
      accepter: Address;
      reason: Hex;
      tx: Hex;
      blockNumber: bigint;
    }
  | {
      kind: "Denied";
      taskId: Hex;
      caller: Address;
      providedHash: Hex;
      expectedHash: Hex;
      tx: Hex;
      blockNumber: bigint;
    };

export function shortAddr(a: string): string {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—";
}

export function shortBytes(b: string): string {
  return b ? `${b.slice(0, 10)}…` : "—";
}

export function explorerTx(hash: string): string {
  return `${EXPLORER}/tx/${hash}`;
}

export function explorerAddr(addr: string): string {
  return `${EXPLORER}/address/${addr}`;
}

/** Monad public RPC caps eth_getLogs to a 100-block range (error -32614). */
export const LOG_PAGE_SIZE = 100n;

/**
 * Page eth_getLogs in ≤100-block windows from `toBlock` backward.
 * Batches pages (parallel within batch) for acceptable UI latency under Monad's
 * 100-block eth_getLogs limit.
 */
export async function getAllLogsPaged(opts: {
  address: Address;
  toBlock: bigint;
  /** Default 20 → 2_000 blocks (~13 min on 400ms blocks) — enough for demo receipts. */
  maxPages?: number;
  concurrency?: number;
}): Promise<Log[]> {
  const maxPages = opts.maxPages ?? 20;
  const concurrency = opts.concurrency ?? 5;
  const ranges: { from: bigint; to: bigint }[] = [];
  let to = opts.toBlock;
  for (let i = 0; i < maxPages && to >= 0n; i++) {
    const span = to + 1n < LOG_PAGE_SIZE ? to + 1n : LOG_PAGE_SIZE;
    const from = to + 1n > span ? to + 1n - span : 0n;
    ranges.push({ from, to });
    if (from === 0n) break;
    to = from - 1n;
  }

  const out: Log[] = [];
  for (let i = 0; i < ranges.length; i += concurrency) {
    const batch = ranges.slice(i, i + concurrency);
    const chunks = await Promise.all(
      batch.map(({ from, to: t }) =>
        client.getLogs({
          address: opts.address,
          fromBlock: from,
          toBlock: t,
        }),
      ),
    );
    for (const chunk of chunks) out.push(...chunk);
  }
  return out;
}

export function logToEvent(log: Log & { args?: any; eventName?: string }): ChainEvent | null {
  const tx = log.transactionHash as Hex;
  const blockNumber = log.blockNumber ?? 0n;
  const a = log.args || {};
  const name = log.eventName;
  if (name === "Committed") {
    return {
      kind: "Committed",
      taskId: a.taskId,
      worker: a.worker,
      evidenceHash: a.evidenceHash,
      gatePass: a.gatePass,
      tx,
      blockNumber,
    };
  }
  if (name === "Accepted") {
    return {
      kind: "Accepted",
      taskId: a.taskId,
      accepter: a.accepter,
      evidenceHash: a.evidenceHash,
      tx,
      blockNumber,
    };
  }
  if (name === "Rejected") {
    return {
      kind: "Rejected",
      taskId: a.taskId,
      accepter: a.accepter,
      reason: a.reason,
      tx,
      blockNumber,
    };
  }
  if (name === "Denied") {
    return {
      kind: "Denied",
      taskId: a.taskId,
      caller: a.caller,
      providedHash: a.providedHash,
      expectedHash: a.expectedHash,
      tx,
      blockNumber,
    };
  }
  return null;
}
