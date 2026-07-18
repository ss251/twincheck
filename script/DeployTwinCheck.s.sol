// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {TwinCheck} from "../src/TwinCheck.sol";

/// @notice Deploy TwinCheck with principal A (deployer) and principal B as attestors.
contract DeployTwinCheck is Script {
    function run() external returns (TwinCheck twin) {
        uint256 pkA = vm.envUint("PRIVATE_KEY");
        address a = vm.addr(pkA);
        address b = vm.envAddress("PRINCIPAL_B_ADDRESS");
        if (b == address(0)) {
            // derive from PRINCIPAL_B_PRIVATE_KEY if address not set
            uint256 pkB = vm.envUint("PRINCIPAL_B_PRIVATE_KEY");
            b = vm.addr(pkB);
        }
        vm.startBroadcast(pkA);
        twin = new TwinCheck(a, b);
        vm.stopBroadcast();
        console2.log("TwinCheck deployed at:", address(twin));
        console2.log("attestorA:", a);
        console2.log("attestorB:", b);
    }
}
