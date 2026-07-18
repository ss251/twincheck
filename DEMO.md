# DEMO.md — internal script + shot list

**System must be live:** real Monad testnet contract, real MON txs, dashboard on a public URL, CLI against deployed address. Do not record until G9 rehearsal passes.

**Runtime target:** ≤ 3 minutes. Split screen: terminal + explorer + dashboard.

---

## Pre-flight (T−30 min)

1. `forge test` green.  
2. `DEPLOYMENTS.md` address matches explorer verified source.  
3. `.env` has `PRIVATE_KEY`, `PRINCIPAL_B_PRIVATE_KEY`, `FLEETLEDGER`.  
4. Dashboard env `VITE_FLEETLEDGER` set; public URL loads seats + pool.  
5. `quota-axi --json` returns windows (or use `cli/examples/quota.json`).  
6. Confirm two controllers on explorer via `SeatRegistered` events (different addresses).

---

## Script (spoken beats)

### Beat 1 — The pain (0:00–0:35)

> “Our coding fleet burns four providers. Quotas reset on different clocks. Grok credits died mid-run with no shared ledger — we only found out when the run crashed.”

**Show:** README one-liner or fire-drill note (static). No mock data on chain.

### Beat 2 — Clean allow (0:35–1:10)

```bash
cd cli
bun run src/index.ts status
bun run src/index.ts gate --cost 100000   # expect exit 0
bun run src/index.ts post --units 100000
```

**Show:** Terminal success + explorer tx + dashboard **Spend** row with explorer link. Seat meter ticks up.

### Beat 3 — Soft / hard (optional if time, 1:10–1:30)

Post enough units to cross 80% on a demo seat (or use a low-cap demo seat).

**Show:** `SoftStop` (and `HardStop` if ≥95%) on the event tape.

### Beat 4 — Loud Denied (1:30–2:15)

Drive seat or pool to exhaustion (scripted units), then:

```bash
bun run src/index.ts gate --cost 500000 --signal
echo $?   # 1
```

**Show:** Non-zero exit on camera. Dashboard **Denied** event. Explorer tx for `signalDenied` if used. Say: “Silent quota death becomes a loud onchain refusal.”

### Beat 5 — Two-principal pool ceiling (2:15–2:50)

```bash
# Principal A posts near seat room but pool almost full
# Principal B posts — combined hits pool ceiling
# Either principal: canSpawn false even if seat remaining > 0
bun run src/index.ts gate --seat B --cost 1
```

**Show:** Two different controller addresses on seats; pool meter at 100%; gate deny. Line: “B cannot forge A’s spend; both are bound by the shared ceiling. That is why this is onchain.”

### Beat 6 — Close (2:50–3:00)

Explorer verified source + repo OSS link + “fork the commons.”

---

## Shot list (camera)

| # | Shot | Duration |
|---|------|----------|
| 1 | Terminal title: `fleetmeter status` | 5s |
| 2 | Explorer contract page (verified badge) | 8s |
| 3 | Dashboard wide: two seats + pool | 10s |
| 4 | `post` tx hash → explorer | 15s |
| 5 | Dashboard Spend row highlight | 8s |
| 6 | `gate` fail + exit code 1 | 12s |
| 7 | Denied event row | 8s |
| 8 | Two controller addresses side-by-side | 12s |
| 9 | Verified source + GitHub | 10s |

---

## Failure fallbacks

- RPC rate limit → switch to Ankr/Monad Foundation RPC from docs.  
- Dashboard empty logs → widen block range or hard-refresh after post.  
- Gate unexpectedly allows → check pool remaining; increase cost.

---

## Do not show

Placeholder JSON arrays in the UI, local anvil only, or a single EOA controlling both seats without saying so.
