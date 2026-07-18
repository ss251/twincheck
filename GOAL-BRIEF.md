# FleetMeter — Grok Goal-Mode Build Brief (start-all / end-all)

You (Grok) are the EXECUTOR building this project to completion under goal mode. This file is
your single source of truth. Read it fully, then work the deliverables in order. Ground truth is
the filesystem + real onchain state — never mocks.

---

## 0. SKILLS TO LOAD (use your native skill discovery on ~/.claude/skills)

Load and APPLY these skills for the phases they cover. They are real skills in this environment.

- **`ethskills`** — EVM / Solidity production knowledge (Monad is EVM-equivalent). Use for ALL
  Solidity: token decimals, gas, event design, oracle/overflow safety, deployment. Say "onchain".
- **`solidity-auditor`** (Pashov skills) — MANDATORY security pass on every contract before it is
  considered done (Deliverable D5). Run it as a real audit, fix findings, re-run until clean.
- **`emil-design-eng`** + **`frontend-design`** — the dashboard must feel intentional, not a
  templated default. Apply these for the UI (typography, spacing, motion, visual point of view).
- **`fable-judgment`** — consult before/at planning if any step is ambiguous.

DO NOT invoke `grok-x-research` or `xalpha-loops` (they wrap your own process → infinite recursion).
For any NEW knowledge you need (Monad-specific tooling, a library), use your native web_search /
open_page directly.

---

## 1. WHAT WE ARE BUILDING (the wedge)

**FleetMeter** — an onchain shared-pool quota ledger for a multi-provider AI agent fleet. One
tamper-evident, append-only ledger that several provider "seats" (e.g. two Claude accounts, Codex,
Grok) register their quota windows and caps into; a hook posts a spend receipt per agent action;
the contract rolls windows by `block.timestamp`, enforces the shared-pool ceiling, and emits
`SoftStop`/`HardStop`/`Denied` events. A `canSpawn(seat, cost)` view is called before any fan-out —
silent quota exhaustion becomes a loud, onchain refusal.

**The real problem (true story, use it in README + demo):** an AI coding fleet burns budget across
4 providers with quota windows that reset on different epochs; there is no shared ledger of which
seat spent what; Grok credits expired *silently* mid-run and it was only discovered when the run
crashed. Doctrine says "per-agent caps are leases on ONE shared pool" — FleetMeter is that pool's
onchain authority.

**Hackathon:** BuildAnything "Spark" (Monad). Deadline **Jul 19 23:59 UTC**. Prizes: 3×$500
"most elegant" + $500 "most viral". Judges: an AI judge (screens for pre-hackathon code, placeholder
data, suspicious commits, AI-slop) + two Monad DevRel humans. Axis: "most elegant solution to a
problem YOU have — practical over technically complex." Requires: public GitHub repo, deployed
**hosted web demo URL**, contract address on Monad (testnet ok), a ≤3-min demo video, a social post.

---

## 2. MONAD BUILD FACTS (verified; see repo research pointers)

- Docs: https://docs.monad.xyz — testnets page has current RPC + chain id + faucet + explorer.
- Testnet RPC + chain id: read from docs.monad.xyz/developer-essentials/testnets (do NOT hardcode a
  stale value — fetch it). Faucet: https://faucet.monad.xyz. Explorer: per the testnets page.
- Foundry deploy + verify: docs.monad.xyz/guides/deploy-smart-contract/foundry and
  /guides/verify-smart-contract/foundry — verified source on the explorer is REQUIRED (elegance +
  anti-slop). EVM differences: docs.monad.xyz/developer-essentials/differences (check opcode/EVM
  version before deploy). Gas: /developer-essentials/gas-pricing.
- Monad has cheap, fast blocks → per-action receipts are effectively free (this is what makes the
  onchain design load-bearing, not bolted on — say so).

---

## 3. CONTRACT DESIGN — FleetLedger.sol (from prior-art research)

Pattern: **minimal live-counter state + rich events for history** (events are the history layer an
offchain indexer/dashboard reads; storage holds only live counters). Rolling-window accounting via
a **token-bucket / linear-decay** pattern (reference: LayerZero RateLimiter, ZELT token-bucket —
you may read them via web). Units: abstract `uint128` micro-USD; per-action cost supplied by a
trusted orchestrator address, not the agent EOA.

Core interface (implement + refine):
- `registerSeat(bytes32 seatId, uint64 windowSeconds, uint128 capUnits)` — a principal registers a
  seat's quota window + cap. Only the seat's controller can register/update it.
