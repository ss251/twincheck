I'll research prior art for onchain usage/quota ledgers across Solidity patterns, Superfluid/Sablier-style windows, and metering contracts, then synthesize a concrete FleetLedger design.# Onchain Usage/Quota Ledger Prior Art for FleetMeter

Research synthesis for a **FleetMeter** core: per-seat spend vs rolling time-window caps for AI agent fleets. Focused on Monad-friendly (cheap, fast blocks) high-frequency small writes.

---

## 1. Gas-efficient append-only event-log pattern

### Canonical rule: **minimal onchain state for enforcement + rich events for history**

Events are the append-only log the EVM already gives you. They live in receipt logs (not contract storage), cost roughly **~375 base + ~375/topic + ~8/byte**, vs **~20k cold / ~5k warm SSTORE**. Contracts **cannot read events**, so anything needed for a future `canSpawn` must stay in storage.

**Industry default (The Graph / Alchemy / OZ monitoring):**

| Concern | Onchain | Offchain indexer |
|--------|---------|------------------|
| Gate (can spend?) | `spent`, `windowStart` / buffer, caps | — |
| Audit trail (who spent what, when, why) | `emit Spent(...)` only | full history, dashboards, per-agent drilldown |
| Aggregates (fleet total this week) | optional `globalSpent` if enforced onchain | preferred for analytics |

Do **not** push every micro-spend into a storage array (`Spend[] history`). That is the anti-pattern: unbounded growth, expensive cold slots, and you still need events for indexers.

### Event design (best practice)

```solidity
// Index what you filter on; keep non-indexed payload rich for the dashboard.
event Spent(
    bytes32 indexed seatId,      // or address indexed seat
    address indexed payer,       // msg.sender / orchestrator
    uint256 units,               // amount charged
    uint256 spentAfter,          // post-tx window total (helps recon)
    uint64  windowStart,         // which window this applied to
    bytes32 tag                  // taskId / agentRunId (non-indexed OK)
);

event WindowRolled(bytes32 indexed seatId, uint64 oldStart, uint64 newStart, uint256 carriedOrZero);
event CapUpdated(bytes32 indexed seatId, uint256 oldCap, uint256 newCap);
event PoolSpent(bytes32 indexed poolId, bytes32 indexed seatId, uint256 units, uint256 poolSpentAfter);
```

- **≤3 indexed topics** (topic0 is the signature).
- Emit **after** state update so `spentAfter` matches storage.
- On Monad, event volume is cheap; storage still dominates. Prefer **one SSTORE pack + one event** per `postSpend`.

### Parent-hash / PHDAG note

Research on constant-time append structures (PHDAG) confirms: for log-canonical history, **the event *is* the record**; onchain keeps only checkpoints/roots if you need trustless reconstruction. For FleetMeter you usually do **not** need a Merkle tree of spends onchain—only the **live quota counters**.

### Recommended split for FleetMeter

```
Storage (hot path): 1 packed slot per seat (+ optional pool slot)
Events:             every postSpend + admin mutations
Indexer:            The Graph / Ponder / custom Monad log consumer → dashboard
```

---

## 2. Rolling-window / time-bucketed accounting patterns

Three battle-tested families appear in production Solidity. Pick by **semantics**, not brand.

### A. Fixed calendar window (Scroll bridge rate limiters)

**Idea:** period length `periodDuration`; on each touch, if `block.timestamp` crossed into a new period, zero the counter.

Scroll’s audited `ETHRateLimiter` / `TokenRateLimiter` track **amount in the current period** and reset when the period boundary is crossed; admin sets total limit per period. OZ flagged **DoS via self-filling the bucket** (cycle large deposit/withdraw to exhaust shared limit)—relevant if seats share a global pool without per-seat isolation.

```solidity
struct Period {
    uint128 spent;       // units used in this period
    uint48  periodStart; // aligned or last-reset timestamp
    // cap often global: uint128 limit
}

function _currentSpent(Period storage p, uint256 periodDuration) internal view returns (uint128) {
    if (block.timestamp >= uint256(p.periodStart) + periodDuration) return 0;
    return p.spent;
}
```

**Pros:** matches “$X per day / per 5h” human windows (Claude-style quotas).  
**Cons:** **boundary burst** (double spend at period edges); thrash at reset.  
**Fleet fit:** excellent for **hard per-seat daily/weekly caps**.

### B. Linear-decay / “amount in flight” sliding window (LayerZero OApp RateLimiter)

**Canonical production source:**  
https://github.com/LayerZero-Labs/LayerZero-v2 (OApp `RateLimiter.sol`)  
Docs: https://docs.layerzero.network/v2/developers/evm/oapp/message-design-patterns

