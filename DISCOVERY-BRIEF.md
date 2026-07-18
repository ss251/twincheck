# Monad Spark — FRESH DISCOVERY BRIEF (no priors)

DISCARD every prior idea. FleetMeter and DoneStamp are DEAD — both failed the same way: a
mechanism (a contract shape) posing as a use case. You are doing a FRESH field research pull.
**Research DRIVES the idea. You do not start from an idea, a primitive, or a seeded pain.**

Event: BuildAnything "Spark" (Monad). Deadline **Jul 19 23:59 UTC**. Solo, new in-window code,
real deployed contract + hosted web demo + public repo, AI judge screens commit history. Axis:
"most elegant solution to a problem YOU have." $500×3 elegant + $500 viral.

Reusable INFRA only (never ideas): foundry setup, TWO funded testnet keys in `.env` (principals
A + B, 3 MON each), CLI/dashboard patterns. Move old idea docs to `research/_archive/`.

---

## PHASE 1 — FIELD PULL (do the WHOLE pull before any idea; write `research/FIELD.md`)

Use your NATIVE X search (x_keyword_search / x_semantic_search directly — NEVER the
grok-x-research skill, recursion) + web + GitHub + the Monad ecosystem's own channels. Every
finding cited with a link. Answer, with evidence:

1. **What's happening on Monad NOW (last 30–60d):** mainnet/testnet state, what the Monad team +
   foundation are pushing/hyping, biggest launches, what's hot, what died. Real activity signals.
2. **What's being BUILT:** scan the 54 Spark submissions + recent Monad hackathon (Blitz, Madness)
   winners + active github.com/monad ecosystem repos + what devs ship on X. Which shapes RECUR
   (saturated — avoid)? Which are thin/empty (whitespace)?
3. **What's being ASKED FOR — THE ALPHA:** verbatim demand — Monad builders/users complaining,
   "someone should build", "I wish X existed", team "we'd love to see", sponsor bounties. Drop
   rhetorical uses. The real idea lives HERE, not in your context.
4. **What WINS on Monad:** past winners + the judges' stated reasons (revealed preference).
   Monad DevRel judges (Harpal, Kacie) value: usable craft + shipped demos over benchmarks, OSS,
   "help people" — verify and extend from the field.
5. **Monad's REAL edge (derive from evidence, don't assume):** what does Monad uniquely enable —
   10k TPS, sub-second blocks, cheap high-frequency execution — that makes some app class
   possible/pleasant here and impractical elsewhere? Show it with what people are actually doing.

## PHASE 1.5 — REPO ATLAS (THE ANCHOR — the idea comes from HERE, not a use-case category)

AdminPulse (rug checker) was a TROPE — the textbook "DeFi safety" app any model names without
looking. The cure is dissecting what is ACTUALLY built + used on Monad right now. Clone/read real
repos (`git clone --depth 1`, or read via GitHub web) and write `research/REPO-ATLAS.md`:

- **The Monad team + ecosystem repos** (github.com/monad-* / the foundation orgs): what's SHIPPED
  vs a stub, the dev-experience gaps, what tooling is missing.
- **The protocols/dapps with REAL traction on Monad** — find the ones with actual TVL / users /
  daily activity (not vapor). What do they do; what do their ACTUAL users complain about or fork
  around; what's half-built that everyone needs.
- **The Spark submissions' repos + recent Monad hackathon winner repos** — read the code. What
  shapes recur (saturated ceiling)? What does nobody finish?

Per repo, a dossier: what it does · shipped vs vapor · traction signal · **the GAP** (the concrete
missing piece a real user needs / the thing everyone forks but nobody completes / the verbatim
complaint from its real users). The idea MUST trace to a specific GAP found here — a named repo/
protocol + the concrete missing piece — NOT to an abstract use-case category.

## PHASE 2 — USE-CASE-FIRST IDEATION (driven by Phase 1 + the REPO ATLAS; write `research/DECISION.md`)

**ANTI-TROPE GATE (apply first, delete on fail):** disqualify any idea an LLM would produce from
priors WITHOUT looking — the canonical examples (rug checker, orderbook DEX, onchain game, faucet,
NFT mint, generic "dashboard"). If the idea is a CATEGORY everyone already names, it is a trope, not
a discovery. Every surviving idea must be traceable to a SPECIFIC repo / gap / complaint you FOUND
in Phase 1.5, something you can point at and say "this exact thing is missing/broken/wanted — here
is the repo and the evidence."

Every candidate stated in EXACTLY this shape or it's deleted:
> **[a specific Monad persona] has [a real problem]; today they [current alternative / incumbent];
> with [Monad's specific edge] we [the fix], which is impossible or worse elsewhere because [reason].**

**HARD REJECT** any idea you can only describe as "a contract/dapp that does X." If you can't name
the WHO + the JOB + the TODAY-ALTERNATIVE, it is a mechanism, not a use case — delete it. This is
the anti-FleetMeter / anti-glorified-contract gate.

Three filters, all in writing, each citing the Phase-1 evidence:
- **F1 real field demand** — cite the post/source proving someone actually wants this.
- **F2 Monad load-bearing** — answer "would a database or another chain do this?" (needs Monad's
  speed/throughput/cheap-high-freq, or a genuine second-party trust boundary).
- **F3 incumbent** — name the tool that's nearest today and why it doesn't cover this.

Rank by **demand intensity × Monad-fit × 1-runway shippability × the "finally, someone built this"
reaction.** Pick ONE. Its wedge is a USER OUTCOME sentence, not a mechanism.

## PHASE 3 — SURFACE, then build
Surface the pick + wedge sentence + the who/job/today-alternative BEFORE building, so the user can
veto in one line. Then build end to end (contract + tests + deploy + verify on explorer + hosted
demo + README + DEMO.md). ZERO MOCKS, honest commits.
