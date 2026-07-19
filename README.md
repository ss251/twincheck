# TwinCheck

**Dual-explorer source verification for Monad’s official protocol address book.**

When you copy an address from [`monad-crypto/protocols`](https://github.com/monad-crypto/protocols), TwinCheck tells you whether source is verified on **both** [Monadscan](https://monadscan.com) **and** [MonadVision](https://monadvision.com) — and posts a public on-chain pulse when that dual status flips.

> Closes the open ecosystem gap:  
> [**protocols#369** — automatic check that all contracts are verified on both monadvision and monadscan](https://github.com/monad-crypto/protocols/issues/369)

This is a problem the **Monad ecosystem** has — not a generic rug-checker.

## Why TwinCheck

| Today | TwinCheck |
|-------|-----------|
| Hand-open both explorers for ~1.7k registry addresses | Live dual probe + dual-principal on-chain card |
| pev / tools only hit one Sourcify path | Explicit dual status: scanOK × visionOK |
| Split status is invisible | Settled cards + `DualStatusPulse` events |

## Live (Monad Testnet)

| | |
|--|--|
| **Contract** | [`0x44071F6881ae0F49dD466198dA2BFe8895D8D72C`](https://testnet.monadvision.com/address/0x44071F6881ae0F49dD466198dA2BFe8895D8D72C) |
| **Chain** | Monad Testnet `10143` |
| **Attestor A** | `0xB99348aCC284E70cD832Fec09a0fC4A88879b5ac` |
| **Attestor B** | `0xe6781A81704D9eaCe07AAc3c22D5bBC30C90417B` |
| **Dashboard** | see `DEPLOYMENTS.md` |
| **Vision verify** | Sourcify **exact_match** |
| **Scan verify** | requires Etherscan API key (docs); TwinCheck *detects* unverified on scan as the product |

## Architecture

1. **Contract** (`src/TwinCheck.sol`) — watchlist + dual-principal `report` → settle; pulse on flip  
2. **Checker** (`cli/`) — loads official CSV, probes both explorers (zero mocks), attests with keys A then B  
3. **Dashboard** (`dashboard/`) — dual-verify cards + live event feed  

## Quick start

```bash
# env: PRIVATE_KEY, PRINCIPAL_B_PRIVATE_KEY, TWINCHECK, MONAD_RPC_URL
cp .env.example .env   # fill keys

forge test --match-contract TwinCheckTest
forge script script/DeployTwinCheck.s.sol:DeployTwinCheck --rpc-url $MONAD_RPC_URL --broadcast

# verify on MonadVision
forge verify-contract $TWINCHECK src/TwinCheck.sol:TwinCheck \
  --chain 10143 --verifier sourcify \
  --verifier-url https://sourcify-api-monad.blockvision.org/ \
  --constructor-args $(cast abi-encode "constructor(address,address)" $DEPLOYER_ADDRESS $PRINCIPAL_B_ADDRESS)

cd cli && bun install
bun run src/index.ts probe --address 0x93FE94Ad887a1B04DBFf1f736bfcD1698D4cfF66
bun run src/index.ts run --limit 5

cd ../dashboard && bun install && bun run dev
```

## CLI

```
twincheck probe --address 0x…     # live dual-explorer check
twincheck watch --limit 10        # watch registry sample
twincheck check --address 0x…     # probe + dual-principal onchain report
twincheck run --limit 5           # end-to-end sample
twincheck card --address 0x…
```

## Honest limits

- Dual **presence** of source verification — not bytecode equality across explorers, not a security audit.
- Explorer HTML/API signals can lag; re-run the checker.
- Monadscan forge verify needs an Etherscan API key per [Monad docs](https://docs.monad.xyz/guides/verify-smart-contract/foundry).

## Spark submission

See `submission.md` and `DEMO.md`. Axis: elegant solution to a real ecosystem problem (**#369**).

## License

[MIT](LICENSE).
