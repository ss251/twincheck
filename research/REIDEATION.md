# REIDEATION — Monad Spark (FleetMeter is DEAD)

**Date:** 2026-07-18  
**Deadline:** 2026-07-19 23:59 UTC  
**Kill reason for FleetMeter:** the operator already uses **CodexBar** (and related local quota tooling) for usage tracking — the "silent quota death" pitch was manufactured for the hackathon, not a real uncovered itch. F3 fails hard. Do not ship FleetMeter.

**Filters (every candidate must pass all three in writing):**

| Filter | Meaning |
|--------|---------|
| **F1 REAL ITCH** | Pain the operator actually felt **this week**, evidenced in the research corpus / OBJECTIVE pains — not invented for the prize. |
| **F2 MONAD LOAD-BEARING** | Design needs cheap high-frequency blocks **or** fails the "would a database do this?" test with a written answer involving a **genuine second party / trust boundary**. |
| **F3 NOT ALREADY SOLVED** | Name a real incumbent tool the operator uses and why it does **not** cover this. (CodexBar test.) |

Corpus anchors: `research/BUILD-DECISION.md`, `../monad-spark/research/IDEAS.md` (ProofOfDone / ExpiryKeeper), OBJECTIVE pain list (agents claiming done without proof; silent scheduled-job misses; submission-mechanics traps; faucet captcha friction this week).

---

## Candidate 1 — DoneStamp (onchain dual-principal completion receipts)

**Wedge (candidate):** When an unattended agent says "done," a deterministic gate hashes evidence and a **second principal** must re-run and co-sign onchain — vibes cannot replace proof.

| Filter | Score | Written answer |
|--------|-------|----------------|
| **F1** | **PASS (9/10)** | THIS WEEK: the whole **pasted-proof discipline** and unattended-loop doctrine exist because agents claim done without independently checkable evidence (`IDEAS.md` #2: "an agent's 'done' is just its word"; OBJECTIVE: "agents claiming done without proof"). Felt continuously in agent fleet ops, not invented for Spark. |
| **F2** | **PASS (9/10)** | A local DB or markdown log fails because the **worker machine can rewrite its own log**. DoneStamp requires two independent EOAs: **worker** posts `commit(taskId, specHash, evidenceHash, gatePass)`; **accepter** posts `accept` only after re-computing the same hashes. Worker cannot forge accepter's signature; accepter cannot backdate worker's commit. Shared clock is `block.timestamp`. Monad cheap/fast blocks make **per-task receipts free** — high-frequency agent loops need that. |
| **F3** | **PASS (8/10)** | **Incumbents:** git commits, CI logs, Claude/Codex session transcripts, local pasted-proof files, GitHub PR checks. **Gap:** none are a **cross-principal, tamper-evident, dual-signature completion object** the agent and a skeptic both sign. Git can be force-pushed; local proof files are self-serving; CI is single-org and not the same as "agent claimed done, human/auditor co-signed." CodexBar tracks **usage**, not **completion integrity**. |

**1-day ship shape:** one contract (`DoneStamp.sol`), CLI `commit`/`accept`/`check`, dashboard of receipts + allow/deny tape.

---

## Candidate 2 — PulseWatch (onchain heartbeat for silent job death)

**Wedge (candidate):** Scheduled agent jobs must pulse a shared onchain deadline window; a second watcher (or anyone) can mark a miss when the pulse stops.

| Filter | Score | Written answer |
|--------|-------|----------------|
| **F1** | **PASS (7/10)** | OBJECTIVE lists **silent scheduled-job misses** (nobody notices a keeper/cron that quietly stopped). Real ops pain for unattended loops; weaker "this week" dated anecdote in corpus than ProofOfDone, but explicitly named. |
| **F2** | **PASS (7/10)** | Job runs on machine A; supervisor on machine B. A's local log saying "still alive" is worthless to B. Shared **deadline + lastPulse** onchain with `block.timestamp` is the neutral clock. Miss events are append-only. Cheap pulses suit Monad. |
| **F3** | **WEAK (4/10)** | **Incumbents:** healthchecks.io, Dead Man's Snitch, UptimeRobot, launchd/cron mail. **Gap claimed:** multi-agent fleet without another SaaS. **Honest risk:** healthchecks.io already solves "ping or alert" well for most operators — F3 is the soft underbelly. |

---

## Candidate 3 — ExpiryScream (perishable-credit dead-man's switch)

**Wedge (candidate):** Register AI credit / quota expiry epochs onchain; anyone can poke past threshold to emit a loud Expiring/Expired event.

| Filter | Score | Written answer |
|--------|-------|----------------|
| **F1** | **PASS (6/10)** | Grok credits expiry fire-drill is in corpus (`IDEAS.md` #3, BUILD-DECISION) — felt this week. But the **actionable** part is "notice expiry," which overlaps tools that already track windows. |
| **F2** | **FAIL (3/10)** | Payload is mostly an **offchain notification**. A database + cron screams just as loud. Second-party story is thin unless two parties must agree the expiry registry is canonical — forced, not natural. |
| **F3** | **FAIL (3/10)** | **Incumbents:** CodexBar, quota-axi, calendar reminders, provider dashboards. They already surface remaining credits/windows. This is adjacent to the **killed FleetMeter** pain class. |

---

## Explicit rejections

| Idea | Why out |
|------|---------|
| **FleetMeter / quota commons** | **F3 fail.** Operator uses **CodexBar** (+ quota-axi) for usage tracking. Pain was manufactured. |
| **ExpiryScream as primary entry** | F2/F3 fail (offchain notify + already covered by dashboards). |
| **PulseWatch as primary** | Survivable but F3 weaker than DoneStamp; healthchecks.io is a real incumbent. |

---

## PICK

### **DoneStamp**

**One-sentence wedge:**

> **"Every agent 'done' is a dual-principal onchain receipt — the worker posts gate hashes, a second accepter re-runs and co-signs, so vibes cannot replace proof."**

**Demo spine:** (1) clean allow — worker commit + matching accept → `isDone=true`; (2) loud deny — wrong evidence hash on accept → Denied / not done; two independent signers visible on explorer.

**Why this wins F1×F2×F3:** strongest this-week authenticity (pasted-proof / agents-lie-about-done), onchain is load-bearing via **two real EOAs**, not a self-log, and CodexBar does not touch completion integrity.

---

*Surfaced for veto before product contract/UI build. If no veto in-session, implementer proceeds to ship DoneStamp end-to-end.*
