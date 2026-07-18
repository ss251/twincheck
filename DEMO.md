# DEMO.md — DoneStamp (≤3 min)

**Live system only:** real Monad txs, dual EOAs, verified contract, public dashboard.

---

## Pre-flight

1. `forge test` green (DoneStamp suite).  
2. `DEPLOYMENTS.md` address matches explorer **exact_match**.  
3. `.env` has `DONESTAMP`, `PRIVATE_KEY` (A), `PRINCIPAL_B_PRIVATE_KEY` (B).  
4. Dashboard URL loads with stamp address.  
5. Fixtures: `cli/examples/{spec,evidence-pass,evidence-fail}.txt`.

---

## Script

### Beat 1 — The lie (0:00–0:30)

> "My agents say done. That's vibes. Pasted-proof exists because they skip tests. CodexBar knows usage — not completion."

### Beat 2 — Clean allow (0:30–1:30)

```bash
cd cli
bun run src/index.ts commit --task demo-cam-allow \
  --spec examples/spec.txt --evidence examples/evidence-pass.txt --require-pass-marker
# show worker A address on explorer
bun run src/index.ts accept --task demo-cam-allow --evidence examples/evidence-pass.txt
# exit 0; isDone true
bun run src/index.ts check --task demo-cam-allow
```

**Show:** two different EOAs on txs; dashboard Committed → Accepted; explorer links.

### Beat 3 — Loud Denied (1:30–2:30)

```bash
bun run src/index.ts commit --task demo-cam-deny \
  --spec examples/spec.txt --evidence examples/evidence-pass.txt --require-pass-marker
bun run src/index.ts accept --task demo-cam-deny --evidence examples/evidence-fail.txt
echo $?   # 1
bun run src/index.ts check --task demo-cam-deny
echo $?   # 1
```

**Show:** Denied event on dashboard; still pending/not done; "wrong evidence cannot co-sign."

### Beat 4 — Close (2:30–3:00)

Verified source + dual-principal story + "fork it, require co-sign on your loops."

---

## Shot list

| # | Shot |
|---|------|
| 1 | Terminal commit (worker A) |
| 2 | Explorer commit tx |
| 3 | Terminal accept (accepter B) |
| 4 | Dashboard Accepted row |
| 5 | Deny path exit code 1 |
| 6 | Denied event + verified contract |

---

## Do not show

FleetMeter quota UI, single-EOA accept, mock RPC, placeholder event arrays.
