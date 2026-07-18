# DoneStamp

**Dual-principal onchain completion receipts for agent "done" claims.**

Monad BuildAnything Spark · practical > fancy · OSS.

---

## One-sentence wedge

> **Every agent "done" is a dual-principal onchain receipt — the worker posts gate hashes, a second accepter re-runs and co-signs, so vibes cannot replace proof.**

## The real problem (this week)

Unattended agent loops claim "done" as a speech act. The house already runs **pasted-proof discipline** because that speech act is unreliable: agents skip tests, invent checklists, or edit their own logs. A markdown receipt on the worker machine is self-serving. A git commit can be force-pushed. Usage tools (e.g. **CodexBar**) track *how much* was spent — not whether the *work* is actually complete.

DoneStamp makes completion a **two-party onchain object**:

1. **Worker** (principal A) runs a deterministic gate, commits `specHash` + `evidenceHash` + `gatePass`.
2. **Accepter** (principal B — human, CI box, or skeptic agent) re-hashes the same evidence and calls `accept`.
3. `isDone(taskId)` is true **only** after that co-sign. Mismatch → onchain `Denied` (and still not done).

## Why onchain is load-bearing (not a database)

| Local DB / log | DoneStamp |
|----------------|-----------|
| Owner can rewrite history | Worker cannot forge accepter's signature |
| Single machine is root of trust | Two independent EOAs; shared clock is `block.timestamp` |
| "Done" is private vibes | Append-only `Committed` / `Accepted` / `Denied` events |

Monad's cheap, fast blocks make **per-task receipts free** — the right substrate for high-frequency agent loops.

## What ships

| Piece | Role |
|-------|------|
| `src/DoneStamp.sol` | `commit` / `accept` / `reject` / `isDone` / `verify` |
| `cli/` (`bun`) | `donestamp commit\|accept\|reject\|check` |
| `dashboard/` | Live event tape of commits, accepts, denies |
| Foundry tests | Dual-principal ACL, allow/deny, mismatch Denied |

## Setup

```bash
forge test
source .env   # PRIVATE_KEY, PRINCIPAL_B_PRIVATE_KEY, DONESTAMP, MONAD_RPC_URL
```

### CLI

```bash
cd cli && bun install
# Worker A
bun run src/index.ts commit --task my-task \
  --spec examples/spec.txt \
  --evidence examples/evidence-pass.txt --require-pass-marker
# Accepter B (matching evidence)
bun run src/index.ts accept --task my-task --evidence examples/evidence-pass.txt
# Loud deny (wrong file)
bun run src/index.ts accept --task other-task --evidence examples/evidence-fail.txt  # exit 1
bun run src/index.ts check --task my-task   # exit 0 if isDone
```

### Dashboard

```bash
cd dashboard && bun install
# VITE_DONESTAMP=0x… in .env
bun run dev
```

Live: see `DEPLOYMENTS.md`.

## What this does NOT do yet

- Bonding, slashing, or dispute games (ERC-8004-style optimistic verification)  
- Automatic test runners in the contract (gate is offchain; hashes are onchain)  
- Multi-accepter multisig or role registry  
- Replacing git or CI — it **binds** their outputs to dual-principal finality  

## Differentiate

| Tool | Lane |
|------|------|
| **CodexBar / quota-axi** | Usage / remaining credits |
| **CI / GitHub checks** | Org-scoped automation; single authority |
| **DoneStamp** | Cross-principal, tamper-evident **completion** receipt |

## Deployments

See [`DEPLOYMENTS.md`](./DEPLOYMENTS.md).

## License

MIT
