// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {DoneStamp} from "../src/DoneStamp.sol";

/// @notice Demo bootstrap: principal A (worker) commits; principal B (accepter) accepts.
/// @dev Env: DONESTAMP, PRIVATE_KEY (worker A), PRINCIPAL_B_PRIVATE_KEY (accepter B)
contract BootstrapDoneStamp is Script {
    function run() external {
        address stampAddr = vm.envAddress("DONESTAMP");
        uint256 pkA = vm.envUint("PRIVATE_KEY");
        uint256 pkB = vm.envUint("PRINCIPAL_B_PRIVATE_KEY");

        DoneStamp stamp = DoneStamp(stampAddr);

        bytes32 taskId = keccak256("demo-allow-task");
        bytes32 specHash = keccak256("demo-spec");
        bytes32 evidenceHash = keccak256("demo-evidence-green");

        // Worker A commits
        vm.startBroadcast(pkA);
        stamp.commit(taskId, specHash, evidenceHash, true);
        vm.stopBroadcast();

        // Accepter B co-signs with matching evidence
        vm.startBroadcast(pkB);
        bool ok = stamp.accept(taskId, evidenceHash);
        vm.stopBroadcast();

        console2.log("taskId:");
        console2.logBytes32(taskId);
        console2.log("accept ok:", ok);
        console2.log("isDone:", stamp.isDone(taskId));
    }
}
