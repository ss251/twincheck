I'll pull Monad testnet build-prep facts from official docs and recent developer reports, then cite each claim.Opening the key official guides for RPC, verification, Foundry deploy, and gas/EVM differences.# Monad Testnet Build-Prep (Foundry / Solidity) — 2026-07-18

Research from official Monad docs (`docs.monad.xyz`) plus recent infra/status pages. Every claim is cited; **unverified / doc-drift** items are flagged.

---

## 1) RPC URL(s) and chain ID

| Field | Value |
| --- | --- |
| **Chain ID** | `10143` |
| **Network name** | Monad Testnet |
| **Native currency** | `MON` |
| **Primary public RPC (HTTP)** | `https://testnet-rpc.monad.xyz` |
| **Primary public RPC (WSS)** | `wss://testnet-rpc.monad.xyz` |

Official sources: testnet network page + wallet-add guide.

### Public RPCs (official table)

| URL | Provider | Rate limits | Batch | Archive | Notes |
| --- | --- | --- | --- | --- | --- |
| `https://testnet-rpc.monad.xyz` / `wss://testnet-rpc.monad.xyz` | QuickNode | **50 rps** | 100 | ✅ | **25 rps** for `eth_call` and `eth_estimateGas` |
| `https://rpc.ankr.com/monad_testnet` | Ankr | 300 reqs / 10s; 12 000 / 10 min | 100 | ❌ | `debug_*` not allowed |
| `https://rpc-testnet.monadinfra.com` / `wss://rpc-testnet.monadinfra.com` | Monad Foundation | **20 rps** | not allowed | ✅ | — |

