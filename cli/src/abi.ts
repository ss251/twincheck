/** Minimal FleetLedger ABI for postSpend / canSpawn / signalDenied / views. */
export const fleetLedgerAbi = [
  {
    type: "function",
    name: "postSpend",
    stateMutability: "nonpayable",
    inputs: [
      { name: "seatId", type: "bytes32" },
      { name: "units", type: "uint128" },
      { name: "receiptHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "canSpawn",
    stateMutability: "view",
    inputs: [
      { name: "seatId", type: "bytes32" },
      { name: "cost", type: "uint128" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "remaining",
    stateMutability: "view",
    inputs: [{ name: "seatId", type: "bytes32" }],
    outputs: [{ name: "", type: "uint128" }],
  },
  {
    type: "function",
    name: "poolRemaining",
    stateMutability: "view",
    inputs: [{ name: "poolId", type: "bytes32" }],
    outputs: [{ name: "", type: "uint128" }],
  },
  {
    type: "function",
    name: "signalDenied",
    stateMutability: "nonpayable",
    inputs: [
      { name: "seatId", type: "bytes32" },
      { name: "cost", type: "uint128" },
      { name: "reason", type: "bytes32" },
    ],
    outputs: [],
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
] as const;
