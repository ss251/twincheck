// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {FleetLedger} from "../src/FleetLedger.sol";

/// @notice Bootstrap a two-principal pool after deploy (red-team demo setup).
/// @dev Env:
///   FLEETLEDGER — deployed address
///   PRIVATE_KEY — principal A (pool admin + seat A controller)
///   PRINCIPAL_B_PRIVATE_KEY — principal B (seat B controller)
contract BootstrapFleet is Script {
    bytes32 internal constant POOL = keccak256("fleetmeter-spark");
    bytes32 internal constant SEAT_A = keccak256("seat-principal-a");
    bytes32 internal constant SEAT_B = keccak256("seat-principal-b");

    // Demo caps in micro-USD abstract units
    uint128 internal constant SEAT_CAP = 10_000_000; // 10 USD if 1e6 = $1
    uint128 internal constant POOL_CEILING = 15_000_000; // shared 15 USD
    uint64 internal constant WINDOW = 5 hours;

    function run() external {
        address ledgerAddr = vm.envAddress("FLEETLEDGER");
        uint256 pkA = vm.envUint("PRIVATE_KEY");
        uint256 pkB = vm.envUint("PRINCIPAL_B_PRIVATE_KEY");

        FleetLedger ledger = FleetLedger(ledgerAddr);

        // Principal A: create pool + seat A
        vm.startBroadcast(pkA);
        ledger.createPool(POOL, POOL_CEILING, WINDOW);
        ledger.registerSeat(SEAT_A, POOL, WINDOW, SEAT_CAP);
        // Optional: set A as orchestrator so CLI can post for both with one key later
        // ledger.setOrchestrator(POOL, vm.addr(pkA));
        vm.stopBroadcast();

        // Principal B: independent seat on shared pool
        vm.startBroadcast(pkB);
        ledger.registerSeat(SEAT_B, POOL, WINDOW, SEAT_CAP);
        vm.stopBroadcast();

        console2.log("Pool id (bytes32):");
        console2.logBytes32(POOL);
        console2.log("Seat A:");
        console2.logBytes32(SEAT_A);
        console2.log("Seat B:");
        console2.logBytes32(SEAT_B);
        console2.log("remaining A:", ledger.remaining(SEAT_A));
        console2.log("remaining B:", ledger.remaining(SEAT_B));
        console2.log("pool remaining:", ledger.poolRemaining(POOL));
    }
}
