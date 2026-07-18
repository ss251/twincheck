// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title FleetLedger
/// @notice Onchain shared-pool quota ledger for multi-provider AI agent fleets.
/// @dev Minimal live counters in storage; rich events are the append-only history layer.
///      Units are abstract micro-USD (uint128). Per-action cost is supplied by a seat
///      controller or a pool orchestrator — never by an untrusted agent EOA alone.
///
///      Two independent principals each control their own seats, cannot forge the other's
///      spend, and are both bound by the shared pool ceiling. That multi-party binding is
///      why the ledger is onchain (not a local database).
contract FleetLedger {
    // ─────────────────────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────────────────────

    error PoolExists(bytes32 poolId);
    error PoolNotFound(bytes32 poolId);
    error SeatExists(bytes32 seatId);
    error SeatNotFound(bytes32 seatId);
    error NotPoolAdmin(bytes32 poolId);
    error NotSeatController(bytes32 seatId);
    error NotAuthorizedSpender(bytes32 seatId);
    error InvalidWindow();
    error InvalidCap();
    error InvalidCeiling();
    error SeatQuotaExceeded(bytes32 seatId, uint128 spent, uint128 cost, uint128 cap);
    error PoolQuotaExceeded(bytes32 poolId, uint128 spent, uint128 cost, uint128 ceiling);
    error ZeroAddress();
    error NotOverBudget();

    // ─────────────────────────────────────────────────────────────────────────
    // Events (history layer — indexers / dashboard read these)
    // ─────────────────────────────────────────────────────────────────────────

    event PoolCreated(
        bytes32 indexed poolId,
        address indexed admin,
        uint128 ceiling,
        uint64 windowSeconds
    );

    event PoolCeilingUpdated(bytes32 indexed poolId, uint128 oldCeiling, uint128 newCeiling);

    event OrchestratorUpdated(
        bytes32 indexed poolId, address indexed oldOrchestrator, address indexed newOrchestrator
    );

    event SeatRegistered(
        bytes32 indexed seatId,
        bytes32 indexed poolId,
        address indexed controller,
        uint64 windowSeconds,
        uint128 capUnits
    );

    event SeatUpdated(
        bytes32 indexed seatId, uint64 windowSeconds, uint128 capUnits, address controller
    );

    event WindowRolled(
        bytes32 indexed seatId, uint64 oldStart, uint64 newStart, uint128 spentResetToZero
    );

    event PoolWindowRolled(
        bytes32 indexed poolId, uint64 oldStart, uint64 newStart, uint128 spentResetToZero
    );

    /// @notice Append-only spend receipt. `receiptHash` tags the offchain action (task id, etc.).
    event Spend(
        bytes32 indexed seatId,
        bytes32 indexed poolId,
        address indexed spender,
        uint128 units,
        uint128 seatSpentAfter,
        uint128 poolSpentAfter,
        uint64 seatWindowStart,
        bytes32 receiptHash
    );

    /// @notice Seat utilization crossed or sits at ≥80% of cap after a spend.
    event SoftStop(
        bytes32 indexed seatId, bytes32 indexed poolId, uint128 spent, uint128 cap, uint16 bps
    );

    /// @notice Seat utilization crossed or sits at ≥95% of cap after a spend.
    event HardStop(
        bytes32 indexed seatId, bytes32 indexed poolId, uint128 spent, uint128 cap, uint16 bps
    );

    /// @notice Loud onchain refusal when a spawn would exceed seat or pool budget.
    event Denied(
        bytes32 indexed seatId,
        bytes32 indexed poolId,
        address indexed reporter,
        uint128 cost,
        bytes32 reason
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Storage — live counters only (O(1); no history arrays)
    // ─────────────────────────────────────────────────────────────────────────

    struct Seat {
        address controller;
        bytes32 poolId;
        uint128 spent;
        uint128 cap;
        uint64 windowStart;
        uint64 windowSeconds;
        bool exists;
    }

    struct Pool {
        address admin;
        address orchestrator;
        uint128 spent;
        uint128 ceiling;
        uint64 windowStart;
        uint64 windowSeconds;
        bool exists;
    }

    mapping(bytes32 => Seat) public seats;
    mapping(bytes32 => Pool) public pools;

    // ─────────────────────────────────────────────────────────────────────────
    // Pool lifecycle
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Create a shared pool. Caller becomes admin (sets ceiling / orchestrator).
    function createPool(bytes32 poolId, uint128 ceiling, uint64 windowSeconds) external {
        if (pools[poolId].exists) revert PoolExists(poolId);
        if (ceiling == 0) revert InvalidCeiling();
        if (windowSeconds == 0) revert InvalidWindow();

        uint64 start = _alignedStart(block.timestamp, windowSeconds);
        pools[poolId] = Pool({
            admin: msg.sender,
            orchestrator: address(0),
            spent: 0,
            ceiling: ceiling,
            windowStart: start,
            windowSeconds: windowSeconds,
            exists: true
        });

        emit PoolCreated(poolId, msg.sender, ceiling, windowSeconds);
    }

    /// @notice Pool admin updates the aggregate ceiling (shared multi-principal bound).
    function setPoolCeiling(bytes32 poolId, uint128 newCeiling) external {
        Pool storage p = pools[poolId];
        if (!p.exists) revert PoolNotFound(poolId);
        if (msg.sender != p.admin) revert NotPoolAdmin(poolId);
        if (newCeiling == 0) revert InvalidCeiling();

        uint128 old = p.ceiling;
        p.ceiling = newCeiling;
        emit PoolCeilingUpdated(poolId, old, newCeiling);
    }

    /// @notice Pool admin sets the trusted orchestrator that may post spends for any seat in the pool.
    function setOrchestrator(bytes32 poolId, address orchestrator) external {
        Pool storage p = pools[poolId];
        if (!p.exists) revert PoolNotFound(poolId);
        if (msg.sender != p.admin) revert NotPoolAdmin(poolId);
        // address(0) clears the orchestrator — controllers can still post their own spends

        address old = p.orchestrator;
        p.orchestrator = orchestrator;
        emit OrchestratorUpdated(poolId, old, orchestrator);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Seat lifecycle
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Register a seat into an existing pool. Caller becomes the sole controller.
    /// @dev A second principal registers their own seat under the same poolId — they cannot
    ///      forge this seat's controller or spend without being orchestrator/controller.
    function registerSeat(
        bytes32 seatId,
        bytes32 poolId,
        uint64 windowSeconds,
        uint128 capUnits
    ) external {
        if (seats[seatId].exists) revert SeatExists(seatId);
        if (!pools[poolId].exists) revert PoolNotFound(poolId);
        if (windowSeconds == 0) revert InvalidWindow();
        if (capUnits == 0) revert InvalidCap();

        uint64 start = _alignedStart(block.timestamp, windowSeconds);
        seats[seatId] = Seat({
            controller: msg.sender,
            poolId: poolId,
            spent: 0,
            cap: capUnits,
            windowStart: start,
            windowSeconds: windowSeconds,
            exists: true
        });

        emit SeatRegistered(seatId, poolId, msg.sender, windowSeconds, capUnits);
    }

    /// @notice Seat controller updates window / cap (or transfers controller).
    function updateSeat(
        bytes32 seatId,
        uint64 windowSeconds,
        uint128 capUnits,
        address newController
    ) external {
        Seat storage s = seats[seatId];
        if (!s.exists) revert SeatNotFound(seatId);
        if (msg.sender != s.controller) revert NotSeatController(seatId);
        if (windowSeconds == 0) revert InvalidWindow();
        if (capUnits == 0) revert InvalidCap();
        if (newController == address(0)) revert ZeroAddress();

        // If window length changes, re-align start for the new period length.
        if (windowSeconds != s.windowSeconds) {
            s.windowStart = _alignedStart(block.timestamp, windowSeconds);
            s.spent = 0;
        }
        s.windowSeconds = windowSeconds;
        s.cap = capUnits;
        s.controller = newController;

        emit SeatUpdated(seatId, windowSeconds, capUnits, newController);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Spend + gate
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Append a spend receipt. Auto-rolls seat and pool windows by block.timestamp.
    /// @dev Only the seat controller or the pool orchestrator may post. Reverts on quota exceed.
    function postSpend(bytes32 seatId, uint128 units, bytes32 receiptHash) external {
        Seat storage s = seats[seatId];
        if (!s.exists) revert SeatNotFound(seatId);

        Pool storage p = pools[s.poolId];
        if (!_isAuthorizedSpender(s, p, msg.sender)) revert NotAuthorizedSpender(seatId);

        _rollSeat(seatId, s);
        _rollPool(s.poolId, p);

        uint256 seatNew = uint256(s.spent) + uint256(units);
        if (seatNew > s.cap) {
            revert SeatQuotaExceeded(seatId, s.spent, units, s.cap);
        }

        uint256 poolNew = uint256(p.spent) + uint256(units);
        if (poolNew > p.ceiling) {
            revert PoolQuotaExceeded(s.poolId, p.spent, units, p.ceiling);
        }

        s.spent = uint128(seatNew);
        p.spent = uint128(poolNew);

        emit Spend(
            seatId,
            s.poolId,
            msg.sender,
            units,
            s.spent,
            p.spent,
            s.windowStart,
            receiptHash
        );

        _emitThresholds(seatId, s);
    }

    /// @notice Loud onchain denial when a spawn is blocked. Requires cost would fail canSpawn.
    /// @dev Exists so the dashboard can show Denied without relying only on offchain exit codes.
    function signalDenied(bytes32 seatId, uint128 cost, bytes32 reason) external {
        Seat storage s = seats[seatId];
        if (!s.exists) revert SeatNotFound(seatId);

        Pool storage p = pools[s.poolId];
        if (!_isAuthorizedSpender(s, p, msg.sender)) revert NotAuthorizedSpender(seatId);

        if (canSpawn(seatId, cost)) revert NotOverBudget();

        emit Denied(seatId, s.poolId, msg.sender, cost, reason);
    }

    /// @notice Pre-fanout gate: true iff seat + pool can absorb `cost` after lazy window roll.
    function canSpawn(bytes32 seatId, uint128 cost) public view returns (bool) {
        Seat storage s = seats[seatId];
        if (!s.exists) return false;

        Pool storage p = pools[s.poolId];
        (uint128 seatSpent,) = _effectiveSeat(s);
        (uint128 poolSpent,) = _effectivePool(p);

        if (uint256(seatSpent) + uint256(cost) > s.cap) return false;
        if (uint256(poolSpent) + uint256(cost) > p.ceiling) return false;
        return true;
    }

    /// @notice Remaining seat quota in the current (possibly rolled) window.
    function remaining(bytes32 seatId) public view returns (uint128) {
        Seat storage s = seats[seatId];
        if (!s.exists) return 0;

        (uint128 seatSpent,) = _effectiveSeat(s);
        if (seatSpent >= s.cap) return 0;
        return s.cap - seatSpent;
    }

    /// @notice Remaining shared-pool quota in the current (possibly rolled) window.
    function poolRemaining(bytes32 poolId) public view returns (uint128) {
        Pool storage p = pools[poolId];
        if (!p.exists) return 0;

        (uint128 poolSpent,) = _effectivePool(p);
        if (poolSpent >= p.ceiling) return 0;
        return p.ceiling - poolSpent;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal accounting (fixed aligned windows — O(1))
    // ─────────────────────────────────────────────────────────────────────────

    function _isAuthorizedSpender(Seat storage s, Pool storage p, address who)
        internal
        view
        returns (bool)
    {
        if (who == s.controller) return true;
        if (p.orchestrator != address(0) && who == p.orchestrator) return true;
        return false;
    }

    function _alignedStart(uint256 ts, uint64 windowSeconds) internal pure returns (uint64) {
        // Align to window boundaries so multi-seat dashboards share period edges.
        return uint64((ts / uint256(windowSeconds)) * uint256(windowSeconds));
    }

    function _effectiveSeat(Seat storage s)
        internal
        view
        returns (uint128 spent, uint64 windowStart)
    {
        uint256 end = uint256(s.windowStart) + uint256(s.windowSeconds);
        if (block.timestamp >= end) {
            return (0, _alignedStart(block.timestamp, s.windowSeconds));
        }
        return (s.spent, s.windowStart);
    }

    function _effectivePool(Pool storage p)
        internal
        view
        returns (uint128 spent, uint64 windowStart)
    {
        uint256 end = uint256(p.windowStart) + uint256(p.windowSeconds);
        if (block.timestamp >= end) {
            return (0, _alignedStart(block.timestamp, p.windowSeconds));
        }
        return (p.spent, p.windowStart);
    }

    function _rollSeat(bytes32 seatId, Seat storage s) internal {
        uint256 end = uint256(s.windowStart) + uint256(s.windowSeconds);
        if (block.timestamp >= end) {
            uint64 old = s.windowStart;
            uint64 neu = _alignedStart(block.timestamp, s.windowSeconds);
            s.spent = 0;
            s.windowStart = neu;
            emit WindowRolled(seatId, old, neu, 0);
        }
    }

    function _rollPool(bytes32 poolId, Pool storage p) internal {
        uint256 end = uint256(p.windowStart) + uint256(p.windowSeconds);
        if (block.timestamp >= end) {
            uint64 old = p.windowStart;
            uint64 neu = _alignedStart(block.timestamp, p.windowSeconds);
            p.spent = 0;
            p.windowStart = neu;
            emit PoolWindowRolled(poolId, old, neu, 0);
        }
    }

    function _emitThresholds(bytes32 seatId, Seat storage s) internal {
        // bps = spent * 10000 / cap (basis points). Soft ≥ 8000, Hard ≥ 9500.
        if (s.cap == 0) return;
        uint256 bps = (uint256(s.spent) * 10_000) / uint256(s.cap);
        if (bps >= 9500) {
            emit HardStop(seatId, s.poolId, s.spent, s.cap, uint16(bps));
        } else if (bps >= 8000) {
            emit SoftStop(seatId, s.poolId, s.spent, s.cap, uint16(bps));
        }
    }
}
