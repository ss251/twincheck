/** Minimal DoneStamp ABI for commit / accept / reject / views. */
export const doneStampAbi = [
  {
    type: "function",
    name: "commit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "taskId", type: "bytes32" },
      { name: "specHash", type: "bytes32" },
      { name: "evidenceHash", type: "bytes32" },
      { name: "gatePass", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "accept",
    stateMutability: "nonpayable",
    inputs: [
      { name: "taskId", type: "bytes32" },
      { name: "evidenceHash", type: "bytes32" },
    ],
    outputs: [{ name: "ok", type: "bool" }],
  },
  {
    type: "function",
    name: "reject",
    stateMutability: "nonpayable",
    inputs: [
      { name: "taskId", type: "bytes32" },
      { name: "reason", type: "bytes32" },
    ],
    outputs: [],
  },
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
    name: "verify",
    stateMutability: "view",
    inputs: [
      { name: "taskId", type: "bytes32" },
      { name: "evidenceHash", type: "bytes32" },
    ],
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