```solidity
struct RateLimit {
    uint256 amountInFlight; // spent still "counting"
    uint256 lastUpdated;
    uint256 limit;
    uint256 window;         // seconds
};

// Linear decay: after `window` seconds, prior spend fully decays.
function _amountCanBeSent(...) internal view returns (uint256 currentInFlight, uint256 canSend) {
    uint256 dt = block.timestamp - lastUpdated;
    if (dt >= window) {
        return (0, limit);
    }
    uint256 decay = (limit * dt) / window;
    currentInFlight = amountInFlight <= decay ? 0 : amountInFlight - decay;
    canSend = limit <= currentInFlight ? 0 : limit - currentInFlight;
}
// _checkAndUpdate: require amount <= canSend; amountInFlight = current + amount; lastUpdated = now
```

**Pros:** smooth; no midnight cliff; one storage struct; pure view for “remaining.”  
**Cons:** not a true calendar “UTC day”; decay is continuous approximation of a sliding window.  
**Fleet fit:** best default for **rolling T-hour agent spend** (e.g. 5h / 24h soft rolling).

### C. Token bucket / buffer refill (ZELT / Fei-lineage RateLimited)

**Canonical library:** https://github.com/solidity-labs-io/zelt  

```solidity
struct RateLimit {
    uint128 rateLimitPerSecond; // refill rate
    uint128 bufferCap;          // max burst
    uint32  lastBufferUsedTime;
    uint224 bufferStored;       // remaining allowance at last sync
};

// view: buffer = min(bufferStored + rate * elapsed, bufferCap)
// depleteBuffer(amount): require amount <= buffer(); then store (buffer - amount, now)
```

**Pros:** natural **burst + sustained rate** (spawn storms then cool down).  
**Cons:** mental model is “tokens left,” not “spent this window”; caps expressed as rate×window.  
**Fleet fit:** good for **global fleet throughput** (max concurrent $/s) more than hard monthly budgets.

### D. Continuous accrual (Superfluid / Sablier) — related but inverted

Streaming payments store **rate + lastUpdate**, and **balance is a pure function of time**:

- Superfluid CFA: continuous flow at `flowRate`; balances net without a tx per second.  
  https://docs.superfluid.finance · https://github.com/superfluid-org/protocol-monorepo  
- Sablier Flow: `amountOwed = rps * elapsed`.  
  https://github.com/sablier-labs/flow · https://github.com/sablier-labs/evm-monorepo  

**Lesson for metering:** same trick as ZELT/LZ—**lazy evaluation**. Don’t write every second; store checkpoint + rate (or spent + timestamp) and recompute on touch. Superfluid is **credit flow**; FleetMeter is **debit quota**—same math, opposite sign.

### Pattern comparison (pick one)

| Pattern | Storage/seat | Burst control | Calendar-aligned | Best for |
|--------|--------------|---------------|------------------|----------|
| Fixed window (Scroll) | `spent + periodStart` | weak at edges | yes | daily/weekly hard caps |
| Linear decay (LayerZero) | `inFlight + lastUpdated` | smooth | no | rolling T-second budgets |
| Token bucket (ZELT) | `buffer + lastTime + rate + cap` | explicit burst | no | sustained $/s + burst |
| True sliding log | array of timestamps | perfect | yes | **avoid onchain** (gas) |

---

## 3. Existing contracts to reference

| Project | URL | What to steal |
|--------|-----|----------------|
| **LayerZero RateLimiter** | https://github.com/LayerZero-Labs/LayerZero-v2 → `oapp/.../RateLimiter.sol` | Sliding decay window; `getAmountCanBeSent` view; `_checkAndUpdateRateLimit` |
| **ZELT RateLimited** | https://github.com/solidity-labs-io/zelt | Packed token-bucket; `buffer()` view; single-SSTORE deplete; Certora-friendly |
| **Scroll ETH/TokenRateLimiter** | https://github.com/scroll-tech/scroll `contracts/src/rate-limiter/` · OZ audit | Fixed period `spent` + `lastUpdateTs`; period rollover; shared-pool DoS lessons |
| **pr0toshi/rateLimit (EIP-5075-ish)** | https://github.com/pr0toshi/rateLimit | Outflow caps over custom windows; simple inherit-and-wrap pattern |
| **Sablier Flow / Lockup** | https://github.com/sablier-labs/flow · lockup | Lazy `rps * Δt` accounting; event-rich protocol design |
| **Superfluid CFA** | https://github.com/superfluid-org/protocol-monorepo | Netting + checkpoint; balance-as-function-of-time |
| **OpenZeppelin (events/monitoring)** | https://consensys.github.io/smart-contract-best-practices/ | Emit events for all sensitive state; monitor limit proximity |

