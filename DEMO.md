# TwinCheck demo script (~90s)

## One-liner

**I copy addresses from Monad’s official protocols list — TwinCheck shows dual Monadscan + MonadVision verify status on-chain, and pulses when it flips.**

Problem source: [monad-crypto/protocols#369](https://github.com/monad-crypto/protocols/issues/369)

## Setup

- Contract: `0x44071F6881ae0F49dD466198dA2BFe8895D8D72C` (Monad testnet)
- Dashboard: (URL in DEPLOYMENTS.md)
- CLI: `cd cli && bun run src/index.ts`

## Walkthrough

### 1. The problem (15s)

Open issue #369. Official registry has ~1.7k addresses. An address can be verified on one explorer and not the other. No automation.

### 2. Live probe (20s)

```bash
bun run src/index.ts probe --address 0x93FE94Ad887a1B04DBFf1f736bfcD1698D4cfF66
```

Shows dualOK true for the #369 example (now fixed on mainnet) — or pick a split from the dashboard.

### 3. Split card — TwinCheck itself (20s)

TwinCheck contract is **Vision exact_match** and **Monadscan unverified** at deploy time — the exact dual-status failure mode:

```bash
PROBE_CHAIN_ID=10143 MONADSCAN_BASE=https://testnet.monadscan.com \
  bun run src/index.ts card --address 0x44071F6881ae0F49dD466198dA2BFe8895D8D72C
```

Dashboard card: scan ✗ · vision ✓ · not dual.

### 4. Dual-principal settle (20s)

Show two report txs (A then B) on explorer — both must agree before settle.

### 5. Registry sample (15s)

```bash
bun run src/index.ts run --limit 4
```

Loads live CSV from GitHub, probes real explorers, posts cards.

## Receipts (example run)

| Action | Tx / note |
|--------|-----------|
| Deploy | broadcast `DeployTwinCheck.s.sol` → `0x44071F…D72C` |
| Watch + split self-check | scan false, vision true, settled |
| Issue #369 example dual OK | settled dualOK true |
| Unverified registry row | both false |

## Judging checklist

- [x] Real contract on Monad testnet  
- [x] Live web demo (no hardcoded success toasts)  
- [x] Public problem citation (#369)  
- [x] Zero mocks in checker path  
- [x] Dual principal A/B  
