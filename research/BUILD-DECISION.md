# BUILD-DECISION — BuildAnything Spark (deadline 2026-07-19 23:59 UTC)

**PICK: FleetMeter** (full spec: research/IDEAS.md #1). Verdict chain: opus synthesis ranked
it #1 → platform deep-dig returned **GO** (research/PLATFORM-DIG.md) → gates drafted
(DAY1-GATES.md). Decision is LOCKED; only a DAY1-GATES kill criterion reopens it.

## One-sentence wedge (law 7, evidence-backed)

**"We are the only entry putting a multi-account, multi-provider agent fleet's shared quota
pool onchain"** — platform dig enumerated ~15/54 visible entries + full X surface: zero
quota/fleet-metering entries; nearest analogs are Refilr (single-owner gas top-ups, own
vault) and LEASH (one agent's crypto spend leash), neither a cross-provider commons.

## Scoring (judge-appeal × feasibility × ratio × portfolio-fit, /10 each)

| Candidate | Judge-appeal | Feasibility (1 day) | Ratio/lane | Portfolio-fit | Π |
|---|---|---|---|---|---|
| **FleetMeter** | 9 — authentic dated pain + onchain load-bearing + thin agent-infra lane | 8 — one small contract + quota-axi hook (exists) + tiny dashboard | 8 — agent-infra ≈ 3/54 entries; consumer pile ≈ 40+ | 9 — quota-axi, epoch discipline, fleet doctrine are OURS | **5184** |
| ProofOfDone | 7 — clean primitive, but ERC-8004 validator already submitted + Blackboard adjacency | 8 | 5 — verification lane occupied | 8 | 2240 |
| ExpiryKeeper | 6 — weakest onchain-is-load-bearing case | 9 | 6 | 8 | 2592 |

Ratio context (law 2): single track, 54 entries → ~13.5:1 per prize; but the *effective*
lane (agent-infra) is ~3 entries deep against 4 prizes' worth of judge attention.

## Rubric-to-feature mapping (law 1 — no numeric rubric exists; axes from platform dig)

| Judge axis (verbatim source) | Feature answering it |
|---|---|
| "solve a real problem YOU have" | The dated Grok fire-drill IS the origin story; quota-axi is pre-existing daily tooling |
| "most elegant" + "practical impact beats fancy tech" | 3 functions, 1 contract, no framework; the demo is the daily workflow |
| AI judge: no pre-start code, no placeholders, honest commits | Fresh repo after gates; real MON txs; real quota numbers (G8) |
| Anti-slop "Mystery Box"/"Vaporware" kills | Verified source + explorer links + live dashboard, disclosure of what's NOT built (bonding/slashing = future) |
| Viral lane | Build-in-public thread w/ fire-drill screenshot, demo clip, fork CTA |

## Demo plan (law 6) — ≤3 min, testnet (first-class per submission form)

Split-screen terminal + explorer + dashboard: real fan-out → receipts land live → 80%
SoftStop flashes → next spawn **DENIED on camera** by `canSpawn` → close on verified
contract + append-only trail. Rehearsal gate G9 at ~16:00 UTC Jul 19; recording ≥20% of
build budget.

## Do-NOT-build list (law 3 traps + atlas findings)

- Bonding/slashing/reputation — scope-killer; one slide of future vision only.
- Off-chain DB + "we'll decentralize later" — dies on the "why onchain" question; the
  multi-machine/multi-account trust story IS the answer, keep it front.
- Refilr-style auto-top-up execution — their lane, invites direct comparison to a more
  polished incumbent entry.
- Any reuse of old repo code (AI judge scans history) — reference prior art in README.

## Kill criteria + fallback (law 8)

Inherited from DAY1-GATES.md verbatim: rival discovery cutoff 12:00 UTC Jul 18 (passed GO —
now demo-differentiate only) · chain-gates failure → withdraw to Arc CP1 + Build Week ·
G7 degradation acceptable · submit-stop 20:00 UTC Jul 19 ships whatever passes.
Fallback build: ProofOfDone (#2) ONLY on pre-noon rival discovery; never post-noon.


## Judge personal-taste note (LEG-M4, 2026-07-18) — pitch adjustment
- **Harpalsinh Jadeja (Sr DevRel):** grades usable agent-craft + shipped demos OVER benchmarks; anti-benchmaxxing ("use-it-or-it's-noise"); standing OSS champion ("open source ftw", values OSS L1s that contribute back); first-principles AI literacy. → STRONG fit for FleetMeter. ACTION: make the repo genuinely OSS with a clean "fork it, join the commons" README; lead with real usage, never metrics.
- **Kacie Ahmed (DevRel):** build-first, ship-early, "help people not polish-first crypto cosplay"; cares about human+AI learning UX white space; consumer/education lean. → Softer fit (FleetMeter is dev-infra). ACTION: frame the human story hard — "fleet operators silently losing money" is a real-people pain; the OSS-commons ("help other builders not get burned") catches her help-people lens. Do NOT pitch it as pure infra plumbing.
- **AI judge + Harpal favor FleetMeter strongly; Kacie is the one to win with framing.** Net judge-fit: good, contingent on OSS + human-pain-first pitch. This does NOT change the pick (GO holds).

## RED-TEAM demo fix (RED-TEAM-2026-07-18.md, survivability 7/10)
Loss-reason: "why onchain?" is unanswerable if all 4 seats are your own accounts on your own
machines (tamper-evidence only defends against editing your own log; niche pain illegible to a
consumer/DeFi judge in 10s). FIX: re-shoot the demo with a REAL SECOND SIGNER on a shared pool
(devcube + laptop, or Pragadeesh as a second principal) so onchain trust is VISIBLY load-bearing —
a second party who cannot forge your spend and vice-versa. This is the single highest-leverage
change to the demo; do it even at the cost of a feature.