Source: [Network Information – Testnets](https://docs.monad.xyz/developer-essentials/testnets).

Wallet config matches: RPC `https://testnet-rpc.monad.xyz`, chain ID `10143`, explorer `https://testnet.monadvision.com`. Source: [Add Monad Testnet to Wallet](https://docs.monad.xyz/guides/add-monad-to-wallet/testnet).

**Foundry `foundry.toml` snippet (official deploy guide):**

```toml
[profile.default]
eth-rpc-url = "https://testnet-rpc.monad.xyz"
chain_id = 10143
```

Source: [Deploy with Monad Foundry](https://docs.monad.xyz/guides/deploy-smart-contract/foundry).

**Also note:** docs list a separate **tempnet** (chain ID `20143`) for experimental features (e.g. opcode pricing sandbox); access is form + Dev Discord, not the default public testnet. Source: [Testnets](https://docs.monad.xyz/developer-essentials/testnets).

---

## 2) MON testnet faucet — URL, limits, requirements

### Official

| Item | Value |
| --- | --- |
| **Official faucet** | [https://faucet.monad.xyz](https://faucet.monad.xyz) |
| Also linked from docs | [https://testnet.monad.xyz](https://testnet.monad.xyz) (app hub / faucet entry) |

Sources: [Testnets](https://docs.monad.xyz/developer-essentials/testnets), [Deploy Foundry guide](https://docs.monad.xyz/guides/deploy-smart-contract/foundry), faucet site.

**What the official faucet page states clearly:**

- Tokens are for development only (no real value).
- **Connect X and Discord** to get **more** tokens.
- Network has very fast blocks / finality (FAQ mentions **400 ms blocks and 800 ms finality** in the question text).
- “Add Testnet” helper on the faucet site.

Source: [faucet.monad.xyz](https://faucet.monad.xyz/).

### Rate limits / eligibility — **partially unverified on official surface**

The official faucet FAQ headings (“How do I get more…?”, “Why can’t I get tokens?”) are present, but the **static page scrape does not expose concrete drip amounts or cooldowns**. Treat exact official drip size / cooldown as **verify live in the UI**.

**Third-party faucets (useful backups; not official Monad):**

| Provider | Claimed limit / requirements | URL |
| --- | --- | --- |
| **Alchemy** | **1 MON / day**; eligibility: ≥ **0.001 ETH** on Ethereum mainnet + sufficient mainnet activity + not too high existing testnet balance | [alchemy.com/faucets/monad-testnet](https://www.alchemy.com/faucets/monad-testnet) |
| **QuickNode** | One drip per network every **12 hours** | [faucet.quicknode.com/monad](https://faucet.quicknode.com/monad) |
| **thirdweb** | UI text previously showed **0.01 MON/day** (third-party; may change) | [thirdweb.com/monad-testnet](https://thirdweb.com/monad-testnet) |
| **Chainlink** | Separate token faucet for Monad testnet assets | [faucets.chain.link/monad-testnet](https://faucets.chain.link/monad-testnet) |

Secondary writeup (Backpack, **not official**, may be stale): official faucet historically described as needing mainnet ETH balance + prior txs and ~6h cooldown — **treat as unverified against today’s official UI**. Source: [Backpack Monad faucet guide](https://learn.backpack.exchange/articles/monad-faucet).

---

## 3) Block explorers + contract verification (Foundry)

### Explorers (testnet)

| Explorer | URL | Backend style |
| --- | --- | --- |
| **MonadVision** (BlockVision) | [https://testnet.monadvision.com](https://testnet.monadvision.com) | Sourcify-style verification |
| **Monadscan** (Etherscan) | [https://testnet.monadscan.com](https://testnet.monadscan.com) | Etherscan API verification |
| Network viz | [https://www.gmonads.com/?network=testnet](https://www.gmonads.com/?network=testnet) | — |

Source: [Testnets](https://docs.monad.xyz/developer-essentials/testnets).

Manual UI verify (MonadVision): [https://testnet.monadvision.com/verify-contract](https://testnet.monadvision.com/verify-contract).

### Foundry verification — official commands (testnet)

Docs recommend **Monad Foundry**. Two paths:

**A) MonadVision via Sourcify (BlockVision API) — no Etherscan key**

```bash
forge verify-contract \
  <contract_address> \
  <contract_name> \
  --chain 10143 \
  --verifier sourcify \
  --verifier-url https://sourcify-api-monad.blockvision.org/
```

**B) Monadscan via Etherscan-compatible verifier — needs API key**

```bash
forge verify-contract \
  <contract_address> \
  <contract_name> \
  --chain 10143 \
  --verifier etherscan \
  --etherscan-api-key YourApiKeyToken \
  --watch
```

Recommended `foundry.toml` metadata settings for verification:

```toml
metadata = true
metadata_hash = "none"
use_literal_content = true
eth-rpc-url = "https://testnet-rpc.monad.xyz"
chain_id = 10143
```

Source: [Verify with Foundry](https://docs.monad.xyz/guides/verify-smart-contract/foundry).

### Verifier summary

| Path | Verifier flag | API / URL | Explorer |
| --- | --- | --- | --- |
| Sourcify (custom Monad endpoint) | `--verifier sourcify` | `https://sourcify-api-monad.blockvision.org/` | MonadVision |
| Etherscan-compatible | `--verifier etherscan` | Monadscan API key (`--etherscan-api-key`) | Monadscan |
| Blockscout | — | **Not** the primary path in official Monad Foundry docs | — |

Related: BlockVision verify guide for Monad explorer: [docs.blockvision.org – verify on Monad](https://docs.blockvision.org/reference/verify-smart-contract-on-monad-explorer).

---

## 4) Known Foundry / deploy gotchas on Monad testnet

### A. Use **Monad Foundry**, not stock Foundry alone

Official recommendation: custom fork with Monad gas model, opcode pricing, precompiles, and verification bytecode comparison.

```bash
curl -L https://foundry.category.xyz | bash
foundryup --network monad
# template
forge init --template monad-developers/foundry-monad [project_name]
```

Deploy example:

```bash
forge create src/Counter.sol:Counter --account monad-deployer --broadcast
```

Sources: [Monad Foundry](https://docs.monad.xyz/tooling-and-infra/toolkits/monad-foundry), [Deploy guide](https://docs.monad.xyz/guides/deploy-smart-contract/foundry), [Deployment summary](https://docs.monad.xyz/developer-essentials/summary).

Canonical **Foundry Deterministic Deployer** on testnet: `0x4e59b44847b379578588920cA78FbF26c0B4956C` (same CREATE2 deployer address pattern as Ethereum). Source: [Testnets – Canonical Contracts](https://docs.monad.xyz/developer-essentials/testnets).

---

### B. Gas: charged on **gas_limit**, not gas_used (biggest gotcha)

On Monad:

```text
gas_paid = gas_limit * price_per_gas
```

There are **no gas refunds**. Charging full limit is a DoS-prevention design for asynchronous execution.  
Sources: [Gas Pricing](https://docs.monad.xyz/developer-essentials/gas-pricing), [Differences](https://docs.monad.xyz/developer-essentials/differences), [Summary](https://docs.monad.xyz/developer-essentials/summary).

**Practical deploy impact:**

- Over-estimating `gas_limit` **costs real MON** (testnet or mainnet).
- MetaMask / some wallets, if `eth_estimateGas` reverts, set a **very high** gas limit — catastrophic on Monad because the full limit is charged. Docs explicitly recommend: **if gas is constant, set `gas` explicitly** before the wallet.
- Source: [Gas Pricing – Recommendations](https://docs.monad.xyz/developer-essentials/gas-pricing).

**Limits:**

| Param | Value |
| --- | --- |
| Per-tx gas limit | **30M** |
| Block gas limit | **200M** |
| Block gas target | 80% (160M) |
| Min base fee | **100 MON-gwei** (`100 * 10^-9` MON) |
| Pricing model | EIP-1559-compatible (base + priority) |

Source: [Summary](https://docs.monad.xyz/developer-essentials/summary) / [Gas Pricing](https://docs.monad.xyz/developer-essentials/gas-pricing).

RPC note: public QuickNode endpoint rate-limits `eth_estimateGas` more tightly (**25 rps**). Source: [Testnets RPC table](https://docs.monad.xyz/developer-essentials/testnets).

---

### C. EVM / opcode / precompile differences

From official differences + summary:

| Topic | Monad behavior |
| --- | --- |
| Max **contract** size | **128 KB** (vs 24 KB on Ethereum) |
| Max **initcode** size | **256 KB** |
| Opcode support | All opcodes as of **Fusaka** fork |
| Precompiles | Ethereum `0x01`–`0x11` as of Fusaka, plus **P256** at `0x0100` (EIP-7951), **staking** at `0x1000` |
| Repriced costs | Higher cold account access (**10 100** vs 2 600) and cold storage (**8 100** vs 2 100); some crypto precompiles also repriced |
| Tx types | Supported: 0, 1, 2, 4 (EIP-7702). **Not supported: type 3 (EIP-4844 blobs)** |
| EIP-7702 caveats | Delegated EOA cannot drop below **10 MON** reserve; delegated code cannot `CREATE`/`CREATE2` when called as contract |

Sources: [Differences](https://docs.monad.xyz/developer-essentials/differences), [Summary](https://docs.monad.xyz/developer-essentials/summary), [Monad Foundry features](https://docs.monad.xyz/tooling-and-infra/toolkits/monad-foundry).

**Solidity / `evm_version`:** Official Remix guide uses compiler **0.8.24**. Docs do **not** prescribe a single Foundry `evm_version` string in the deploy guide — use a modern compiler that targets the opcodes you need (Osaka/CLZ etc. were activated under MONAD_NINE / related releases). **Exact solc `evm_version` pin is partially left to tooling defaults** — prefer Monad Foundry local tests so gas/precompile behavior matches chain.

---

### D. Reserve balance / inclusion quirks

- Default **reserve balance: 10 MON**.
- Consensus can include txs that later **revert** for reserve-balance reasons; still pay gas.
- Affects aggressive multi-send / low-balance deploy scripts more than a well-funded deployer.

Sources: [Differences](https://docs.monad.xyz/developer-essentials/differences), [Summary – Reserve balance](https://docs.monad.xyz/developer-essentials/summary).

---

### E. Blocktime / finality / TIMESTAMP quirks

From deployment summary (baseline docs):

| Item | Documented value |
| --- | --- |
| Block frequency | **400 ms** |
| Finality | **2 blocks (~800 ms)** |
| Speculative finality | **1 block (~400 ms)** |
| `TIMESTAMP` | Second granularity → **2–3 blocks can share the same timestamp** |
| Mempool | **No global mempool** — local forwarding to upcoming leaders |

Source: [Summary – Timing / Mempool](https://docs.monad.xyz/developer-essentials/summary).

**⚠️ Doc drift / version note (important for “today”):**

- Network info page currently labels testnet **v0.14.5 / MONAD_NINE**.
- Releases page documents **v0.15.0 hard fork on testnet** at round ~43821000 (**~2026-07-09 14:30 UTC**), including **MIP-12: block times 400 ms → 300 ms** (rewards adjusted).

So: treat **~300 ms block time** as the post–Jul-9 testnet reality if your node/RPC is on v0.15.0+, while older summary pages may still say 400 ms. Confirm with live block timestamps if timing-sensitive.  
Sources: [Testnets version row](https://docs.monad.xyz/developer-essentials/testnets), [Releases v0.15.0](https://docs.monad.xyz/developer-essentials/changelog/releases).

Historical: testnet was **reset from genesis on 2025-12-16** (v0.12.5) — any pre-reset addresses/scripts need redeploy. Source: [Testnets warning](https://docs.monad.xyz/developer-essentials/testnets).

---

### F. Other deploy-adjacent notes

- Parallel execution / JIT: **no contract-level code changes required**; serial semantics preserved. Source: [Summary](https://docs.monad.xyz/developer-essentials/summary).
- Full nodes do **not** expose arbitrary historic state (high throughput). Source: [Differences – Historical Data](https://docs.monad.xyz/developer-essentials/differences).
- Local fork: `anvil --fork-url https://testnet-rpc.monad.xyz` (Monad EVM auto-detected by chain ID) or `anvil --monad`. Source: [Monad Foundry](https://docs.monad.xyz/tooling-and-infra/toolkits/monad-foundry).
- Tooling pins: Foundry → Monad fork; **viem ≥ 2.40.0**. Source: [Summary](https://docs.monad.xyz/developer-essentials/summary).

---

## 5) Stability this week (as of 2026-07-18)

### What supports “stable enough to build”

| Signal | Finding |
| --- | --- |
| Official docs | Testnet listed as **primary** environment with “hundreds of apps”; public RPCs documented with limits |
| Alchemy multi-chain status | **Monad: Operational**; Jul 17–18 show **no Monad incidents** on Alchemy’s page |
| Alchemy status “today” | “No incidents reported today” (Jul 18) / none on Jul 17 |

Sources: [Testnets](https://docs.monad.xyz/developer-essentials/testnets), [status.alchemy.com](https://status.alchemy.com/).

### Known recent noise (mostly infra / scheduled, not “testnet dead”)

| Date | Item | Severity for builders |
| --- | --- | --- |
| **~2026-07-09** | Official **v0.15.0 testnet hard fork** (block time change, RPC batch concurrency caps, etc.) | Expect client/docs lag; re-check RPC behavior after upgrades |
| **~2026-07-03** | Chainstack reported **Monad Testnet 503s** (provider incident) | Prefer multi-RPC; not necessarily chain halt |
| **~2026-07-23 (upcoming)** | **Mainnet** v0.15.1 hard-fork schedule listed (~14:30 UTC) | Mainnet-facing; less critical for pure testnet deploys unless tooling shares config |

Sources: [Releases](https://docs.monad.xyz/developer-essentials/changelog/releases), [Chainstack incident mirror](https://isdown.app/status/chainstack/incidents/617206-monad-testnet-503-s-response-codes-observed).

### Verdict (honest)

**No evidence of a chain-wide Monad testnet outage this week** from official release notes or Alchemy’s Monad operational status. Network is **under active protocol revision** (v0.15.x line, block-time change). For a build starting **today**:

1. Use **multi-RPC** (Foundation + QuickNode + Ankr).
2. Prefer **Monad Foundry**.
3. **Never** rely on wallet auto-gas after failed estimates.
4. Verify live faucet drip in UI before assuming third-party limits.

**Unverified:** live TPS / inclusion latency right now, exact official faucet drip numbers, and whether every public RPC is fully on 300 ms post-fork — check a recent block on [testnet.monadvision.com](https://testnet.monadvision.com) or `cast block --rpc-url https://testnet-rpc.monad.xyz`.

---

## Quick start checklist (copy-paste)

```bash
# 1) Monad Foundry
curl -L https://foundry.category.xyz | bash
foundryup --network monad

# 2) Project
forge init --template monad-developers/foundry-monad my-monad-app
cd my-monad-app
# foundry.toml already aims at:
#   eth-rpc-url = "https://testnet-rpc.monad.xyz"
#   chain_id = 10143

# 3) Fund via https://faucet.monad.xyz  (+ X/Discord for more)
#    backup: https://www.alchemy.com/faucets/monad-testnet

# 4) Deploy (keystore preferred)
forge create src/Counter.sol:Counter --account <account> --broadcast

# 5) Verify (MonadVision / Sourcify)
forge verify-contract <ADDR> Counter \
  --chain 10143 \
  --verifier sourcify \
  --verifier-url https://sourcify-api-monad.blockvision.org/
```

---

## Primary source index

| Topic | URL |
| --- | --- |
| Testnet network + RPCs + faucet + explorers | https://docs.monad.xyz/developer-essentials/testnets |
| Wallet add | https://docs.monad.xyz/guides/add-monad-to-wallet/testnet |
| Deploy Foundry | https://docs.monad.xyz/guides/deploy-smart-contract/foundry |
| Verify Foundry | https://docs.monad.xyz/guides/verify-smart-contract/foundry |
| Monad Foundry toolkit | https://docs.monad.xyz/tooling-and-infra/toolkits/monad-foundry |
| Eth differences | https://docs.monad.xyz/developer-essentials/differences |
| Gas pricing | https://docs.monad.xyz/developer-essentials/gas-pricing |
| Deployer summary | https://docs.monad.xyz/developer-essentials/summary |
| Releases / hard forks | https://docs.monad.xyz/developer-essentials/changelog/releases |
| Official faucet | https://faucet.monad.xyz |

---

**Flagged unverified / soft:** exact official faucet drip amount & cooldown (UI-only); third-party faucet numbers; post–Jul-9 block interval still printed as 400 ms on some summary pages vs 300 ms in v0.15.0 release notes.
