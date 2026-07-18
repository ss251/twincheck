# Security review — FleetLedger

**Scope:** `src/FleetLedger.sol` only (Foundry tests and scripts out of scope).  
**Method:** Manual application of the `solidity-auditor` (Pashov) checklist adapted to a single small ledger contract: access control, arithmetic, reentrancy, event integrity, DoS, timestamp assumptions, trust boundaries. Full 12-agent parallel harness was not run as a multi-agent swarm in this environment; findings below are from a complete single-pass adversarial review of the shipping source, then a re-check after fixes.  
**Date:** 2026-07-18  
**Status:** Clean for intended trust model (no unfixed High/Critical). Residual risks documented.

---

## Trust model (explicit)

| Role | Powers |
|------|--------|
| Pool admin (`createPool` caller) | Set ceiling, set orchestrator |
| Seat controller (`registerSeat` caller) | `updateSeat`, `postSpend` / `signalDenied` for own seat |
| Pool orchestrator (optional) | `postSpend` / `signalDenied` for **any** seat in the pool |
| Anyone else | Views only |

**Not in scope / not claimed:** untrusted agents as spenders; oracle-attested costs; bonding/slashing; upgradeability; multi-pool governance.

Units (`uint128` micro-USD) are supplied by a trusted controller/orchestrator. The chain enforces **caps and shared ceiling**, not the honesty of the unit amount.

---

## Findings

### Fixed before ship

| ID | Severity | Issue | Fix |
|----|----------|-------|-----|
| F-01 | Low | `postSpend(0)` allowed free event spam / log pollution | Revert `ZeroUnits` when `units == 0` |

### Reviewed and accepted (by design)

| ID | Severity | Note |
|----|----------|------|
| A-01 | Info | Shared-pool griefing: one seat can fill the pool up to its own cap. Mitigated by per-seat caps + admin `setPoolCeiling`. Documented in README. |
| A-02 | Info | Orchestrator can debit any seat. Intentional trusted metering pipe; clear with `address(0)` or never set. |
| A-03 | Info | Pool admin can lower ceiling below current spent → further spends deny until window rolls. Admin privilege. |
| A-04 | Info | `block.timestamp` window rolls: miner/sequencer skew is a general EVM assumption; Monad fast blocks reduce practical impact. |
| A-05 | Info | `signalDenied` is a public audit trail only when over budget; does not move funds. |

### Checklist (selected)

| Class | Result |
|-------|--------|
| Reentrancy | **Pass** — no external calls / no ETH transfers |
| Access control | **Pass** — controller/orchestrator/admin gates tested |
| Overflow | **Pass** — sums in `uint256`; caps/ceilings `uint128`; Solidity 0.8 checked math |
| Unbounded loops / DoS | **Pass** — O(1) mappings; no arrays |
| Timestamp | **Accept residual** — fixed aligned windows; lazy view + mutate roll |
| Event integrity | **Pass** — Spend emitted after storage update; Soft/Hard on post-state bps |
| Two-principal non-forgeability | **Pass** — B cannot `postSpend` A’s seat (tests) |

---

## Residual risk summary

1. **Trusted unit amounts** — a malicious controller or orchestrator can post inflated units and burn a seat/pool window. Defense is offchain identity of those keys, not the contract.
2. **Admin centralization** on a pool — acceptable for a fleet commons owned by the operators who create it.
3. **No pause switch** — elegance tradeoff; freeze would be a future admin feature.

---

## Re-check

After F-01: `forge test` green including zero-unit revert and full access-control / pool-ceiling / window-roll suite. No remaining High/Critical issues under the stated trust model.