There is **no mature public “AI agent fleet quota ledger”** standard (usage metering for agents is mostly offchain: Stripe, LiteLLM, etc.). Closest onchain primitives are **bridge/message rate limiters** and **streaming balance math**. Treat FleetMeter as a **new composition**: seat registry + LZ/Scroll-style windows + ZELT packing + event-first audit.

---

## 4. Clean API: `canSpawn` + `postSpend` with auto-roll

### Recommended model for FleetMeter: **hybrid**

1. **Per-seat fixed window** for human-aligned caps (`cap`, `window` e.g. 5h / 1d / 7d).  
2. Optional **global pool** with LayerZero decay or fixed window.  
3. Optional **token-bucket** on the orchestrator role for spawn rate (anti-spam), separate from $ budget.

### Storage layout (gas-packed)

```solidity
// One mapping key = one seat. Pack into 1–2 slots.
struct SeatLedger {
    uint128 spent;       // units spent in current window
    uint128 cap;         // max units per window (0 = disabled)
    uint64  windowStart; // start of current window (unix)
    uint64  window;      // duration seconds (immutable per seat or global default)
    // slot2 if needed:
    // address owner; bool frozen; uint32 nonce;
}

mapping(bytes32 seatId => SeatLedger) public seats;

// Shared fleet pool (optional)
struct Pool {
    uint128 spent;
    uint128 cap;
    uint64  windowStart;
    uint64  window;
}
Pool public fleetPool;

// Who may call postSpend
mapping(address => bool) public spenders; // orchestrators
```

**Units:** use abstract `uint128` “micro-USD” or “milli-tokens” fixed-point; never floats. Document scale in NatSpec.

### Core functions

```solidity
error CapExceeded(bytes32 seatId, uint256 spent, uint256 cost, uint256 cap);
error SeatFrozen(bytes32 seatId);
error NotSpender();

event Spent(bytes32 indexed seatId, address indexed spender, uint256 units, uint256 spentAfter, uint64 windowStart, bytes32 tag);
event WindowRolled(bytes32 indexed seatId, uint64 newWindowStart);

/// @notice Pure-ish view: does not mutate; simulates roll
function canSpawn(bytes32 seatId, uint256 cost)
    public
    view
    returns (bool ok, uint256 spentNow, uint256 cap, uint64 windowStart)
{
    SeatLedger memory s = seats[seatId];
    (spentNow, windowStart) = _effectiveSpent(s);
    cap = s.cap;
    ok = !s.frozen /* if packed */ && cost <= cap - spentNow; // careful: underflow → use cap >= spentNow + cost
    // also check fleetPool if shared budget required
}

/// @notice Append spend; auto-rolls window; reverts if over cap
function postSpend(bytes32 seatId, uint256 units, bytes32 tag) external returns (uint256 spentAfter) {
    if (!spenders[msg.sender]) revert NotSpender();
    SeatLedger storage s = seats[seatId];

    // Auto-roll
    if (block.timestamp >= uint256(s.windowStart) + uint256(s.window)) {
        s.spent = 0;
        s.windowStart = uint64(block.timestamp); // or align: (ts / window) * window
        emit WindowRolled(seatId, s.windowStart);
    }

    uint256 newSpent = uint256(s.spent) + units;
    if (newSpent > s.cap) revert CapExceeded(seatId, s.spent, units, s.cap);

    s.spent = uint128(newSpent);
    spentAfter = newSpent;

    // Optional: same pattern for fleetPool.spent / fleetPool.cap

    emit Spent(seatId, msg.sender, units, spentAfter, s.windowStart, tag);
}

function _effectiveSpent(SeatLedger memory s) internal view returns (uint256 spent, uint64 windowStart) {
    if (s.window == 0) return (0, s.windowStart); // unlimited if you define it that way
    if (block.timestamp >= uint256(s.windowStart) + uint256(s.window)) {
        return (0, uint64(block.timestamp));
    }
    return (s.spent, s.windowStart);
}
```

### Sliding-window variant (drop-in alternate core)

Swap body for LayerZero-style:

```solidity
function canSpawn(bytes32 seatId, uint256 cost) public view returns (bool) {
    SeatDecay storage r = decaySeats[seatId];
    (, uint256 can) = _amountCanBeSent(r.amountInFlight, r.lastUpdated, r.limit, r.window);
    return cost <= can;
}

function postSpend(bytes32 seatId, uint256 units, bytes32 tag) external {
    _checkAndUpdateRateLimit(seatId, units); // mutates inFlight + lastUpdated
    emit Spent(...);
}
```

### Shared budget pool pattern

