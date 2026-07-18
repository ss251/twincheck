// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {FleetLedger} from "../src/FleetLedger.sol";

/// @notice Deploy FleetLedger to Monad testnet (or any EVM RPC via --rpc-url).
contract DeployFleetLedger is Script {
    function run() external returns (FleetLedger ledger) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);
        ledger = new FleetLedger();
        vm.stopBroadcast();
        console2.log("FleetLedger deployed at:", address(ledger));
    }
}
