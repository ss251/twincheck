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

export const STAMP = (import.meta.env.VITE_DONESTAMP ||
  import.meta.env.VITE_FLEETLEDGER ||
  "") as Address;

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