```solidity
// Enforce BOTH: seat cap AND fleet pool cap
function canSpawn(bytes32 seatId, uint256 cost) public view returns (bool) {
    (bool seatOk,,,) = /* seat check */;
    (uint256 poolSpent,) = _effectiveSpent(fleetPool);
    bool poolOk = cost + poolSpent <= fleetPool.cap;
    return seatOk && poolOk;
}
// postSpend increments both seat and pool (two SLOADs/SSTOREs — acceptable for gate txs)
```

**Isolation lesson (Scroll OZ):** a **shared** pool can be griefed by one seat burning the pool. Mitigations: per-seat caps first, pool as secondary soft limit; emergency `setCap` without delay; optional per-seat `maxPoolShareBps`.

### Access control

- `postSpend`: only **registered orchestrators** (or EIP-712 signed vouchers from a meter oracle if spends are reported, not initiated onchain).  
- `setCap` / `setWindow` / `freeze`: admin / roles with events.  
- Consider **commit-reveal or oracle-attested cost** if agents can’t be trusted to self-report units (out of scope for pure ledger, but design the `units` source of truth).

### Alignment of `windowStart`

Two options:

1. **Lazy free-running:** `windowStart = block.timestamp` on roll (simple; windows drift per seat).  
2. **Aligned buckets:** `windowStart = (block.timestamp / window) * window` (all seats share UTC-like periods; better for fleet reporting).

For multi-seat dashboards, prefer **aligned buckets**.

### High-frequency Monad tips

- Pack `spent|cap` and `windowStart|window` into **two slots max** (or one if you fix global `window`).  
- `postSpend` path: 1–2 SLOAD, 1 SSTORE, 1 LOG — avoid loops.  
- Batch: `postSpendBatch(bytes32[] seats, uint256[] units, bytes32 tag)` only if same spender; still N SSTOREs.  
- Don’t store per-tx history onchain; index `Spent`.  
- Use `uint128` for money units to leave room in the slot.

---

## Concrete “reference composition”

```
FleetLedger
├── seats: mapping → fixed-window SeatLedger          // human quotas
├── fleetPool: optional fixed or LZ-decay Pool        // shared soft ceiling
├── spenders: mapping address → bool                  // orchestrators
├── canSpawn(seat, cost) view                         // simulate roll + both caps
├── remaining(seat) view                              // cap - effectiveSpent
├── postSpend(seat, units, tag)                       // roll + debit + event
└── admin: setSeat, setPool, setSpender, freeze
```

Implement decay math by **copying LayerZero’s pure functions** (MIT) or token-bucket by **copying ZELT structs** (BSD-3)—don’t re-derive overflow edge cases from scratch.

---

## 8-line minimal `FleetLedger.sol` design recommendation

1. **State:** `mapping(bytes32 => packed{uint128 spent, uint128 cap, uint64 windowStart, uint64 window}) seats` + `mapping(address=>bool) spenders` — no history arrays.  
2. **Window:** fixed aligned periods: on touch, if `now >= windowStart + window` then `spent=0; windowStart=(now/window)*window`.  
3. **Views:** `remaining(seat)` and `canSpawn(seat,cost)` recompute rolled spent without writing.  
4. **Mutate:** `postSpend(seat,units,tag)` only if `spenders[msg.sender]`; auto-roll; require `spent+units <= cap`; one SSTORE.  
5. **Events:** `Spent(seat,spender,units,spentAfter,windowStart,tag)` is the append-only audit log for indexers/dashboards.  
6. **Optional pool:** second `Pool` with same roll math; `canSpawn`/`postSpend` enforce seat **and** pool (watch shared-pool griefing).  
7. **Units:** abstract `uint128` micro-USD; costs come from trusted orchestrator (or later oracle), not the agent EOA.  
8. **Monad:** optimize for many small `postSpend` txs—events for history, storage only for live counters; skip Superfluid complexity unless you need continuous replenish (then use ZELT bucket).

### Primary references

- LayerZero RateLimiter (linear-decay window): https://github.com/LayerZero-Labs/LayerZero-v2  
- LayerZero docs (RateLimitConfig / `_outflow`): https://docs.layerzero.network/v2/developers/evm/oapp/message-design-patterns  
- ZELT token-bucket libraries: https://github.com/solidity-labs-io/zelt  
- Scroll period rate limiters + OZ audit: https://github.com/scroll-tech/scroll · https://www.openzeppelin.com/news/scrollowner-and-rate-limiter-audit  
- Superfluid continuous balances: https://docs.superfluid.finance · https://github.com/superfluid-org/protocol-monorepo  
- Sablier Flow `rps * elapsed`: https://github.com/sablier-labs/flow  
- Event-vs-storage gas: Alchemy / RareSkills gas guides; EIP-7745 log motivation
