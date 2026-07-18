# Deployments — TwinCheck

## Monad Testnet (chain id `10143`)

| Field | Value |
|-------|--------|
| Network | Monad Testnet |
| Chain ID | `10143` |
| RPC | `https://testnet-rpc.monad.xyz` |
| Explorer (Vision) | https://testnet.monadvision.com |
| Explorer (Scan) | https://testnet.monadscan.com |

### TwinCheck (Spark shipping entry)

| Field | Value |
|-------|--------|
| Address | [`0x44071F6881ae0F49dD466198dA2BFe8895D8D72C`](https://testnet.monadvision.com/address/0x44071F6881ae0F49dD466198dA2BFe8895D8D72C) |
| Attestor A | `0xB99348aCC284E70cD832Fec09a0fC4A88879b5ac` |
| Attestor B | `0xe6781A81704D9eaCe07AAc3c22D5bBC30C90417B` |
| Deploy script | `script/DeployTwinCheck.s.sol` |
| Broadcast | `broadcast/DeployTwinCheck.s.sol/10143/run-latest.json` |
| Vision source | **exact_match** via Sourcify (`sourcify-api-monad.blockvision.org`) |
| Scan source | Submit with `forge verify-contract … --verifier etherscan --etherscan-api-key <key>` per [Monad docs](https://docs.monad.xyz/guides/verify-smart-contract/foundry) — TwinCheck **detects** scan unverified as product signal |

### Hosted dashboard

| Field | Value |
|-------|--------|
| Production URL | **https://dashboard-pink-one-12.vercel.app** |
| Deployment | https://dashboard-dxfpmqp0n-thescoho.vercel.app |
| Env | `VITE_TWINCHECK=0x44071F6881ae0F49dD466198dA2BFe8895D8D72C` |

### Sample live cards (post-checker)

| Target | scanOK | visionOK | dualOK | Notes |
|--------|--------|----------|--------|-------|
| TwinCheck self | false | true | false | Split — Vision verified, Scan not |
| `0x93FE94…F66` (#369 example) | true | true | true | Mainnet registry dual OK |
| Cycle ZkEVM | true | true | true | Registry sample |
| Cycle bridge | false | false | false | Unverified both |

### Historical (dead — not submission)

| Contract | Address |
|----------|---------|
| DoneStamp | `0x6e234b4839641158B4E88Db59037B178BfcC31C8` |
| FleetLedger | `0x3CE554b355002d6cc5d07Dd670c149815aFa3d14` |
