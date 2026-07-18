# REIDEATION — Monad Spark (post alpha-mine)

**Date:** 2026-07-18 (amended: F1 not limited to seeded pains; field alpha required first)  
**Alpha source:** `research/ALPHA-MINE.md` (native X search, 30d)  
**Deadline:** 2026-07-19 23:59 UTC  

**FleetMeter:** DEAD. **F3 fail** — operator already uses **CodexBar** (+ quota-axi) for usage tracking. Pain was manufactured.

### Filter definitions

| Filter | Meaning |
|--------|---------|
| **F1 REAL ITCH** | Pain the operator **genuinely feels** (this week or ongoing ops). May be seeded pains **or** field alpha that is also his — not invented for the prize. |
| **F2 MONAD LOAD-BEARING** | Needs cheap high-frequency blocks **or** a written “why not a database” answer with a **genuine second party / trust boundary**. |
| **F3 NOT ALREADY SOLVED** | Name a real incumbent the operator uses and why it does not cover this. |

---

## Candidate 1 — DoneStamp (dual-principal completion receipts)

**Wedge:** When an agent says “done,” a deterministic gate hashes evidence and a **second principal** re-runs and co-signs onchain — authorised is not compliant; vibes cannot replace proof.

| Filter | Score | Written answer |
|--------|-------|----------------|
| **F1** | **PASS (10/10)** | **Local:** pasted-proof discipline + unattended loops exist because agents claim done without checkable evidence (`IDEAS.md` #2; this week’s goal-mode work). **Field:** “wallet can prove authorised… cannot prove the agent did what you asked” ([ChiChi](https://x.com/Nnenne070/status/2078152613917233569)); need evals for *completed task* not *looked right* ([MrRuSs3LL](https://x.com/mrru5s3ll/status/2077319339100037160)); approval/finishes UX is top engagement ([Edward Luo](https://x.com/edwardluox/status/2078111197212414447), 2.1k♥). Seed list example + field loudness + operator doctrine = same itch. |
| **F2** | **PASS (9/10)** | Local DB fails: worker machine rewrites its log. **Worker EOA** commits hashes; **accepter EOA** co-signs only after re-hash. Neither forges the other; `block.timestamp` is shared clock. Monad cheap/fast blocks make per-task receipts free (same gas argument as [SpringX on Monad](https://x.com/MonadCommunity/status/2075137783077937245)). |
| **F3** | **PASS (8/10)** | **Incumbents:** CodexBar (usage), git, CI, Claude/Codex transcripts, local markdown proofs. **Gap:** none are dual-signature, tamper-evident **completion** objects across principals. CI is single-org; git is force-pushable; CodexBar does not co-sign “done.” Spark **LEASH/Refilr** are spend/gas policy, not completion. |

**1-day shape:** already shippable (`DoneStamp.sol` + CLI + dashboard live).

---

## Candidate 2 — PulseWatch (onchain heartbeat for silent job death)

**Wedge:** Unattended jobs must pulse a shared onchain deadline; a second watcher marks misses when the pulse stops.

| Filter | Score | Written answer |
|--------|-------|----------------|
| **F1** | **PASS (6/10)** | Seeded “silent scheduled-job misses”; field: overnight agents still running ([Jeremybtc](https://x.com/Jeremybtc/status/2078072890847875379)). Real but softer than “done lies.” |
| **F2** | **PASS (7/10)** | Job box A vs supervisor B; shared deadline onchain. |
| **F3** | **WEAK (4/10)** | **healthchecks.io / Dead Man’s Snitch / UptimeRobot** already solve ping-or-alert for most ops. |

---

## Candidate 3 — LogRange / indexer pain (Monad eth_getLogs 100-cap)

**Wedge:** Library/service that pages `eth_getLogs` under Monad’s 100-block limit so dashboards don’t die.

| Filter | Score | Written answer |
|--------|-------|----------------|
| **F1** | **PASS (8/10)** | **Operator hit THIS WEEK** (dashboard skeptic rejection). Field: page getLogs ranges ([SwiftNodes](https://x.com/swiftnodesio/status/2076889232681881663), [paoloanzn adaptive chunker](https://x.com/paoloanzn/status/2075844274978206118)). |
| **F2** | **FAIL (2/10)** | Pure client library; **a database/indexer is exactly the solution**. No second-party trust story. |
| **F3** | **FAIL (3/10)** | The Graph, custom indexers, existing paging snippets. Not Spark “problem YOU have” prize shape. |

---

## Explicit rejections

| Idea | Why |
|------|-----|
| **FleetMeter** | F3 CodexBar |
| **Agent payments / identity rails** | Field promo-heavy; multi-week; not elegant 1d |
| **Approval notch UX only** | Huge engagement but offchain UX; F2 fails |

---

## PICK (post alpha-mine)

### **DoneStamp** — unchanged after field merge

**One-sentence wedge:**

> **"Every agent 'done' is a dual-principal onchain receipt — the worker posts gate hashes, a second accepter re-runs and co-signs, so authorised is not compliant and vibes cannot replace proof."**

**Why it wins after ALPHA-MINE:** field’s loudest agent gap (completion proof + approval) **is** the operator’s pasted-proof itch; Spark gallery has LEASH/Refilr but not dual-principal done; F2 remains two real EOAs; F3 CodexBar orthogonal.

**Status:** Already built end-to-end on Monad testnet (`0x6e234b…31C8`, verified, CLI allow/deny, dashboard live with paged logs). Alpha-mine **reconfirms** the pick rather than replacing it.

---

*Surfaced for veto: if veto, rebuild from Candidate 2 only if F3 is accepted as “healthchecks not multi-party”; do not ship Candidate 3.*
