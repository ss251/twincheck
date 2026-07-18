# PHASE 2 — DECISION (repo-atlas driven; AdminPulse rejected)

**Anchors:** `research/REPO-ATLAS.md` (primary) + `research/FIELD.md` (context only).  
**ANTI-TROPE GATE applied first.** Ideas without a named atlas entry + concrete GAP are deleted.

---

## Explicit rejections

### AdminPulse / rug-checker / generic DeFi-safety (REJECTED — trope)
Any “paste protocol → can admin rug?” or “security score for DeFi” product is the **textbook** model prior. It does **not** require reading a Monad repo. User veto: AdminPulse is dead.  
**Anti-lesson from atlas B4:** `Neverland-Money/neverland-admin-roles-indexer` shows real teams build **protocol-specific** admin indexers — generalizing that into universal AdminPulse is the trap.

### Other anti-trope / saturation deletes
| Idea | Why deleted |
|------|-------------|
| Parallelism visualizer / MNEI | **pev already shipped** (atlas B5); issue #164 is obsolete as product opportunity |
| Nth escrow / milestone pay | Spark clones: Pabandi, MilestonePay, AuditSplit — **saturated** |
| Agent spend leash | LEASH Spark entry (FIELD) |
| Habit streak / social vouch | Spark saturated |
| Generic “Monad dashboard” / faucet / NFT mint / orderbook DEX | Classic tropes; no unique atlas GAP |
| “One more Kuru indexer” | `kuru-terminal` already compares 8 indexers (A7) |
| Finish easy-agent MCP framework | Multi-week framework, not 1-runway personal outcome |

---

## Surviving candidates (must cite atlas GAP)

### C1 — **TwinCheck** (PICK) ← atlas **G1**

> **A Monad integrator (wallet, aggregator, bot, or protocol PR author) who copies addresses from the official `monad-crypto/protocols` list** has the problem that **an address can be source-verified on one Monad explorer and not the other, with no machine-readable dual status on the list**; today they **open Monadscan and MonadVision by hand for each of ~1.7k registry addresses (or hope)**; with **Monad’s cheap high-frequency txs + dual official explorers + a living address registry** we **publish continuous dual-verify cards + an on-chain pulse when dual-status flips for watched registry addresses**, which is worse elsewhere because **this is a Monad-local split (MonadVision vs Monadscan) on Monad’s own coordination repo — not a generic Etherscan badge**.

**Provenance (exact):**  
- Repo: https://github.com/monad-crypto/protocols  
- Gap: open issue **#369** — *“automatic check that all contracts mentioned here are verified on both monadvision and monadscan”*  
- Evidence: clone `{SCRATCH}/repos/protocols`, CSV **1761** addresses; issue body cites `0x93FE94Ad887a1B04DBFf1f736bfcD1698D4cfF66`; pev `probe-contract-labels.ts` **explicitly refuses** to scrape MonadVision and only uses one Sourcify path.

### C2 — Protocols↔pev label join (WEAK)

> Indexer maintainer needs human names for hot contracts…  
**Atlas G2.** pev already half-solves via YAML + Sourcify. Weak “finally” reaction; easy to become a spreadsheet. **Demote.**

### C3 — Neverland-style admin feed for “my” protocol (DELETE as Spark pick)

> Protocol operator needs ACL history…  
**Atlas G3 / B4.** Real but either fork Neverland’s indexer for one protocol (not general) or collapses into AdminPulse trope. **Delete for this goal.**

---

## Filters for C1 TwinCheck

| Filter | Verdict | Evidence |
|--------|---------|----------|
| **ANTI-TROPE** | **PASS** | Requires finding **protocols#369** + dual explorer names + registry CSV. Not “rug checker,” not “verifier UI” in the abstract — **dual-explorer integrity for Monad’s official address book**. |
| **F1 demand** | **PASS** | Verbatim open issue on the foundation/ecosystem repo: automatic dual verification for all listed contracts ([#369](https://github.com/monad-crypto/protocols/issues/369)). pev maintainers document they will **not** scrape the second explorer ([`probe-contract-labels.ts`](https://github.com/Silk-Nodes/pev)). FIELD: builders brag about verifying on **both** MonadVision and Monadscan as a ship bar. |
| **F2 Monad load-bearing** | **PASS** | (1) Dual explorers + `monad-crypto/protocols` are **Monad-specific coordination**. (2) Continuous re-check + public **on-chain pulse** of status flips uses cheap frequent writes/events (Monad edge from FIELD). A private spreadsheet is not a shared integrity signal for integrators. Second-party: dual-principal attest of scan results fits two funded keys. |
| **F3 incumbent** | **PASS** | Nearest: manual dual browser tabs; single-path Sourcify (pev enrichment / BlockVision Sourcify API); Etherscan-style single-explorer badge. **Nothing** continuously dual-checks the official protocols CSV and posts flips. |

---

## Rank

| Candidate | Demand × Monad-fit × 1-runway × Finally | Notes |
|-----------|------------------------------------------|-------|
| **C1 TwinCheck** | **5 × 5 × 4 × 5 = high** | Named issue, 1-day CLI+contract+dashboard feasible |
| C2 label join | low-medium | pev owns the surface |
| C3 admin feed | reject | trope / occupied |

---

## PICK

**TwinCheck**

### USER-OUTCOME wedge (one sentence)
**When I copy an address from Monad’s official protocols list, I immediately see whether source is verified on both Monadscan and MonadVision — and I get a public on-chain pulse if that dual status ever flips.**

### Who / job / today
| | |
|--|--|
| **Who** | Integrator / protocol PR author / bot builder using `monad-crypto/protocols` |
| **Job** | Trust that a listed address has dual-explorer source before wiring it into production |
| **Today** | Hand-open both explorers (or skip); no automation on the list (#369 open since Apr 2026) |

### Exact provenance
```
repo:  github.com/monad-crypto/protocols
gap:   issue #369 — automatic dual verify (MonadVision + Monadscan) for all listed contracts
extra: pev will not scrape MonadVision; 1761 mainnet addresses in protocols-mainnet.csv
clone: {SCRATCH}/repos/protocols
```

### 1-runway shape (post-veto only — NOT building now)
- **Contract:** watchlist of registry addresses + dual-principal **attest** of `{scanOK, visionOK, checkedAt}` + **Pulse** event when either bit flips.  
- **CLI:** ingest `protocols-mainnet.csv` (or paste address), probe both explorers’ public verify signals, attest with keys A/B.  
- **Dashboard:** registry dual-status table + recent pulses from chain logs.  
- **Honest limits:** v1 is dual **presence** of source verification, not bytecode equality proof across explorers and not a security audit.

### Personal problem (Spark axis)
We already ship against Monad explorers/Sourcify and the official address map; dual-status is a real friction the foundation repo itself filed and left open — not a synthetic “DeFi safety” category.

---

## Surface for veto (no build until approved)

| Field | Value |
|-------|--------|
| **Pick** | TwinCheck |
| **USER-OUTCOME** | When I copy an address from Monad’s official protocols list, I immediately see whether source is verified on both Monadscan and MonadVision — and I get a public on-chain pulse if that dual status ever flips. |
| **Repo + gap** | `monad-crypto/protocols` · issue **#369** (dual MonadVision + Monadscan automatic check) |
| **Rejected** | AdminPulse and all generic rug-checker / DeFi-safety tropes |

**Reply:** `approve` · `veto` · `pivot <note>`  
Implementation stays blocked until then.
