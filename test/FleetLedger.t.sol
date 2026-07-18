// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {FleetLedger} from "../src/FleetLedger.sol";

/// @notice Full unit suite for FleetLedger — drives the shipped contract only (no mocks of ledger math).
contract FleetLedgerTest is Test {
    FleetLedger internal ledger;

    address internal principalA = makeAddr("principalA");
    address internal principalB = makeAddr("principalB");
    address internal orchestrator = makeAddr("orchestrator");
    address internal stranger = makeAddr("stranger");

    bytes32 internal constant POOL = keccak256("fleet-pool-1");
    bytes32 internal constant SEAT_A = keccak256("seat-claude-a");
    bytes32 internal constant SEAT_B = keccak256("seat-codex-b");

    uint64 internal constant SEAT_WINDOW = 1 hours;
    uint64 internal constant POOL_WINDOW = 1 hours;
    uint128 internal constant SEAT_CAP = 1000; // micro-USD units
    uint128 internal constant POOL_CEILING = 1500;

    bytes32 internal constant RECEIPT = keccak256("receipt-1");

    function setUp() public {
        ledger = new FleetLedger();

        // Principal A creates the shared pool and registers their seat.
        vm.prank(principalA);
        ledger.createPool(POOL, POOL_CEILING, POOL_WINDOW);

        vm.prank(principalA);
        ledger.registerSeat(SEAT_A, POOL, SEAT_WINDOW, SEAT_CAP);

        // Principal B joins the same pool with an independent seat (red-team property).
        vm.prank(principalB);
        ledger.registerSeat(SEAT_B, POOL, SEAT_WINDOW, SEAT_CAP);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Access control
    // ─────────────────────────────────────────────────────────────────────────

    function test_createPool_revertsIfExists() public {
        vm.prank(principalA);
        vm.expectRevert(abi.encodeWithSelector(FleetLedger.PoolExists.selector, POOL));
        ledger.createPool(POOL, POOL_CEILING, POOL_WINDOW);
    }

    function test_createPool_revertsOnZeroCeilingOrWindow() public {
        bytes32 p2 = keccak256("p2");
        vm.prank(principalA);
        vm.expectRevert(FleetLedger.InvalidCeiling.selector);
        ledger.createPool(p2, 0, POOL_WINDOW);

        vm.prank(principalA);
        vm.expectRevert(FleetLedger.InvalidWindow.selector);
        ledger.createPool(p2, POOL_CEILING, 0);
    }

    function test_registerSeat_revertsIfSeatExists() public {
        vm.prank(principalA);
        vm.expectRevert(abi.encodeWithSelector(FleetLedger.SeatExists.selector, SEAT_A));
        ledger.registerSeat(SEAT_A, POOL, SEAT_WINDOW, SEAT_CAP);
    }

    function test_registerSeat_revertsIfPoolMissing() public {
        bytes32 ghost = keccak256("ghost");
        vm.prank(principalA);
        vm.expectRevert(abi.encodeWithSelector(FleetLedger.PoolNotFound.selector, ghost));
        ledger.registerSeat(keccak256("s"), ghost, SEAT_WINDOW, SEAT_CAP);
    }

    function test_postSpend_revertsForStranger() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(FleetLedger.NotAuthorizedSpender.selector, SEAT_A));
        ledger.postSpend(SEAT_A, 10, RECEIPT);
    }

    function test_postSpend_revertsWhenPrincipalBPostsForSeatA() public {
        // Principal B cannot forge Principal A's spend.
        vm.prank(principalB);
        vm.expectRevert(abi.encodeWithSelector(FleetLedger.NotAuthorizedSpender.selector, SEAT_A));
        ledger.postSpend(SEAT_A, 10, RECEIPT);
    }

    function test_postSpend_controllerCanPostOwnSeat() public {
        vm.prank(principalA);
        ledger.postSpend(SEAT_A, 100, RECEIPT);
        assertEq(ledger.remaining(SEAT_A), SEAT_CAP - 100);
    }

    function test_postSpend_orchestratorCanPostAnySeatInPool() public {
        vm.prank(principalA);
        ledger.setOrchestrator(POOL, orchestrator);

        vm.prank(orchestrator);
        ledger.postSpend(SEAT_A, 50, RECEIPT);
        vm.prank(orchestrator);
        ledger.postSpend(SEAT_B, 75, RECEIPT);

        assertEq(ledger.remaining(SEAT_A), SEAT_CAP - 50);
        assertEq(ledger.remaining(SEAT_B), SEAT_CAP - 75);
    }

    function test_setOrchestrator_onlyPoolAdmin() public {
        vm.prank(principalB);
        vm.expectRevert(abi.encodeWithSelector(FleetLedger.NotPoolAdmin.selector, POOL));
        ledger.setOrchestrator(POOL, orchestrator);
    }

    function test_setPoolCeiling_onlyPoolAdmin() public {
        vm.prank(principalB);
        vm.expectRevert(abi.encodeWithSelector(FleetLedger.NotPoolAdmin.selector, POOL));
        ledger.setPoolCeiling(POOL, 2000);
    }

    function test_updateSeat_onlyController() public {
        vm.prank(principalB);
        vm.expectRevert(abi.encodeWithSelector(FleetLedger.NotSeatController.selector, SEAT_A));
        ledger.updateSeat(SEAT_A, SEAT_WINDOW, SEAT_CAP, principalB);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // remaining / canSpawn happy path
    // ─────────────────────────────────────────────────────────────────────────

    function test_remaining_startsAtCap() public view {
        assertEq(ledger.remaining(SEAT_A), SEAT_CAP);
        assertEq(ledger.remaining(SEAT_B), SEAT_CAP);
        assertEq(ledger.poolRemaining(POOL), POOL_CEILING);
    }

    function test_canSpawn_trueWhenUnderBudget() public view {
        assertTrue(ledger.canSpawn(SEAT_A, 1));
        assertTrue(ledger.canSpawn(SEAT_A, SEAT_CAP));
        assertTrue(ledger.canSpawn(SEAT_B, SEAT_CAP));
    }

    function test_canSpawn_falseWhenCostExceedsSeatCap() public view {
        assertFalse(ledger.canSpawn(SEAT_A, SEAT_CAP + 1));
    }

    function test_canSpawn_falseForUnknownSeat() public view {
        assertFalse(ledger.canSpawn(keccak256("nope"), 1));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SoftStop (≥80%) / HardStop (≥95%)
    // ─────────────────────────────────────────────────────────────────────────

    function test_softStop_emittedAt80Percent() public {
        // 800 / 1000 = 80%
        vm.expectEmit(true, true, false, true);
        emit FleetLedger.SoftStop(SEAT_A, POOL, 800, SEAT_CAP, 8000);

        vm.prank(principalA);
        ledger.postSpend(SEAT_A, 800, RECEIPT);
    }

    function test_hardStop_emittedAt95Percent() public {
        vm.prank(principalA);
        ledger.postSpend(SEAT_A, 900, keccak256("r0"));

        // +50 → 950 / 1000 = 95%
        vm.expectEmit(true, true, false, true);
        emit FleetLedger.HardStop(SEAT_A, POOL, 950, SEAT_CAP, 9500);

        vm.prank(principalA);
        ledger.postSpend(SEAT_A, 50, RECEIPT);
    }

    function test_noSoftStopBelow80() public {
        vm.recordLogs();
        vm.prank(principalA);
        ledger.postSpend(SEAT_A, 799, RECEIPT);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 softSig = keccak256("SoftStop(bytes32,bytes32,uint128,uint128,uint16)");
        bytes32 hardSig = keccak256("HardStop(bytes32,bytes32,uint128,uint128,uint16)");
        for (uint256 i = 0; i < logs.length; i++) {
            assertTrue(logs[i].topics[0] != softSig, "unexpected SoftStop");
            assertTrue(logs[i].topics[0] != hardSig, "unexpected HardStop");
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // canSpawn deny + seat quota + signalDenied
    // ─────────────────────────────────────────────────────────────────────────

    function test_canSpawn_falseAfterNearExhaustion() public {
        vm.prank(principalA);
        ledger.postSpend(SEAT_A, 900, RECEIPT);

        assertTrue(ledger.canSpawn(SEAT_A, 100));
        assertFalse(ledger.canSpawn(SEAT_A, 101));
        assertEq(ledger.remaining(SEAT_A), 100);
    }

    function test_postSpend_revertsWhenSeatQuotaExceeded() public {
        vm.prank(principalA);
        ledger.postSpend(SEAT_A, 900, RECEIPT);

        vm.prank(principalA);
        vm.expectRevert(
            abi.encodeWithSelector(
                FleetLedger.SeatQuotaExceeded.selector, SEAT_A, uint128(900), uint128(101), SEAT_CAP
            )
        );
        ledger.postSpend(SEAT_A, 101, RECEIPT);
    }

    function test_signalDenied_emitsWhenOverBudget() public {
        vm.prank(principalA);
        ledger.postSpend(SEAT_A, SEAT_CAP, RECEIPT);

        assertFalse(ledger.canSpawn(SEAT_A, 1));

        bytes32 reason = keccak256("spawn-blocked");
        vm.expectEmit(true, true, true, true);
        emit FleetLedger.Denied(SEAT_A, POOL, principalA, 1, reason);

        vm.prank(principalA);
        ledger.signalDenied(SEAT_A, 1, reason);
    }

    function test_signalDenied_revertsWhenStillUnderBudget() public {
        vm.prank(principalA);
        vm.expectRevert(FleetLedger.NotOverBudget.selector);
        ledger.signalDenied(SEAT_A, 1, RECEIPT);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Two-principal shared pool ceiling
    // ─────────────────────────────────────────────────────────────────────────

    function test_twoPrincipal_poolCeilingBlocksCombinedSpend() public {
        // Each seat cap is 1000; pool ceiling is 1500.
        // A spends 900, B spends 600 → total 1500. Next unit from either is pool-denied.
        vm.prank(principalA);
        ledger.postSpend(SEAT_A, 900, keccak256("a1"));

        vm.prank(principalB);
        ledger.postSpend(SEAT_B, 600, keccak256("b1"));

        assertEq(ledger.poolRemaining(POOL), 0);
        assertEq(ledger.remaining(SEAT_A), 100); // seat still has room
        assertEq(ledger.remaining(SEAT_B), 400);

        // Seat remaining is positive but pool blocks the spawn.
        assertFalse(ledger.canSpawn(SEAT_A, 1));
        assertFalse(ledger.canSpawn(SEAT_B, 1));

        vm.prank(principalA);
        vm.expectRevert(
            abi.encodeWithSelector(
                FleetLedger.PoolQuotaExceeded.selector,
                POOL,
                uint128(1500),
                uint128(1),
                POOL_CEILING
            )
        );
        ledger.postSpend(SEAT_A, 1, keccak256("a-blocked"));
    }

    function test_twoPrincipal_cannotForgeEachOthersSpend() public {
        vm.prank(principalA);
        ledger.postSpend(SEAT_A, 100, RECEIPT);

        // B cannot debit A's seat.
        vm.prank(principalB);
        vm.expectRevert(abi.encodeWithSelector(FleetLedger.NotAuthorizedSpender.selector, SEAT_A));
        ledger.postSpend(SEAT_A, 1, keccak256("forge"));

        // A cannot debit B's seat.
        vm.prank(principalA);
        vm.expectRevert(abi.encodeWithSelector(FleetLedger.NotAuthorizedSpender.selector, SEAT_B));
        ledger.postSpend(SEAT_B, 1, keccak256("forge2"));

        // Controllers still own their seats.
        (address ctrlA,,,,,,) = ledger.seats(SEAT_A);
        (address ctrlB,,,,,,) = ledger.seats(SEAT_B);
        assertEq(ctrlA, principalA);
        assertEq(ctrlB, principalB);
    }

    function test_twoPrincipal_independentSeatsSharePoolCounter() public {
        vm.prank(principalA);
        ledger.postSpend(SEAT_A, 400, RECEIPT);
        vm.prank(principalB);
        ledger.postSpend(SEAT_B, 300, RECEIPT);

        assertEq(ledger.poolRemaining(POOL), POOL_CEILING - 700);
        assertEq(ledger.remaining(SEAT_A), SEAT_CAP - 400);
        assertEq(ledger.remaining(SEAT_B), SEAT_CAP - 300);
        assertTrue(ledger.canSpawn(SEAT_A, 100));
        assertTrue(ledger.canSpawn(SEAT_B, 100));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Window roll
    // ─────────────────────────────────────────────────────────────────────────

    function test_windowRoll_resetsSeatSpent() public {
        vm.prank(principalA);
        ledger.postSpend(SEAT_A, 800, RECEIPT);
        assertEq(ledger.remaining(SEAT_A), 200);
        assertFalse(ledger.canSpawn(SEAT_A, 300));

        // Advance past seat window.
        vm.warp(block.timestamp + SEAT_WINDOW + 1);

        assertEq(ledger.remaining(SEAT_A), SEAT_CAP);
        assertTrue(ledger.canSpawn(SEAT_A, SEAT_CAP));

        // First post after roll should succeed at full cap and emit WindowRolled.
        vm.expectEmit(true, false, false, false);
        emit FleetLedger.WindowRolled(SEAT_A, 0, 0, 0); // topic0 + seatId only checked via first indexed

        vm.prank(principalA);
        ledger.postSpend(SEAT_A, 500, keccak256("after-roll"));
        assertEq(ledger.remaining(SEAT_A), SEAT_CAP - 500);
    }

    function test_windowRoll_resetsPoolSpent() public {
        vm.prank(principalA);
        ledger.postSpend(SEAT_A, 900, RECEIPT);
        vm.prank(principalB);
        ledger.postSpend(SEAT_B, 600, RECEIPT);
        assertEq(ledger.poolRemaining(POOL), 0);

        vm.warp(block.timestamp + POOL_WINDOW + 1);

        assertEq(ledger.poolRemaining(POOL), POOL_CEILING);
        assertTrue(ledger.canSpawn(SEAT_A, 100));

        vm.prank(principalA);
        ledger.postSpend(SEAT_A, 100, keccak256("pool-rolled"));
        assertEq(ledger.poolRemaining(POOL), POOL_CEILING - 100);
    }

    function test_windowRoll_viewDoesNotMutateStorage() public {
        vm.prank(principalA);
        ledger.postSpend(SEAT_A, 500, RECEIPT);

        (,, uint128 spentBefore, uint128 cap, uint64 startBefore,,) = _seatTuple(SEAT_A);
        assertEq(spentBefore, 500);
        assertEq(cap, SEAT_CAP);

        vm.warp(block.timestamp + SEAT_WINDOW + 5);

        // Views reflect rolled state without writing.
        assertEq(ledger.remaining(SEAT_A), SEAT_CAP);
        assertTrue(ledger.canSpawn(SEAT_A, SEAT_CAP));

        // Storage still holds pre-roll until a mutating call.
        (,, uint128 spentStored,,,,) = _seatTuple(SEAT_A);
        assertEq(spentStored, 500);

        // Mutating call rolls storage.
        vm.prank(principalA);
        ledger.postSpend(SEAT_A, 10, keccak256("mut"));
        (,, uint128 spentAfter,, uint64 startAfter,,) = _seatTuple(SEAT_A);
        assertEq(spentAfter, 10);
        assertGt(startAfter, startBefore);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Spend event + exact remaining after multi-step path (allow → deny)
    // ─────────────────────────────────────────────────────────────────────────

    function test_allowThenDeny_path() public {
        // Allow path
        assertTrue(ledger.canSpawn(SEAT_A, 400));
        vm.prank(principalA);
        ledger.postSpend(SEAT_A, 400, keccak256("allow"));
        assertEq(ledger.remaining(SEAT_A), 600);

        // Still allow
        assertTrue(ledger.canSpawn(SEAT_A, 600));
        vm.prank(principalA);
        ledger.postSpend(SEAT_A, 600, keccak256("fill"));
        assertEq(ledger.remaining(SEAT_A), 0);

        // Deny path
        assertFalse(ledger.canSpawn(SEAT_A, 1));
        vm.prank(principalA);
        vm.expectRevert(
            abi.encodeWithSelector(
                FleetLedger.SeatQuotaExceeded.selector, SEAT_A, uint128(1000), uint128(1), SEAT_CAP
            )
        );
        ledger.postSpend(SEAT_A, 1, keccak256("deny"));
    }

    function test_spendEvent_fields() public {
        vm.expectEmit(true, true, true, true);
        emit FleetLedger.Spend(
            SEAT_A, POOL, principalA, 123, 123, 123, _currentAligned(SEAT_WINDOW), RECEIPT
        );

        vm.prank(principalA);
        ledger.postSpend(SEAT_A, 123, RECEIPT);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    function _seatTuple(bytes32 seatId)
        internal
        view
        returns (
            address controller,
            bytes32 poolId,
            uint128 spent,
            uint128 cap,
            uint64 windowStart,
            uint64 windowSeconds,
            bool exists
        )
    {
        // public mapping getter returns struct fields in declaration order
        (controller, poolId, spent, cap, windowStart, windowSeconds, exists) = ledger.seats(seatId);
    }

    function _currentAligned(uint64 window) internal view returns (uint64) {
        return uint64((block.timestamp / uint256(window)) * uint256(window));
    }
}
