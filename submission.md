# Spark submission — TwinCheck

## Name
TwinCheck

## Description
Dual-explorer (Monadscan + MonadVision) source-verification cards for addresses in the official Monad protocols registry, with dual-principal on-chain settle and pulse on status flip.

## Problem
Integrators copy addresses from [`monad-crypto/protocols`](https://github.com/monad-crypto/protocols) (~1.7k mainnet rows) without knowing if source is verified on **both** explorers. The foundation filed this as [**issue #369**](https://github.com/monad-crypto/protocols/issues/369) — still open with no automation. Manual dual browser checks do not scale; existing tools (e.g. pev) only hit one Sourcify path.

## Solution
1. Live checker probes both explorers (zero mocks).  
2. Principals A + B co-attest matching results on TwinCheck.  
3. Dashboard shows dual-verify cards + live pulse feed.  

## Project URL
https://dashboard-pink-one-12.vercel.app

## Github repo
(this repository)

## Category
Monad Testnet (chain 10143)

## Contract address
`0x44071F6881ae0F49dD466198dA2BFe8895D8D72C`

## Demo video
(record from DEMO.md)

## Post URL
(X post after ship)

## Why elegant
- Traces to a **named** ecosystem issue, not a DeFi-safety trope  
- Dual principal matches two funded keys  
- Product is the gap: dual status itself (Vision✓ Scan✗ is a first-class card)  
