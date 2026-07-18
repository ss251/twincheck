# FleetMeter

**Onchain shared-pool quota ledger for multi-provider AI agent fleets.**

Monad BuildAnything Spark · practical > fancy · OSS commons for fleet operators.

---

## The problem (true story)

An AI coding fleet burns budget across multiple provider seats (Claude, Codex, Grok, …). Each seat has its own quota window and reset epoch. There is no shared, tamper-evident ledger of who spent what against the **one** budget the operator actually has.

In a real run, Grok credits expired **silently** mid-flight. The failure only showed up when the agent crashed. Doctrine already said “per-agent caps are leases on one shared pool” — FleetMeter is that pool’s onchain authority: append-only receipts, window roll by `block.timestamp`, SoftStop / HardStop thresholds, and a loud `canSpawn` gate before fan-out.

## Why onchain is load-bearing

A local database would “work” if every seat is your own process on one machine. The red-team case — and the demo — is a **shared pool with two independent principals**. Principal B cannot forge Principal A’s spend (access control on `postSpend`), yet both are bound by the same pool ceiling on the same contract. Tamper-evidence is multi-party, not self-defense against editing your own log.

Monad’s cheap, fast blocks make **per-action receipts** economical. That is not decoration; it is why the design keeps history in events and live counters in storage.

## What ships

| Piece | Role |
|-------|------|
| `src/FleetLedger.sol` | One contract: pool + seats, `postSpend`, `canSpawn`, `remaining`, Soft/Hard/Denied events |
| `cli/` (`bun`) | `fleetmeter post` / `gate` / `status` via viem against the deployed address |
| `dashboard/` | Hosted UI: seats, pool ceiling, live event tape with explorer links |
| Foundry tests | Window roll, thresholds, two-principal ceiling, access control |

## Differentiate

| Project | Lane |
|---------|------|
| **Refilr** | Single-owner gas top-ups / vault |
| **LEASH** | One-agent crypto spend leash |
| **FleetMeter** | Cross-provider **shared quota commons** with pool authority |

## Setup

### Contracts

```bash
# Foundry
forge test
# Deploy to Monad testnet (needs MON):
source .env
forge script script/Deploy.s.sol:DeployFleetLedger --rpc-url $MONAD_RPC_URL --broadcast
# Bootstrap two-principal pool:
export FLEETLEDGER=0x...
forge script script/Bootstrap.s.sol:BootstrapFleet --rpc-url $MONAD_RPC_URL --broadcast
```

Verify on MonadVision (Sourcify):

```bash
forge verify-contract $FLEETLEDGER FleetLedger \
  --chain 10143 \
  --verifier sourcify \
  --verifier-url https://sourcify-api-monad.blockvision.org/
```

Network facts are read from [Monad testnets docs](https://docs.monad.xyz/developer-essentials/testnets) (chain id `10143`, RPC `https://testnet-rpc.monad.xyz`, explorer `https://testnet.monadvision.com`).

### CLI

```bash
cd cli && bun install
# requires FLEETLEDGER + PRIVATE_KEY in repo .env
bun run src/index.ts post --provider claude
bun run src/index.ts gate --cost 1000000 --signal   # exit 1 when denied
```

Quota source order: `--units` → `--file` / `FLEETMETER_QUOTA_FILE` → `quota-axi --json` → `cli/examples/quota.json` stub.

### Dashboard

```bash
cd dashboard && bun install
# set VITE_FLEETLEDGER=0x...
bun run dev
# production: bun run build → host dist/ (Vercel etc.)
```

## Agent usage story

1. Orchestrator (or seat controller) calls `fleetmeter gate --cost N` before spawning a worker.
2. If exit `0`, spawn proceeds; after the action, `fleetmeter post` writes a receipt (`postSpend`).
3. At ≥80% seat utilization the contract emits `SoftStop`; at ≥95% `HardStop`.
4. When the seat or **shared pool** cannot absorb cost, `canSpawn` is false → gate exits non-zero; optional `--signal` posts a `Denied` event for the dashboard tape.

## What this does NOT do yet

- Bonding, slashing, reputation, or governance of pool membership  
- Oracle-attested or agent-signed unit amounts (units are trusted-orchestrator inputs)  
- Automatic provider top-ups or payment rails  
- A heavy Graph indexer — the dashboard reads RPC logs/views directly  
- Cross-chain messaging or mainnet production SLAs  

Those are intentional non-goals for elegance. The future line is “optional bonding / multi-pool federation,” not this repo’s MVP.

## Security

See [`SECURITY.md`](./SECURITY.md). Short version: no external calls (no reentrancy surface), O(1) storage, controller/orchestrator ACL, two-principal non-forgeability covered by tests.

## Deployments

See [`DEPLOYMENTS.md`](./DEPLOYMENTS.md) for the live Monad testnet address and explorer link.

## License

MIT
