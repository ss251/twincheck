# TwinCheck — Post-Hackathon Roadmap

Synthesized 2026-07-20 from five audits (A: Product/UX, B: Contract security, C: Code quality/architecture, D: Checker robustness, E: Positioning/growth). Judged deployment (dashboard-pink-one-12.vercel.app + contract `0x44071F6881ae0F49dD466198dA2BFe8895D8D72C`) stays frozen until judging ends **Jul 22**. All work lands on `post-hackathon`, local only.

Already shipped on this branch: **B-M1** (stale-observation replay — observations now consumed on settle) and **B-M2** (evidence hash now binds both attestors' evidence), commit `f89ffd3`, 12/12 TwinCheck tests pass.

---

## BUILD-NOW (this session, ~2–3 h; security > hygiene > product polish)

### 1. Checker robustness: timeouts + retry + honest error signals (D2, D3, D4)
The worst live bug class: a 429/5xx/timeout/hung fetch is currently coerced into "unverified" and can be attested on-chain as a false flip.
- `cli/src/explorers.ts`: wrap `probeScan`/`probeVision` fetches in `AbortSignal.timeout(8000)`; add 2–3 attempt retry with exponential backoff + jitter; return a distinct `signal: "error"` class (429/5xx/timeout/network) separate from a genuine unverified (Sourcify's not-found 404 stays "unverified"; transport failures do not).
- `cli/src/registry.ts`: timeout on `fetchRegistryCsv`.
- `cli/src/index.ts`: `dualReport` refuses to submit on-chain when either probe result is an error-class signal (log + skip, non-zero summary at end of `cmdRun`).
- Tests: unit-test the signal classification (mock fetch).

### 2. Independent dual-principal probes (D1 — the core value-prop fix)
Today `probeDual()` runs **once** and both keys sign the same result — "dual attestation" is one measurement signed twice. Change `cmdCheck`/`cmdRun`/`dualReport` in `cli/src/index.ts` so principal A and principal B each run their **own** `probeDual()` (sequential is fine for now; staggered/separate-infra is a LATER hardening) and each signs its own observation. Contract-side settle already requires the bits to match (and post-f89ffd3, requires both to be fresh).

### 3. `watch` idempotency guard (D6)
`cli/src/index.ts` `cmdWatch --address`: read `getCard`/`watchedAt` first, skip `watchOne` if already watched (matches `cmdRun`'s existing guard). Prevents a revert + burned gas on re-run.

### 4. Repo-hygiene purge: dead FleetMeter/DoneStamp product + dead process docs (C1, C3, C5, C6, C7)
The public repo currently reads 46/53 tests for dead code plus internal AI-orchestration briefs and competitor commentary.
- Delete: `src/FleetLedger.sol`, `src/DoneStamp.sol`, `test/FleetLedger.t.sol`, `test/DoneStamp.t.sol`, `script/Deploy.s.sol`, `script/Bootstrap.s.sol`.
- Delete internal process docs: `GOAL-BRIEF.md`, `DISCOVERY-BRIEF.md`, entire `research/` tree (contains critique of named competitors — the single worst public-optics item).
- Delete dead CLI modules: `cli/src/hash.ts`, `cli/src/quota.ts` + `cli/examples/{spec.txt,evidence-pass.txt,evidence-fail.txt,quota.json}`; drop unused `Hex` import in `cli/src/index.ts` and unused `encodeFunctionData` re-export in `cli/src/client.ts`.
- Rename `dashboard/package.json` name → `"twincheck-dashboard"`.
- Gate: `forge test` shows exactly the 12 TwinCheck tests, all green; `bun test` in `cli/` green; both typechecks clean.

### 5. Fix `dashboard/.env.example` (C2)
Rewrite to the vars `dashboard/src/chain.ts` actually reads: `VITE_TWINCHECK`, `VITE_MONAD_RPC_URL`, `VITE_MONAD_EXPLORER`, `VITE_MONADSCAN`. Remove all `VITE_FLEETLEDGER`/`VITE_POOL_ID`/seat vars. (Currently `cp .env.example .env && bun run dev` yields a silently broken dashboard.)

### 6. Add `LICENSE` (E-gap 6)
MIT at repo root; note it in README. Without it no maintainer can legally take even the checker logic.

### 7. Revive the dead "Onchain pulse" feed (A5)
Feed empties ~40 min after the last attestation (5,000-block lookback), so the liveness surface reads as dead to nearly every visitor.
- `dashboard/src/chain.ts` (lines ~127–162): page logs from the contract's deploy block, cache `fromBlock` + fetched rows in `localStorage`, fetch only new blocks on poll.
- Replace leaked implementation copy "paged ≤100 blocks (Monad RPC)" with human copy.

### 8. Quiet, incremental refresh (A9)
`dashboard/src/App.tsx` (poll at ~372–376, N+1 loop at ~305–335): stop setting `loading=true` on background polls (kills the perpetual "Syncing…" flash); diff-based re-read (only `getCard` per watched target + only new log blocks). Also flattens the RPC cost curve that registry-wide coverage (LATER #1) would otherwise explode.

### 9. Verdict copy: actionable + coherent (A8, A10)
`dashboard/src/App.tsx` / `styles.css` / `index.html`:
- Split/fail cards get a remediation one-liner ("Unverified on Monadscan → verify via foundry + Etherscan API key" / Sourcify link for MonadVision).
- Both-fail caption "agreed: unverified on both" (resolves seam-vs-verdict tension).
- Pending panel names who we're waiting on ("awaiting attestor B").
- Favicon 🐴 → ♊; consolidate the three parallel vocabularies (verified/unverified, Dual OK/Split/Both fail, scanOK/visionOK) down to two.

### 10. README restructure for maintainers (E gaps 1, 3, 4, 5)
`README.md`: lead with the reusable checker, not the contract. Add (a) a zero-config, no-keys "check any address now" quickstart (`twincheck probe --address 0x…`); (b) a "Reusable checker vs. TwinCheck's on-chain trust layer" separation; (c) an "Adopt this" section stating the CI ask (Action link lands post-judging); (d) LICENSE mention.

*Stretch only if time remains: shared ABI module (C4 — generate both `cli/src/abi.ts` and `dashboard/src/chain.ts` ABI from the forge artifact).*

---

## LATER (post-judging, Jul 22+)

**Adoption wedge (highest leverage, in order — from Audit E):**
1. **`twincheck-action` GitHub Action** — wraps existing `probeDual()`; PR mode posts sticky dual-status comment table on registry PRs (turns #369 from detect-after-the-fact into block-at-merge); nightly mode updates a tracking issue / `dual-status.json` artifact.
2. **Issue #369 comment** with artifacts (contract link, Action link, before/after CSV-row example) — post only after judging ends.
3. **PR to `monad-crypto/protocols`** adding `.github/workflows/dual-verify.yml` — after the Action is published/versioned.
4. **Hosted `dual-status.json` feed** (cron-refreshed) — the low-commitment fallback; also what a shields.io badge points at.

**Product (from Audit A):**
5. Watch the actual registry (~1.7k addresses), not 4 — needs multicall/batch reads, card pagination/virtualization, cheaper watch path (A1, L).
6. "Probe this address now" from the dashboard search dead-end — serverless probe endpoint + live twin card marked "live probe — not yet settled onchain" (A2). The conversion moment.
7. Protocol names + categories from the registry CSV on cards; name search (A3).
8. Deep links (`?q=`/`?filter=`) + `/address/0x…` detail view surfacing attestation history, both attestors, and the currently-hidden `evidenceHash` (A4).
9. Status badge SVG endpoint + `GET /card/0x…` JSON API — README-embedded distribution (A6).
10. Watch-my-address + flip notifications on `DualStatusPulse` (webhook/Telegram/RSS) (A7).

**Ops/scale (from Audit D):**
11. Scheduled sweep infra (GitHub Actions cron or launchd) — "runs itself daily" is currently 0% built (D8).
12. Registry CSV caching/ETag + local snapshot fallback (D9).
13. Monadscan Etherscan-V2 API with `ETHERSCAN_API_KEY` instead of 300–470 KB HTML scrapes behind Cloudflare; keep scrape as fallback (D5).
14. Truly independent probe infra (staggered timing / separate runners per principal) — completes BUILD-NOW #2.

**Contract v2 (requires redeploy — judged contract stays as-is):**
15. `reportBatch` + nonce pipelining for the 1.7k-address sweep (D7); `MAX_REPORT_AGE` co-temporality window (B-L1); remove dead `_watchIndex` + meaningless `settlerA/B` fields (B-I1, B-I2); skip re-emit on unchanged bits (B-L2).
16. `SECURITY.md`: document the two structural trust assumptions — key-independence of the two principals is unenforceable on-chain (B-I3) and 2-of-2 has zero fault tolerance / either principal can censor (B-I5).
17. Fuzz/invariant tests for TwinCheck (B coverage gap).

**Deploy & comms (post-judging only):**
18. Vercel production deploy of the improved dashboard (only after Jul 22).
19. X thread / showcase refresh telling the "one measurement signed twice → genuinely independent dual attestation" hardening story.

---

## Explicit non-goals for now
- No pushes to any remote; no `--prod` deploys before judging ends.
- No changes to the judged contract `0x4407…D72C` (v2 items wait for a fresh deploy).
- No external comments/PRs on monad-crypto repos before Jul 22.