- `postSpend(bytes32 seatId, uint128 units, bytes32 receiptHash)` — append-only; auto-rolls the
  window by `block.timestamp`; emits `Spend`, and `SoftStop` at ≥80% / `HardStop` at ≥95%.
- `canSpawn(bytes32 seatId, uint128 cost) view returns (bool)` — pre-fanout gate.
- `remaining(bytes32 seatId) view returns (uint128)`.
- Shared-pool: seats belong to a POOL; the pool has an aggregate ceiling enforced across seats
  (this is the multi-party trust point — a seat cannot silently overspend the shared pool; and the
  RED-TEAM fix below makes this VISIBLE).

Security is not optional — D5 audits this with `solidity-auditor` (reentrancy, access control on
register/post, overflow on window math, timestamp assumptions, DoS via unbounded loops — prefer
O(1) accounting, no unbounded arrays).

---

## 4. RED-TEAM FIX (make onchain trust VISIBLY load-bearing)

Critique: "why onchain? all seats are your own accounts on your own machine — a database would do."
FIX baked into the design + demo: the pool spans **two independent signers/principals** (e.g. this
machine + a second key, or Sailesh + a teammate). Each principal controls its own seats and CANNOT
forge the other's spend, yet both are bound by the shared-pool ceiling on the same contract. The
demo MUST show a second principal so the tamper-evidence is real, not self-defense. This is the
single most important demo property.

---

## 5. DELIVERABLES (goal-mode tracks these; do them in order)

- **D1 — Contract.** `src/FleetLedger.sol` implementing §3. Full Foundry test suite (`forge test`)
  incl. window-roll, soft/hard stop, canSpawn deny, two-principal pool ceiling, access control.
- **D2 — Deploy.** Deploy to Monad testnet; VERIFY source on the explorer. Write the address +
  explorer link into `DEPLOYMENTS.md`. Real MON, real tx (ZERO MOCKS).
- **D3 — Hook/CLI.** A thin TypeScript CLI (`bun`) `fleetmeter`: `post` (reads a real quota source —
  wire to the local `quota-axi` command if present, else a documented stub that reads a JSON file)
  → posts a receipt tx; and `gate` → calls `canSpawn`, exits non-zero to block a spawn. Real viem
  calls to the deployed contract.
- **D4 — Dashboard.** A hosted web dashboard (Vite/Next + `bun`, deploy to Vercel or similar; the
  live URL is a REQUIRED submission field). Shows: registered seats, % used per window, live
  `Spend`/`SoftStop`/`HardStop`/`Denied` events with explorer links, the shared-pool ceiling, and
  the two-principal split. Apply `emil-design-eng` + `frontend-design` — intentional, not templated.
  Must render real onchain data read from events.
- **D5 — Security.** Run `solidity-auditor` on `src/`. Fix all real findings. Re-run until clean.
  Record the audit summary in `SECURITY.md`.
- **D6 — Ship kit.** `README.md` (the true problem story, "why onchain is load-bearing", setup, the
  Codex/agent usage story, an explicit "what this does NOT do yet" boundary section — reads as
  engineering maturity). A `DEMO.md` internal script: one clean allow, one loud `Denied`, the
  two-principal pool ceiling in action — rehearsed, system genuinely live. Do NOT record the video
  (human does that) but produce the shot list + a `submission.md` with all required fields filled.

---

## 6. HARD CONSTRAINTS

- **ZERO MOCKS.** Real contract, real Monad tx, real quota numbers, real dashboard data.
- **Honest commits.** This repo is fresh and in-window (hackathon runs Jul 13–19; today is in
  window). Commit as you go with clear messages; never backdate; never dump a giant squash. The AI
  judge screens commit history — natural cadence matters.
- **Elegance over surface area.** 1 contract, small CLI, focused dashboard. No bonding/slashing/
  governance — those are a single "future" line in the README, not code.
- **Differentiate** in README from Refilr (single-owner gas top-ups) and LEASH (one-agent spend
  leash): FleetMeter = a cross-provider shared quota COMMONS with pool authority.
- **OSS + human-pain-first** framing (judge Harpal values OSS + real usage over benchmarks; judge
  Kacie values "help people" — frame it as helping fleet operators not get silently burned).
- Stop and surface (do not invent) if: Monad testnet/faucet is down, `quota-axi` is absent and no
  stub is acceptable, or a security finding needs a design decision.

## 7. DEFINITION OF DONE
`forge test` green · contract deployed + verified on Monad explorer (address in DEPLOYMENTS.md) ·
CLI posts a real receipt + gates a real spawn · dashboard live at a public URL showing real events ·
`solidity-auditor` clean · README/DEMO/submission complete · a second principal visibly in the pool.
