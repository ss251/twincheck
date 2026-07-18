// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {TwinCheck} from "../src/TwinCheck.sol";

contract TwinCheckTest is Test {
    TwinCheck internal tc;
    address internal a = address(0xA11CE);
    address internal b = address(0xB0B);
    address internal outsider = address(0xBAD);
    address internal target = address(0xBEEF);

    function setUp() public {
        tc = new TwinCheck(a, b);
    }

    function test_constructor_rejects_zero_and_same() public {
        vm.expectRevert(TwinCheck.ZeroAddress.selector);
        new TwinCheck(address(0), b);
        vm.expectRevert(TwinCheck.SameAttestors.selector);
        new TwinCheck(a, a);
    }

    function test_only_attestor_can_watch() public {
        vm.prank(outsider);
        vm.expectRevert(abi.encodeWithSelector(TwinCheck.NotAttestor.selector, outsider));
        tc.watch(target);
    }

    function test_watch_and_dual_settle() public {
        vm.prank(a);
        tc.watch(target);
        assertEq(tc.watchedCount(), 1);
        assertEq(tc.watchedAt(0), target);

        bytes32 ev = keccak256("evidence-v1");
        vm.prank(a);
        tc.report(target, true, false, ev);

        // not settled yet
        (bool watched, bool settled,,,,,) = tc.getCard(target);
        assertTrue(watched);
        assertFalse(settled);

        vm.prank(b);
        tc.report(target, true, false, ev);

        bool scanOK;
        bool visionOK;
        bool dual;
        (watched, settled, scanOK, visionOK, dual,,) = tc.getCard(target);
        assertTrue(watched);
        assertTrue(settled);
        assertTrue(scanOK);
        assertFalse(visionOK);
        assertFalse(dual);
        assertFalse(tc.dualOK(target));
    }

    function test_status_mismatch_does_not_settle() public {
        vm.prank(a);
        tc.watch(target);
        vm.prank(a);
        tc.report(target, true, true, bytes32(uint256(1)));
        vm.prank(b);
        tc.report(target, true, false, bytes32(uint256(2)));
        // Disagreeing reports leave the card unsettled rather than reverting.
        assertFalse(tc.isSettled(target));
    }

    function test_pulse_on_flip() public {
        vm.prank(a);
        tc.watch(target);

        // settle dual fail
        vm.prank(a);
        tc.report(target, true, false, bytes32(uint256(1)));
        vm.prank(b);
        tc.report(target, true, false, bytes32(uint256(1)));

        // re-report dual ok → pulse
        vm.prank(a);
        tc.report(target, true, true, bytes32(uint256(2)));

        vm.expectEmit(true, false, false, true);
        emit TwinCheck.DualStatusPulse(target, true, false, true, true, true, uint64(block.timestamp));

        vm.prank(b);
        tc.report(target, true, true, bytes32(uint256(2)));

        assertTrue(tc.dualOK(target));
    }

    function test_report_requires_watch() public {
        vm.prank(a);
        vm.expectRevert(abi.encodeWithSelector(TwinCheck.NotWatched.selector, target));
        tc.report(target, true, true, bytes32(0));
    }

    function test_watchBatch_skips_duplicates() public {
        address t2 = address(0x2222);
        address[] memory targets = new address[](3);
        targets[0] = target;
        targets[1] = target;
        targets[2] = t2;
        vm.prank(a);
        tc.watchBatch(targets);
        assertEq(tc.watchedCount(), 2);
    }
}
