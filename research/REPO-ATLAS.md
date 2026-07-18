# PHASE 1.5 — REPO ATLAS (anchor)

**Method:** shallow clones into `{SCRATCH}/repos/` + GitHub issues/API + live explorer probes.  
**Scratch path:** `/var/folders/nc/j5wdfhws2q56jzdcj_jkdvww0000gn/T/grok-goal-df456f9b378b/implementer/repos/`  
**Not used as inputs:** AdminPulse, FleetMeter, DoneStamp (tropes / dead).

Every dossier ends with a **GAP** that is a concrete missing piece found in *this* repo or its issues — not a category invented offline.

---

## A. Monad team / ecosystem orgs

### A1. `monad-crypto/protocols`
- **Clone:** `{SCRATCH}/repos/protocols` · https://github.com/monad-crypto/protocols  
- **What it does:** Official ecosystem address book. Per-protocol `.jsonc` under `mainnet/` + `testnet/`, rollup CSVs (`protocols-mainnet.csv` = **1761 rows / 1761 unique addresses** at pull). Used for ecosystem coordination (wallets, indexers, dashboards copy these addresses).  
- **Shipped vs vapor:** **Shipped and actively PR'd.** 186 mainnet jsonc files; ~137 marked `"live": true`. Some entries are **stubs** (addresses empty or fully commented): e.g. `0x.jsonc` (all settler addresses commented out), `axal.jsonc`, `hyperlane_nexus.jsonc`, `mintto.jsonc`, `monad_space.jsonc`.  
- **Traction:** **Canonical** — 256+ forks on GitHub org listing; DefiLlama/builders treat it as the address map for Monad mainnet.  
- **GAP (verbatim + structural):**  
  1. **Open issue #369** (2026-04-18, still OPEN, 0 comments): *“automatic check that all contracts mentioned here are verified on both monadvision and monadscan”* with example `0x93FE94…F66` (Wormhole NTTWithExecutor) claimed verified on MonadVision but not Monadscan at report time. URL: https://github.com/monad-crypto/protocols/issues/369  
  2. Repo ships addresses **without** any verification-status field, CI gate, or dual-explorer badge. Integrators who trust this list still hand-click explorers.  
  3. Stub entries (0x, etc.) sit next to live TVL protocols with no “incomplete entry” signal.

### A2. `monad-crypto/token-list`
- **Clone:** `{SCRATCH}/repos/token-list` · https://github.com/monad-crypto/token-list  
- **What:** Standardized token metadata JSON for mainnet/testnet.  
- **Shipped:** Yes (`tokenlist-mainnet.json`, assets, uv tooling).  
- **Traction:** Ecosystem convenience list; README **explicitly** disclaims diligence: *“No due diligence or verification is performed on token issuers.”*  
- **GAP:** Metadata list ≠ source-verification list. No link from token entry → dual-explorer verification of the token contract. Complements A1 gap (addresses without verify integrity).

