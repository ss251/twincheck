# PHASE 1 — FIELD PULL (Monad / Spark, ~2026-07-18)

Sources: native X (`x_keyword_search`, `x_semantic_search`, `x_thread_fetch`), web (DefiLlama, BuildAnything, KuCoin/PANews on Keone checklist), Monad ecosystem channels. **No grok-x-research skill.** Old idea docs (FleetMeter/DoneStamp) live in `research/_archive/` and are not inputs.

Spark window: **Jul 13 → Jul 19 23:59 UTC**. Theme: *“Build Anything onchain that solves a personal problem.”* Judges: AI Judging Agent + Harpalsinh Jadeja (Sr. DevRel, Monad Foundation) + Kacie Ahmed (DevRel). Prizes: $500×3 elegant + $500 viral. ~**607 registered · 56 submissions** at pull time. [[buildanything.so/hackathons/spark](https://buildanything.so/hackathons/spark)]

---

## 1. What's happening on Monad NOW (last 30–60d)

### Network / capital
| Signal | Evidence |
|--------|----------|
| DeFi TVL ~**$690M** (+~5% 24h; multi-week climb past $500M → $600M+) | [DefiLlama Monad](https://defillama.com/chain/monad); X ATH posts mid-Jul [[post:0](https://x.com/belizardd/status/2077470195296469294)] [[post:6](https://x.com/VargaZo27444506/status/2078184856752623646)] |
| Stablecoins mcap ~**$561M**; RWA active mcap ~**$382M** | DefiLlama |
| DEX vol ~$40M/24h; perps ~$36M/24h; **~3.57M tx/24h**, ~13.5k active addresses | DefiLlama |
| Mainnet since **2025-11-24**; $MON ~$0.022, FDV >> float | DefiLlama / ecosystem recaps |
| **MIP-12**: block time **400ms → 300ms**, hard fork ~**Jul 23** (v0.15.1); Keone: “more improvements every day” | [[post:27](https://x.com/keoneHD/status/2078003487812559121)] |

### What the team / foundation is pushing
- **Blue-chip DeFi flood**: Aave V3 (markets hit ~$100M quickly), Pendle, Maple/syrupUSDC, Ethena sUSDe, MetaMask Money Account, Euler, Morpho, Curvance, Perpl, LFJ, etc. [[post:1](https://x.com/WorldOfMercek/status/2074487535808491963)] [[post:5](https://x.com/0xifreqs/status/2073400425508700377)] [[post:7](https://x.com/mikeinweb/status/2073745509798346899)]
- **Payments / consumer finance**: Rain agent-enabled **cards**, Blend neobank stack, Ramp Network, Stripe/Visa/Mastercard/Cloudflare narrative [[post:1](https://x.com/WorldOfMercek/status/2074487535808491963)] [[post:11](https://x.com/monad/status/2064425380400726337)]
- **Agents + cards**: official line — *“For businesses to use agents at scale, they need guardrails built in”* + Rain [[post:11](https://x.com/monad/status/2064425380400726337)]
- **Monad Cards** onchain (SBT / identity pass); Kuru Agent Arena uses card as access [[post:28](https://x.com/mrWolf4444/status/2077092662864236788)] [[post:104](https://x.com/hi_vecna/status/2077797623491420296)]
- **Security tooling inside house**: Ultrafuzz (agentic Solidity fuzz orchestrator) — Keone: reach out to @aviggiano to pilot [[post:33](https://x.com/keoneHD/status/2067660473592414388)]
- Cadence / MEV, Agent Hub, RWA dashboard — called out in community “Monad summer” recaps [[post:4](https://x.com/Williamnads/status/2077196229210173562)] [[post:7](https://x.com/mikeinweb/status/2073745509798346899)]

### What died / got ugly
- **Echo Protocol eBTC** incident on Monad (~May): unauthorized mint → Curvance borrow path; Keone confirmed network OK, ~$816k stolen from the protocol surface [[post:34](https://x.com/keoneHD/status/2056514249543786937)] [[post:35](https://x.com/keoneHD/status/2056506185973436648)] [[post:96](https://x.com/Chuksdakingz/status/2056513868260692460)]
- $MON under listing price / unlock overhang narrative coexists with TVL ATH [[post:0](https://x.com/belizardd/status/2077470195296469294)]
- Public RPC pain still real for indexers (100-block `eth_getLogs` windows observed in prior build on this repo; Keone notes getLogs perf fixes in v0.14.x but range limits remain operational)

### Activity texture
Capital is **lending-heavy** (Aave, Euler, Morpho, Curvance, risk curators K3/Hyperithm), not pure meme. Perps (Perpl) and order-book DEX (Kuru) exist. Weekly founder ship logs (DeltaV) show agent payments, stealth addresses, DEX aggregators, music NFTs, etc. [[post:86](https://x.com/DeltaV_xyz/status/2077755844800967046)]

---

## 2. What's being BUILT

### Spark (partial enum — X + site; full 56 not scraped page-by-page)
Recurring shapes (often **saturated / thin novelty**):

| Shape | Examples | Saturation note |
|-------|----------|-----------------|
| Habit / streak / daily check-in | Shipped, monadhabit | High |
| Social / squad / games / meme walls | Gmonad-wall, flappy parrot, Squad Verse | High on Showcase |
| Agent spend vault / “leash” | **LEASH** — factory + vault, spend caps, kill switch [[post:59](https://x.com/ChIJiAn28/status/2077760033186779270)] | **Occupied for Spark** |
| Social commitment / show-up stake | **Vouch** [[post:0 Vouch](https://x.com/ChaosWalk3r/status/2078169408849973368)] | Occupied |
| Agent work verification / bonding | ERC-8004 optimistic validator [[post:4](https://x.com/akinjideJa7324/status/2078221100467605581)] | Thin but mechanism-heavy |
| Trading automation | Take-profit bot for Monad [[post:6](https://x.com/emil_pepil/status/2078171701830103214)] | Occupied |
| Wrong-address recovery | Shipping soon on mainnet [[post:5](https://x.com/AreteTyche/status/2078175871018373537)] | Occupied |
| Hackathon meta tools | PreFlight AI co-judge + badge [[post:3](https://x.com/Dancuso419/status/2078253637508173859)] | Meta |
| Community showcase (non-Spark) | 363 projects: walls, games, deploy tools, gifts | Games/social dense |

### Broader Monad builders (not only Spark)
- Lift trading bot (Telegram, multi-chain incl. Monad) [[post:58](https://x.com/liftxyz/status/2078042033936293944)]
- pev — parallel execution visualizer (Silk Nodes) — “paste any contract” [[thread reply on tools wishlist](https://x.com/silk_nodes)]
- MonadAuditAgent (x402-gated audit agent), nullterminal DEX agg, STOA multi-model council, specter stealth, peerfolio deposits, etc. [[post:86](https://x.com/DeltaV_xyz/status/2077755844800967046)]
- x711 “AI agent gas station” (pay-per-use tools, Base+Monad) [[post:61](https://x.com/CripdoeCrypto/status/2070950691359666374)]
- Opsek claims admin/ops security audits as a service (reply to Keone) [[thread](https://x.com/keoneHD/status/2039924020963926374)]

### Whitespace (thin vs saturated)
- **Continuous public admin-risk surface** for Monad protocols (not full SC audit, not generic Tenderly): rare as self-serve product
- **Real-time “admin function was invoked” transparency feed** for top TVL contracts (Keone checklist #3–4)
- Ecosystem explorer/alerts still requested by community (see §3) but partially filled by pev / random dashboards
- Gas/agent funding infra exists in pieces (x711, LEASH) — **not empty**

---

## 3. What's being ASKED FOR — THE ALPHA (verbatim demand)

### A. Cofounder-grade: Admin Audit + 10-point checklist
**Keone Hon (2026-04-03)** — full product ask, not rhetoric:

> “Admin Audit: a new kind of audit that only audits protocols from the perspective of multisig configuration, presence of timelocks on dangerous functions…”  
> “…only focused on asking the question ‘what happens if multisig members get compromised’…”  
> “If you are building this, please reach out.”  
> Foundation: “we at the Monad Foundation would be happy to subsidize.”  
Source: [[post:6 / full](https://x.com/keoneHD/status/2039924020963926374)] · 83k+ views

**10-point self-checklist** (same arc; KuCoin/PANews summary of Keone’s list) — especially:

1. Identify admin functions that can lose funds  
2. Timelock protect those ops  
3. **Real-time monitoring**  
4. **Immediate alerts when admin functions are invoked**  
5–10. Multisig structure, cold devices, rate limits, malware, attacker mindset  
Source: [KuCoin flash](https://www.kucoin.com/news/flash/monad-co-founder-releases-10-point-security-checklist-for-protocols)

**Context that makes the ask real:** Drift-style admin compromise (0s timelock, weak 2/5 after migration) was the industry wound; Omer Goldberg correction thread is the case study [[post:38](https://x.com/omeragoldberg/status/2039472202324799793)]. Monad-local: Echo eBTC mint/borrow path [[post:35](https://x.com/keoneHD/status/2056506185973436648)].

### B. Official agents need money *with guardrails*
@monad: *“For businesses to use agents at scale, they need guardrails built in”* + Rain cards [[post:11](https://x.com/monad/status/2064425380400726337)]  
Reply culture: “Agent money needs guardrails… Spend controls are the real part.” [[post:63](https://x.com/Joshuwa/status/2064432973814874442)]  
LEASH builder: *“Agents need money. Not my wallet. unlimited approve? no… the chain doesn’t care about your config”* [[post:59](https://x.com/ChIJiAn28/status/2077760033186779270)]  
Indonesian reply on Agent Hub: moat = spend cap, expiry, kill switch [[post:60](https://x.com/if1ndretard/status/2076668778658906330)]

### C. Community “one tool you wish existed” (Monad founder community @0x_yash21)
> “What’s one tool, you wish existed that would improve your experience on @Monad? … Ecosystem exploration / Tracking / On-chain monitoring / Analytics/alerts …”  
Replies sampled: *“a proper memecoin scanner”*; *“Ecosystem wide on-chain monitoring and alerts”*; pev shipped for parallelization visualization.  
Source: [[post:35](https://x.com/0x_yash21/status/2057425138384273622)] + thread fetch

### D. Practical daily crypto pain (adjacent, multi-chain)
- Wrong-address sends (builder shipping on Monad) [[post:5](https://x.com/AreteTyche/status/2078175871018373537)]
- Empty gas wallet → agent/tx fails (Bankr bot class of failure) [[post:91](https://x.com/bankrbot/status/2077817095031824639)]
- Freelancer “client co-signs without funded wallet” pitch appears in ecosystem [[post:99](https://x.com/lode_tobi/status/2078144131382300672)]

### Demand intensity ranking (for ideation)
1. **Admin surface / continuous admin monitoring + alerts** — cofounder ask + checklist + live Monad exploit history  
2. **Agent spend guardrails** — official + builders (but Spark-occupied by LEASH)  
3. **Ecosystem monitoring / alerts / scanners** — community wishlist (partially filled)  
4. Social commitment, habits, take-profit bots — real but already mid-hackathon noise  

---

## 4. What WINS on Monad (revealed preference)

### Spark itself
- Axis: **elegant solution to a problem YOU have**; “practical impact beats fancy tech”; “this saved my roommate 20 minutes” > “ZK.”  
- Reject: AI slop UI, tutorial specials, mystery boxes, **vaporware / hardcoded success toasts**. AI judge checks commit timing, live app, mocks.  
- DevRel judges (Harpal, Kacie): craft + shipped demo over benchmarks (consistent with brief; page lists them as judges).  
Source: [Spark page](https://buildanything.so/hackathons/spark)

### Adjacent hackathons / culture
- Blitz / local: “built solo in 6 hours, shipped, demoed live” wins placement [[post:19](https://x.com/Karan_Bisht09/status/2075840016132235295)]
- Moltiverse: agents + real apps across categories [[post:20](https://x.com/monad_dev/status/2026359632344789199)]
- Broader crypto: judges reward **receipts** (live app, verified usage) not vibes [[post:21](https://x.com/Badtheorylabs/status/2075924681601757449)]

### Pattern
Winners look like: **specific person + painful job + working demo in 3 minutes**. Losers look like: generic primitives, five fake features, zero personal stake.

---

## 5. Monad's REAL edge (from evidence, not brochure)

| Edge | Evidence people actually use it for |
|------|-------------------------------------|
| **Sub-second blocks (400→300ms), high TPS, cheap tx** | 3.5M+ tx/day; bots/traders called out as beneficiaries of faster receipts [[post:15](https://x.com/Gnad_InternTH/status/2039938449395134638)]; Lift: ETH bots “don’t fit” Monad’s rhythm [[post:64](https://x.com/liftxyz/status/2063184123007742100)] |
| **Full EVM** | Instant port of Aave/Pendle/Morpho/Uniswap without rewrite — TVL composition is blue-chip proof [[DefiLlama](https://defillama.com/chain/monad)] |
| **High-frequency DeFi + agents + cards** | Perps volume, Agent Hub, Rain cards, Poker Arena 30k agents narrative [[post:62](https://x.com/aixbt_agent/status/2067680891867128103)] |
| **What that enables for *tools*** | Continuous watchers, many small attestations, alert-grade event streams are **economically and latency-pleasant** here; on L1 mainnet with $20 fees they are not |

**Not unique enough alone:** “another lending UI,” “another habit NFT,” “another meme wall” — Showcase is full.

---

## Field synthesis (drives PHASE 2 only)

1. Monad is mid-**liquidity + security maturity** crisis: capital arrived faster than admin hygiene transparency.  
2. Loudest *verbatim* product ask from someone who can fund/subsidize: **Admin Audit + continuous monitoring/alerts**.  
3. Spark field is crowded on habits/social/agent-leash; **admin transparency is not a Spark cliché yet**.  
4. Judging wants **personal daily problem + live non-mock demo**, not a research paper.  
5. Reusable infra only: Foundry, two funded keys (principals A/B), viem CLI/dashboard patterns. Zero FleetMeter/DoneStamp product reuse.

---

*Pulled 2026-07-18. Spark enum partial (~public X + site totals; not all 56 submission bodies opened).*
