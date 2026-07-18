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
  at?: number;
};

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

export async function getAllLogsPaged(opts: {
  address: Address;
  toBlock: bigint;
  maxPages?: number;
  concurrency?: number;
}): Promise<Log[]> {
  const maxPages = opts.maxPages ?? 40;
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
