# Deployments

## Monad Testnet (chain id `10143`)

| Field | Value |
|-------|--------|
| Network | Monad Testnet |
| Chain ID | `10143` |
| RPC | `https://testnet-rpc.monad.xyz` |
| Explorer | https://testnet.monadvision.com |
| Faucet | https://faucet.monad.xyz |

### FleetLedger

| Field | Value |
|-------|--------|
| Address | **PENDING** — blocked on testnet MON for deployer |
| Deployer | `0xB99348aCC284E70cD832Fec09a0fC4A88879b5ac` (principal A) |
| Principal B | `0xe6781A81704D9eaCe07AAc3c22D5bBC30C90417B` |
| Deploy tx | — |
| Verified source | — |
| Explorer | — |

**Unblock:** fund deployer with MON via [faucet.monad.xyz](https://faucet.monad.xyz) (or Alchemy/QuickNode faucets if eligible), then:

```bash
source .env
forge script script/Deploy.s.sol:DeployFleetLedger --rpc-url $MONAD_RPC_URL --broadcast -vvvv
# set FLEETLEDGER=0x... in .env
forge script script/Bootstrap.s.sol:BootstrapFleet --rpc-url $MONAD_RPC_URL --broadcast -vvvv
forge verify-contract $FLEETLEDGER FleetLedger \
  --chain 10143 \
  --verifier sourcify \
  --verifier-url https://sourcify-api-monad.blockvision.org/
```

Update this file with address + explorer URL immediately after success.

### Dashboard (hosted)

| Field | Value |
|-------|--------|
| Public URL | https://dashboard-pink-one-12.vercel.app |
| Note | Built from `dashboard/`; awaits `VITE_FLEETLEDGER` env for live seats/events |

## Deviations (implementer)

- D2 blocked on MON: deployer `0xB99348aCC284E70cD832Fec09a0fC4A88879b5ac` balance 0; `forge create` → `Signer had insufficient balance`. Official faucet bot-gated; Alchemy eligibility not met by fresh key.
