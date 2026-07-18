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

export const LEDGER = (import.meta.env.VITE_FLEETLEDGER || "") as Address;
export const POOL_LABEL = import.meta.env.VITE_POOL_ID || "fleetmeter-spark";
export const SEAT_A_LABEL = import.meta.env.VITE_SEAT_ID || "seat-principal-a";
export const SEAT_B_LABEL = import.meta.env.VITE_SEAT_B_ID || "seat-principal-b";

export const client = createPublicClient({
  chain: {
    id: MONAD_CHAIN_ID,
    name: "Monad Testnet",
    nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
    rpcUrls: { default: { http: [MONAD_RPC] } },
  },
  transport: http(MONAD_RPC),
});

export const fleetAbi = [
  {
    type: "function",
    name: "remaining",
    stateMutability: "view",
    inputs: [{ name: "seatId", type: "bytes32" }],
    outputs: [{ type: "uint128" }],
  },
  {
    type: "function",
    name: "poolRemaining",
    stateMutability: "view",
    inputs: [{ name: "poolId", type: "bytes32" }],
    outputs: [{ type: "uint128" }],
  },
  {
    type: "function",
    name: "canSpawn",
    stateMutability: "view",
    inputs: [
      { name: "seatId", type: "bytes32" },
      { name: "cost", type: "uint128" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "seats",
    stateMutability: "view",
    inputs: [{ name: "seatId", type: "bytes32" }],
    outputs: [
      { name: "controller", type: "address" },
      { name: "poolId", type: "bytes32" },
      { name: "spent", type: "uint128" },
      { name: "cap", type: "uint128" },
      { name: "windowStart", type: "uint64" },
      { name: "windowSeconds", type: "uint64" },
      { name: "exists", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "pools",
    stateMutability: "view",
    inputs: [{ name: "poolId", type: "bytes32" }],
    outputs: [
      { name: "admin", type: "address" },
      { name: "orchestrator", type: "address" },
      { name: "spent", type: "uint128" },
      { name: "ceiling", type: "uint128" },
      { name: "windowStart", type: "uint64" },
      { name: "windowSeconds", type: "uint64" },
      { name: "exists", type: "bool" },
    ],
  },
] as const;

export const spendEvent = parseAbiItem(
  "event Spend(bytes32 indexed seatId, bytes32 indexed poolId, address indexed spender, uint128 units, uint128 seatSpentAfter, uint128 poolSpentAfter, uint64 seatWindowStart, bytes32 receiptHash)",
);
export const softStopEvent = parseAbiItem(
  "event SoftStop(bytes32 indexed seatId, bytes32 indexed poolId, uint128 spent, uint128 cap, uint16 bps)",
);
export const hardStopEvent = parseAbiItem(
  "event HardStop(bytes32 indexed seatId, bytes32 indexed poolId, uint128 spent, uint128 cap, uint16 bps)",
);
export const deniedEvent = parseAbiItem(
  "event Denied(bytes32 indexed seatId, bytes32 indexed poolId, address indexed reporter, uint128 cost, bytes32 reason)",
);
export const seatRegisteredEvent = parseAbiItem(
  "event SeatRegistered(bytes32 indexed seatId, bytes32 indexed poolId, address indexed controller, uint64 windowSeconds, uint128 capUnits)",
);

export type ChainEvent =
  | {
      kind: "Spend";
      seatId: Hex;
      poolId: Hex;
      spender: Address;
      units: bigint;
      seatSpentAfter: bigint;
      poolSpentAfter: bigint;
      tx: Hex;
      blockNumber: bigint;
    }
  | {
      kind: "SoftStop" | "HardStop";
      seatId: Hex;
      poolId: Hex;
      spent: bigint;
      cap: bigint;
      bps: number;
      tx: Hex;
      blockNumber: bigint;
    }
  | {
      kind: "Denied";
      seatId: Hex;
      poolId: Hex;
      reporter: Address;
      cost: bigint;
      reason: Hex;
      tx: Hex;
      blockNumber: bigint;
    }
  | {
      kind: "SeatRegistered";
      seatId: Hex;
      poolId: Hex;
      controller: Address;
      windowSeconds: bigint;
      capUnits: bigint;
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
  if (name === "Spend") {
    return {
      kind: "Spend",
      seatId: a.seatId,
      poolId: a.poolId,
      spender: a.spender,
      units: a.units,
      seatSpentAfter: a.seatSpentAfter,
      poolSpentAfter: a.poolSpentAfter,
      tx,
      blockNumber,
    };
  }
  if (name === "SoftStop" || name === "HardStop") {
    return {
      kind: name,
      seatId: a.seatId,
      poolId: a.poolId,
      spent: a.spent,
      cap: a.cap,
      bps: Number(a.bps),
      tx,
      blockNumber,
    };
  }
  if (name === "Denied") {
    return {
      kind: "Denied",
      seatId: a.seatId,
      poolId: a.poolId,
      reporter: a.reporter,
      cost: a.cost,
      reason: a.reason,
      tx,
      blockNumber,
    };
  }
  if (name === "SeatRegistered") {
    return {
      kind: "SeatRegistered",
      seatId: a.seatId,
      poolId: a.poolId,
      controller: a.controller,
      windowSeconds: a.windowSeconds,
      capUnits: a.capUnits,
      tx,
      blockNumber,
    };
  }
  return null;
}
