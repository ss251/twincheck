# TwinCheck security notes (solidity-auditor pass)

Scope: `src/TwinCheck.sol` only (new product). Dead `DoneStamp` / `FleetLedger` out of scope.

## Threat model

- Attestors A/B are **trusted reporters** of off-chain explorer signals (not oracles for bytecode safety).
- Attackers may not forge attestor signatures without keys.
- Users must not treat dualOK as an audit — only dual **presence** of source verification.

## Findings (manual + property tests)

| Sev | Finding | Status |
|-----|---------|--------|
| Low | Attestors can report incorrect explorer status (oracle honesty) | Accepted by design — dual principal reduces single-key lie; evidenceHash binds payload |
| Low | No pause / upgrade | Immutable attestors — intentional for hackathon simplicity |
| Info | Watchlist grows unbounded | Acceptable for registry sample; batch watch used |
| Info | First settle does not emit Pulse (only flips) | By design |
| None | Reentrancy / token handling | N/A — no ETH/token transfers |
| None | Access control bypass | `onlyAttestor` on watch/report; constructor rejects zero/same |

## Mitigations present

- Immutable dual attestors set at deploy
- Settle only when both attestors post **matching** bits
- Mismatch waits (no partial settle)
- Zero address rejected on watch
- Comprehensive Foundry tests (`test/TwinCheck.t.sol`)

## Residual risk

Without an independent watcher network, both keys in one operator's `.env` collapse dual-principal trust. Production should separate keys and rotate attestors via governance.
