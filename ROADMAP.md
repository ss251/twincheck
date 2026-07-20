# TwinCheck — Post-Hackathon Roadmap

Synthesized 2026-07-20 from five audits (A: Product/UX, B: Contract security, C: Code quality/architecture, D: Checker robustness, E: Positioning/growth). Judged deployment (dashboard-pink-one-12.vercel.app + contract `0x44071F6881ae0F49dD466198dA2BFe8895D8D72C`) stays frozen until judging ends **Jul 22**. All work lands on `post-hackathon`, local only.

Shipped on this branch: checker retry/error classification, independent per-principal probes, idempotent CLI watch handling, fresh dual-evidence settlement, the legacy-product purge, accurate dashboard configuration, deploy-to-head pulse history, quiet contract-state card refresh, clearer verdicts, the maintainer-focused README, and an MIT license. Current behavior is documented in `README.md` and `SECURITY.md`; deployment facts live in `DEPLOYMENTS.md`.

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
14. Separate probe infrastructure (staggered timing / distinct runners per principal) to strengthen operational independence.

**Contract v2 (requires redeploy — judged contract stays as-is):**
15. `reportBatch` + nonce pipelining for the 1.7k-address sweep (D7); remove dead `_watchIndex` + meaningless `settlerA/B` fields (B-I1, B-I2); skip re-emit on unchanged bits (B-L2).
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
