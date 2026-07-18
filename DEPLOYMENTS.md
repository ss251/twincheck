# Deployments

## Monad Testnet (chain id `10143`)

| Field | Value |
|-------|--------|
| Network | Monad Testnet |
| Chain ID | `10143` |
| RPC | `https://testnet-rpc.monad.xyz` |
| Explorer | https://testnet.monadvision.com |
| Faucet | https://faucet.monad.xyz |

Sources: [Monad testnets docs](https://docs.monad.xyz/developer-essentials/testnets) (fetched 2026-07-18).

### FleetLedger

| Field | Value |
|-------|--------|
| Address | [`0x3CE554b355002d6cc5d07Dd670c149815aFa3d14`](https://testnet.monadvision.com/address/0x3CE554b355002d6cc5d07Dd670c149815aFa3d14) |
| Deployer (principal A) | `0xB99348aCC284E70cD832Fec09a0fC4A88879b5ac` |
| Principal B | `0xe6781A81704D9eaCe07AAc3c22D5bBC30C90417B` |
| Deploy tx | [`0x4b422e12c8f2bcf4d43c791f890028e85a39456ff96301625ccbe40b95129dfa`](https://testnet.monadvision.com/tx/0x4b422e12c8f2bcf4d43c791f890028e85a39456ff96301625ccbe40b95129dfa) |
| Verified source | **exact_match** via Sourcify (`sourcify-api-monad.blockvision.org`) |
| Explorer | https://testnet.monadvision.com/address/0x3CE554b355002d6cc5d07Dd670c149815aFa3d14 |

### Bootstrap (two-principal pool)

| Field | Value |
|-------|--------|
| Pool label | `fleetmeter-spark` |
| Pool id | `0x32815c174529d9368dd57b30cfc9bf746315087a001b616363c14e08e1e1f7f4` |
| Seat A (`seat-principal-a`) | `0x91fbaaa3bb8aac6f0e21cac1c21729c5093bd24d361409ce3eb41592ddc3eebe` → controller A |
| Seat B (`seat-principal-b`) | `0xbe8dca2292bf285bd67b81f43b2fb4ad937f0c1422abfec24f2ac024a9e4185f` → controller B |
| Seat cap / pool ceiling | 10_000_000 / 15_000_000 micro-USD units |
| Window | 5 hours (18_000 s) |
| Bootstrap broadcast | `broadcast/Bootstrap.s.sol/10143/run-latest.json` |

### Sample live receipts (CLI)

| Action | Tx |
|--------|-----|
| `post` allow 100_000 | [`0x40a463c9…af4550`](https://testnet.monadvision.com/tx/0x40a463c900bd3b93ba5b6b1b3aae441d533f38cd70afdfc6ff893bc626af4550) |
| `post` fill seat A | [`0x5bb9d6fc…7e7269`](https://testnet.monadvision.com/tx/0x5bb9d6fcdcacd0a0e2c46a13ea17331e2066a62e9e600144aa86a2ed7e7e7269) |
| `gate --signal` Denied | [`0x0708efdc…9792ae`](https://testnet.monadvision.com/tx/0x0708efdc48bbdd323aef2ef664923e76b8df74a39263faae80dd1481909792ae) |

### Dashboard (hosted)

| Field | Value |
|-------|--------|
| Public URL | https://dashboard-pink-one-12.vercel.app |
| Env | `VITE_FLEETLEDGER=0x3CE554b355002d6cc5d07Dd670c149815aFa3d14` |
