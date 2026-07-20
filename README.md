# TwinCheck

**Dual-explorer source verification for Monad's official protocol address book.**

When you copy an address from [`monad-crypto/protocols`](https://github.com/monad-crypto/protocols), TwinCheck tells you whether source is verified on **both** [Monadscan](https://monadscan.com) **and** [MonadVision](https://monadvision.com) — and posts a public on-chain pulse when that dual status flips.

> Closes the open ecosystem gap:
> [**protocols#369** — automatic check that all contracts are verified on both monadvision and monadscan](https://github.com/monad-crypto/protocols/issues/369)

## Try it in 30 seconds — no keys, no config

The checker itself is a plain read-only probe. Nothing on-chain, no accounts, no API keys:

```bash
cd cli && bun install
bun run src/index.ts probe --address 0x93FE94Ad887a1B04DBFf1f736bfcD1698D4cfF66
```

```json
{
  "address": "0x93FE94Ad887a1B04DBFf1f736bfcD1698D4cfF66",
  "dualOK": true,
  "monadscan":   { "ok": true, "signal": "verified" },
  "monadVision": { "ok": true, "signal": "exact_match" }
}
```

Exit codes are CI-friendly: `0` dual-verified, `1` genuinely unverified somewhere, `2` indeterminate (explorer timeout/rate-limit — the checker refuses to call that "unverified").

## Two layers, adopt either

**1. The reusable checker (`cli/`)** — zero-dependency-on-us dual probe of Monadscan (HTML status) + MonadVision (BlockVision Sourcify API), with per-attempt timeouts, retry with backoff, and an explicit *error* signal class so transient failures are never reported as "unverified". Invoke `twincheck probe` for each registry address in CI.

**2. The on-chain trust layer (`src/TwinCheck.sol` + `dashboard/`)** — optional, for when a status claim should be *attributable*: two independent principals each run their own probe and sign their own observation; the contract settles a card only when both independently agree, and emits `DualStatusPulse` when a settled status flips. The dashboard renders the cards and the pulse feed.

## Adopt this (the ask)

For `monad-crypto/protocols` maintainers: a scheduled CI job that runs `twincheck probe` over each address in the registry CSV and fails / opens an issue when a registry address loses dual verification. The checker is MIT, needs no keys for probing, and its exit codes are built for exactly this. We're happy to contribute the GitHub Action.

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

## CLI

```
twincheck probe --address 0x…     # live dual-explorer check (read-only, no keys)
twincheck watch --limit 10        # watch registry sample (needs keys)
twincheck check --address 0x…     # independent dual-principal probes + onchain reports
twincheck run --limit 5           # end-to-end sample
twincheck card --address 0x…      # read a settled card
```

`watch`/`check`/`run`/`card` need env: `PRIVATE_KEY`, `PRINCIPAL_B_PRIVATE_KEY`, `TWINCHECK`, `MONAD_RPC_URL`. `probe` needs nothing.

## Deploy your own trust layer

```bash
forge test --match-contract TwinCheckTest
forge script script/DeployTwinCheck.s.sol:DeployTwinCheck --rpc-url $MONAD_RPC_URL --broadcast

# verify on MonadVision
forge verify-contract $TWINCHECK src/TwinCheck.sol:TwinCheck \
  --chain 10143 --verifier sourcify \
  --verifier-url https://sourcify-api-monad.blockvision.org/ \
  --constructor-args $(cast abi-encode "constructor(address,address)" $DEPLOYER_ADDRESS $PRINCIPAL_B_ADDRESS)

cd dashboard && bun install && bun run dev   # VITE_TWINCHECK=<your deploy>
```

## Honest limits

- Dual **presence** of source verification — not bytecode equality across explorers, not a security audit.
- Explorer HTML/API signals can lag; re-run the checker.
- Monadscan forge verify needs an Etherscan API key per [Monad docs](https://docs.monad.xyz/guides/verify-smart-contract/foundry).

## Spark submission

See `submission.md` and `DEMO.md`. Axis: elegant solution to a real ecosystem problem (**#369**).

## License

[MIT](LICENSE) — take the checker, the contract, or both.
