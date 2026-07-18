// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {DoneStamp} from "../src/DoneStamp.sol";

/// @notice Full unit suite for DoneStamp — drives the shipped contract only.
contract DoneStampTest is Test {
    DoneStamp internal stamp;

    address internal worker = makeAddr("worker");
    address internal accepter = makeAddr("accepter");
    address internal stranger = makeAddr("stranger");

    bytes32 internal constant TASK = keccak256("task-spark-1");
    bytes32 internal constant SPEC = keccak256("spec-v1");
    bytes32 internal constant EVIDENCE = keccak256("evidence-tests-green");
    bytes32 internal constant BAD_EVIDENCE = keccak256("evidence-tampered");

    function setUp() public {
        stamp = new DoneStamp();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // commit
    // ─────────────────────────────────────────────────────────────────────────

    function test_commit_emitsAndStores() public {
        vm.expectEmit(true, true, false, true);
        emit DoneStamp.Committed(TASK, worker, SPEC, EVIDENCE, true, uint64(block.timestamp));

        vm.prank(worker);
        stamp.commit(TASK, SPEC, EVIDENCE, true);

        (
            address w,
            address a,
            bytes32 spec,
            bytes32 ev,
            bool gate,
            bool accepted,
            bool rejected,
            uint64 committedAt,
            uint64 decidedAt,
            bool exists
        ) = stamp.receipts(TASK);

        assertEq(w, worker);
        assertEq(a, address(0));
        assertEq(spec, SPEC);
        assertEq(ev, EVIDENCE);
        assertTrue(gate);
        assertFalse(accepted);
        assertFalse(rejected);
        assertEq(committedAt, uint64(block.timestamp));
        assertEq(decidedAt, 0);
        assertTrue(exists);
        assertTrue(stamp.isPending(TASK));
        assertFalse(stamp.isDone(TASK));
    }

    function test_commit_revertsIfExists() public {
        vm.prank(worker);
        stamp.commit(TASK, SPEC, EVIDENCE, true);

        vm.prank(worker);
        vm.expectRevert(abi.encodeWithSelector(DoneStamp.TaskExists.selector, TASK));
        stamp.commit(TASK, SPEC, EVIDENCE, true);
    }

    function test_commit_revertsOnZeroHash() public {
        vm.prank(worker);
        vm.expectRevert(DoneStamp.ZeroHash.selector);
        stamp.commit(TASK, bytes32(0), EVIDENCE, true);

        vm.prank(worker);
        vm.expectRevert(DoneStamp.ZeroHash.selector);
        stamp.commit(TASK, SPEC, bytes32(0), true);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // accept / dual principal
    // ─────────────────────────────────────────────────────────────────────────

    function test_accept_secondPrincipalMakesDone() public {
        vm.prank(worker);
        stamp.commit(TASK, SPEC, EVIDENCE, true);

        vm.prank(accepter);
        bool ok = stamp.accept(TASK, EVIDENCE);
        assertTrue(ok);
        assertTrue(stamp.isDone(TASK));
        assertFalse(stamp.isPending(TASK));

        (, address a,,,,,,,,) = stamp.receipts(TASK);
        assertEq(a, accepter);
    }

    function test_accept_emitsAccepted() public {
        vm.prank(worker);
        stamp.commit(TASK, SPEC, EVIDENCE, true);

        vm.expectEmit(true, true, false, true);
        emit DoneStamp.Accepted(TASK, accepter, EVIDENCE, uint64(block.timestamp));

        vm.prank(accepter);
        stamp.accept(TASK, EVIDENCE);
    }

    function test_accept_workerCannotSelfAccept() public {
        vm.prank(worker);
        stamp.commit(TASK, SPEC, EVIDENCE, true);

        vm.prank(worker);
        vm.expectRevert(abi.encodeWithSelector(DoneStamp.SelfAccept.selector, TASK));
        stamp.accept(TASK, EVIDENCE);
    }

    function test_accept_mismatchEmitsDeniedAndNotDone() public {
        vm.prank(worker);
        stamp.commit(TASK, SPEC, EVIDENCE, true);

        vm.expectEmit(true, true, false, true);
        emit DoneStamp.Denied(TASK, accepter, BAD_EVIDENCE, EVIDENCE);

        vm.prank(accepter);
        bool ok = stamp.accept(TASK, BAD_EVIDENCE);
        assertFalse(ok);
        assertFalse(stamp.isDone(TASK));
        assertTrue(stamp.isPending(TASK)); // still open for a correct accept
    }

    function test_accept_afterMismatchCanStillSucceed() public {
        vm.prank(worker);
        stamp.commit(TASK, SPEC, EVIDENCE, true);

        vm.prank(accepter);
        assertFalse(stamp.accept(TASK, BAD_EVIDENCE));

        vm.prank(accepter);
        assertTrue(stamp.accept(TASK, EVIDENCE));
        assertTrue(stamp.isDone(TASK));
    }

    function test_accept_revertsIfGateFailed() public {
        vm.prank(worker);
        stamp.commit(TASK, SPEC, EVIDENCE, false);

        vm.prank(accepter);
        vm.expectRevert(abi.encodeWithSelector(DoneStamp.GateFailed.selector, TASK));
        stamp.accept(TASK, EVIDENCE);
    }

    function test_accept_revertsIfAlreadyAccepted() public {
        vm.prank(worker);
        stamp.commit(TASK, SPEC, EVIDENCE, true);
        vm.prank(accepter);
        stamp.accept(TASK, EVIDENCE);

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(DoneStamp.AlreadyDecided.selector, TASK));
        stamp.accept(TASK, EVIDENCE);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // reject
    // ─────────────────────────────────────────────────────────────────────────

    function test_reject_bySecondPrincipal() public {
        vm.prank(worker);
        stamp.commit(TASK, SPEC, EVIDENCE, true);

        bytes32 reason = keccak256("tests-red");
        vm.expectEmit(true, true, false, true);
        emit DoneStamp.Rejected(TASK, accepter, reason, uint64(block.timestamp));

        vm.prank(accepter);
        stamp.reject(TASK, reason);

        assertFalse(stamp.isDone(TASK));
        assertFalse(stamp.isPending(TASK));
    }

    function test_reject_workerCannotSelfReject() public {
        vm.prank(worker);
        stamp.commit(TASK, SPEC, EVIDENCE, true);

        vm.prank(worker);
        vm.expectRevert(abi.encodeWithSelector(DoneStamp.SelfAccept.selector, TASK));
        stamp.reject(TASK, keccak256("nope"));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // verify view
    // ─────────────────────────────────────────────────────────────────────────

    function test_verify_matchesEvidence() public {
        vm.prank(worker);
        stamp.commit(TASK, SPEC, EVIDENCE, true);

        assertTrue(stamp.verify(TASK, EVIDENCE));
        assertFalse(stamp.verify(TASK, BAD_EVIDENCE));
        assertFalse(stamp.verify(keccak256("missing"), EVIDENCE));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // allow then deny path (demo spine)
    // ─────────────────────────────────────────────────────────────────────────

    function test_allowThenDeny_paths() public {
        // Allow path: dual principal done
        bytes32 taskOk = keccak256("task-allow");
        vm.prank(worker);
        stamp.commit(taskOk, SPEC, EVIDENCE, true);
        assertFalse(stamp.isDone(taskOk));
        vm.prank(accepter);
        assertTrue(stamp.accept(taskOk, EVIDENCE));
        assertTrue(stamp.isDone(taskOk));

        // Deny path: mismatch evidence
        bytes32 taskBad = keccak256("task-deny");
        vm.prank(worker);
        stamp.commit(taskBad, SPEC, EVIDENCE, true);
        vm.prank(accepter);
        assertFalse(stamp.accept(taskBad, BAD_EVIDENCE));
        assertFalse(stamp.isDone(taskBad));
    }

    function test_twoPrincipal_cannotForgeEachOther() public {
        vm.prank(worker);
        stamp.commit(TASK, SPEC, EVIDENCE, true);

        // stranger is valid second principal if they hold the evidence
        vm.prank(stranger);
        assertTrue(stamp.accept(TASK, EVIDENCE));

        // worker still cannot re-decide
        vm.prank(worker);
        vm.expectRevert(abi.encodeWithSelector(DoneStamp.AlreadyDecided.selector, TASK));
        stamp.reject(TASK, keccak256("forge"));
    }
}