### A3. `monad-crypto/monad-solonet`
- **Clone:** `{SCRATCH}/repos/monad-solonet`  
- **What:** Docker/Lima full local Monad network (RPC :8080, forge/cast baked in).  
- **Shipped:** Yes, image `monadcrypto/monad-solonet`.  
- **Traction:** DevRel path for local testing; heavy host requirements (Colima 16GB/300GB notes).  
- **GAP:** Ops docs still community-proposed (protocols issues #167/#173 Docker guides). Not product-shaped for Spark “daily problem” unless you are a node runner.

### A4. `monad-crypto/MIPs`
- **Clone:** `{SCRATCH}/repos/MIPs`  
- **What:** MIP static site (MIP-1…MIP-12 including block-time / vote-pace changes).  
- **Shipped:** Spec docs.  
- **GAP:** Specs, not apps. MIP-12 is network-level (300ms blocks) — enables high-freq tools elsewhere, not a product gap itself.

### A5. `monad-developers/foundry-monad`
- **Clone:** `{SCRATCH}/repos/foundry-monad`  
- **What:** Foundry template defaulting to `monadTestnet`.  
- **Shipped:** Thin template (Counter-class).  
- **Open issues:** Windows/SSH docs (#27), OZ init friction (#12), spam vuln claim (#22).  
- **GAP:** Onboarding friction only — not a unique app wedge.

### A6. `monad-developers/scaffold-eth-monad`
- **Clone:** `{SCRATCH}/repos/scaffold-eth-monad`  
- **What:** Scaffold-ETH fork (Next/Hardhat/Wagmi) for Monad.  
- **Shipped:** Full scaffold.  
- **GAP:** Generic dapp starter — saturated shape.

### A7. `monad-developers/kuru-terminal`
- **Clone:** `{SCRATCH}/repos/kuru-terminal` · live https://kuru-terminal.vercel.app/  
- **What:** **Reference multi-indexer** for Kuru orderbook events (Goldsky, Allium, Envio, Ponder, QuickNode, TheGraph, Alchemy, thirdweb) + frontend that **compares indexer performance**.  
- **Shipped:** Yes (multi-subdir services + compare UI).  
- **Traction:** Official DevRel teaching tool for high-freq Monad indexing.  
- **GAP:** Proves indexing Kuru-class event streams is hard enough to need **eight** backends; does **not** solve dual-explorer verification or address-book integrity. Compare page is pedagogical, not a protocol-registry product.

### A8. `monad-developers/easy-agent`
- **Clone:** `{SCRATCH}/repos/easy-agent`  
- **What:** Demo agent framework (CN readme).  
- **Shipped vs vapor:** Chatbot + tools **done**; roadmap **open**: Session, Prompt mgmt, Memory, RAG, **MCP**, multi-agent, Swarm all unchecked.  
- **GAP:** Unfinished agent infra — but “finish MCP agent framework” is multi-week and not a personal daily pain for Spark solo runway.

### A9. `monad-developers/speed-test`, `community-resources`, `ecosystem-addresses`, `safe-deployments`
- **speed-test:** Counter spam demo of throughput — shipped, educational.  
- **community-resources:** Link dump, not product.  
- **ecosystem-addresses / safe-deployments:** Address packages for Safe/ecosystem — reinforce that **address lists are first-class infra** without verify status.

### A10. Category Labs core (`category-labs/monad`, `monad-bft`, `monad-revm`, …)
- **Not fully cloned** (large C++/Rust node).  
- **What:** Execution + consensus + revm extension.  
- **Shipped:** Production mainnet clients (v0.15.x, MIP-12).  
- **GAP for app builders:** Node-level; consumer tools are pev / kuru-terminal / protocols list, not reimplementing execution.

---

## B. Protocols / dapps with REAL traction (repo-backed)

### B1. Aave V3 on Monad (registry + upstream)
- **Registry:** `protocols/mainnet/aave_v3.jsonc` — **77** non-comment addresses (Pool, aTokens, oracles, ACL, …). Upstream github: https://github.com/aave-dao/aave-v3-origin  
- **Traction:** Largest DefiLlama lending slice on Monad (~$250M+ class at FIELD pull).  
- **GAP for *this* atlas (not AdminPulse):** Address surface is huge; official Monad registry lists them **without dual-verify badges**. Integrators wiring aTokens from CSV still cannot programmatically assert “source on both explorers.”

### B2. Curvance / Euler / Morpho / Pendle / Uniswap / Neverland (registry)
- **Registry files:** `curvance.jsonc` (58 addrs), `euler.jsonc` (57), `morpho.jsonc`, `pendle.jsonc`, `uniswap.jsonc`, `neverland.jsonc` (**132** addrs).  
- **Traction:** Multi-tens-to-hundreds of $M TVL band (FIELD / DefiLlama).  
- **GAP:** Same registry integrity problem at scale — hundreds of addresses, no automated dual-explorer gate before copy-paste into a bot/UI.

### B3. Kuru (orderbook DEX) — `Kuru-Labs/*`
- **Clones:** `{SCRATCH}/repos/kuru-sdk`, `kuru-sdk2`, `kuru-trading-skills`  
- **Repos:** https://github.com/Kuru-Labs/kuru-sdk · contracts public under Kuru-Labs  
- **What:** CLMM/orderbook SDK + Bun trading skills (USDC/WMON/AUSD allowlist).  
- **Traction:** Native Monad CLOB; DevRel built `kuru-terminal` around it; pev labels call out Kuru markets as high-conflict.  
- **GAP:** Trading skills assume correct token/router addresses; still no dual-verify of allowlisted contracts. Indexing complexity is documented, not unfinished in a way a 1-day solo app closes better than kuru-terminal already does.

### B4. Neverland — `Neverland-Money/neverland-admin-roles-indexer`
- **Clone:** `{SCRATCH}/repos/neverland-admin-roles-indexer`  
- **What:** **Envio HyperIndex only for lending admin/timelock surfaces** (ACL roles, GovernanceTimelock, RiskTimelock, Safes). Explicitly does **not** index user activity.  
- **Traction:** Neverland live on Monad; this is production governance observability for **one** protocol.  
- **GAP / anti-lesson:** Protocol teams who care build **narrow admin indexers for themselves**. A generic “rug checker for all DeFi” is the trope; Neverland’s repo is evidence that **real** need is protocol-specific role feeds — not another universal AdminPulse. Do **not** generalize this into AdminPulse 2.0.

### B5. pev — `Silk-Nodes/pev` (ecosystem tooling with real usage)
- **Clone:** `{SCRATCH}/repos/pev` · live https://pev.silknodes.io  
- **What:** Parallel Execution Visualizer — mainnet traces, conflict graphs, per-contract parallelism scores, public API.  
- **Shipped:** Full product (indexer, Next app, labels, changelog, deploy runbooks).  
- **Traction:** Answered the community “parallelism tool” ask; closed the spirit of protocols issue #164 (MNEI proposal) in practice.  
- **GAP (documented in-repo):**  
  1. Labels are **hand YAML** + ERC-20/Sourcify probe — **explicitly will NOT scrape MonadVision** (`scripts/probe-contract-labels.ts` lines 18–21). Many labels still need human TODO research.  
  2. Enrichment hits `repo.sourcify.dev`; audit path hits `sourcify-api-monad.blockvision.org` — **one-sided verify**, not dual Monadscan+MonadVision.  
  3. DELEGATECALL impl targets may be missing (README limitation).  
  → pev proves parallelism tooling exists; it does **not** implement dual-explorer registry checks (A1#369).

---

## C. Spark + Monad hackathon submission repos (code read)

| Repo (clone under `{SCRATCH}/repos/`) | Shape | Shipped? | GAP / note |
|--------------------------------------|-------|----------|------------|
| `jweezy119/Pabandi-Escrow` | Booking deposit escrow | Contract + docs; address “deploying during window” | Escrow trope; reservation-specific |
| `Zubimendi/milestonepay` | Freelance milestone escrow | Hardhat + state machine | Escrow trope (saturated) |
| `alva-p/spark-buildAnything-hackaton` (AuditSplit) | Bounty split vaults | Live app + mainnet notes + Foundry tests | Niche collab-bounty; polished |
| `Zhekinmaksim/buildnothing` | Stake MON to not Claude-Code | Contract + snitch skill | Personal, clever; not ecosystem gap |
| Showcase (no clone): LEASH agent vault, Vouch social stake, Shipped habits, PreFlight judge | Agent leash / social / habits / meta | Mid-hackathon posts | **Saturated shapes** — avoid cloning |

**Recurring Spark shapes (ceiling):** escrow, habit streak, social stake, agent spend leash, meme/game walls.  
**Nobody finishes:** dual-explorer automation for the official protocols list (#369 still open); connecting pev labels to `monad-crypto/protocols` names; general multi-protocol admin indexers (only Neverland-style single-protocol).

---

## D. Cross-cutting GAP shortlist (idea must pick from here)

| ID | Anchor repo / evidence | Concrete missing piece | Trope risk |
|----|------------------------|------------------------|------------|
| **G1** | `monad-crypto/protocols` **#369** + 1761-addr CSV + pev single-Sourcify path | **Automatic dual verification status (MonadVision + Monadscan) for every registry address; continuous re-check; public pulse when status flips** | Low — model does not invent “both explorers disagree” without this issue |
| **G2** | pev `contract-labels.yaml` TODO + protocols names unused | Auto-join official protocol names into pev-class label feeds | Medium — “label dashboard” |
| **G3** | neverland-admin-roles-indexer | Protocol-specific admin event feed | High if generalized → AdminPulse trope (**reject generalization**) |
| **G4** | kuru-terminal | “One more indexer” | High / already solved pedagogically |
| **G5** | easy-agent roadmap | Session/MCP completeness | High / framework |
| **G6** | Spark escrows ×3 | Nth escrow | **Saturated — reject** |

**Primary discovery for ideation:** **G1**.

---

## E. Clone index (audit)

```
{SCRATCH}/repos/
  protocols  token-list  monad-solonet  MIPs
  foundry-monad  scaffold-eth-monad  community-resources  ecosystem-addresses
  easy-agent  kuru-terminal  speed-test  safe-deployments
  pev
  kuru-sdk  kuru-sdk2  kuru-trading-skills
  neverland-admin-roles-indexer
  Pabandi-Escrow  milestonepay  spark-buildAnything-hackaton  buildnothing
```

---

*Atlas date: 2026-07-18. Exhaustive clone of all 56 Spark submissions is a non-goal; Spark sample is code-read + FIELD shapes.*
