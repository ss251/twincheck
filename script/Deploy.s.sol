// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {DoneStamp} from "../src/DoneStamp.sol";

/// @notice Deploy DoneStamp to Monad testnet (or any EVM RPC via --rpc-url).
contract DeployDoneStamp is Script {
    function run() external returns (DoneStamp stamp) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);
        stamp = new DoneStamp();
        vm.stopBroadcast();
        console2.log("DoneStamp deployed at:", address(stamp));
    }
}
