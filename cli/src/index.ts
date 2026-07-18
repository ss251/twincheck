#!/usr/bin/env bun
/**
 * twincheck — dual-explorer verify status for monad-crypto/protocols addresses.
 * Closes https://github.com/monad-crypto/protocols/issues/369
 *
 *   twincheck probe   — live dual-explorer check (no chain write)
 *   twincheck watch   — add addresses to onchain watchlist (principal A)
 *   twincheck check   — probe + dual-principal report onchain (A then B)
 *   twincheck card    — read settled card from chain
 *   twincheck run     — sample registry, watch, dual-report (demo path)
 */
import type { Address, Hex } from "viem";
import { getConfig, loadEnv, txUrl, addressUrl } from "./config";
import {
  getCode,
  hashEvidence,
  readCard,
  reportOne,
  watchBatch,
  watchOne,
} from "./client";
import {
  evidenceHashPayload,
  probeDual,
  type DualResult,
} from "./explorers";
import { fetchRegistryCsv, uniqueAddresses } from "./registry";

function usage(): never {
  console.log(`twincheck — dual Monadscan + MonadVision verify cards

Usage:
  twincheck probe --address 0x...
  twincheck watch --address 0x...              (or --limit N from registry)
  twincheck check --address 0x...              probe + dual-principal onchain report
  twincheck card  --address 0x...
  twincheck run   [--limit N] [--seed ADDR]    registry sample → watch → check

Env: PRIVATE_KEY, PRINCIPAL_B_PRIVATE_KEY, TWINCHECK, MONAD_RPC_URL,
     PROBE_CHAIN_ID (default 143 mainnet registry), REGISTRY_CSV_URL

Issue: https://github.com/monad-crypto/protocols/issues/369
`);
  process.exit(2);
}

function parseArgs(argv: string[]) {
  const out: Record<string, string | boolean> = {};
  const positionals: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") out.help = true;
    else if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      out[key] = val;
    } else positionals.push(a);
  }
  return { out, positionals };
}

function asAddr(s: string): Address {
  if (!/^0x[a-fA-F0-9]{40}$/.test(s)) throw new Error(`Bad address: ${s}`);
  return s as Address;
}

async function cmdProbe(flags: Record<string, string | boolean>) {
  const cfg = getConfig();
  const address = asAddr(String(flags.address));
  const r = await probeDual(address, cfg);
  printDual(r);
  process.exit(r.scanOK && r.visionOK ? 0 : 1);
}

function printDual(r: DualResult) {
  const dual = r.scanOK && r.visionOK;
  console.log(
    JSON.stringify(
      {
        address: r.address,
        dualOK: dual,
        monadscan: { ok: r.scanOK, signal: r.scanSignal, url: r.scanUrl },
        monadVision: {
          ok: r.visionOK,
          signal: r.visionSignal,
          url: r.visionUrl,
        },
        checkedAt: r.checkedAt,
      },
      null,
      2,
    ),
  );
}

async function cmdWatch(flags: Record<string, string | boolean>) {
  const cfg = getConfig();
  const code = await getCode(cfg, cfg.twin);
  if (!code || code === "0x") throw new Error(`No code at ${cfg.twin}`);

  if (flags.address) {
    const target = asAddr(String(flags.address));
    const hash = await watchOne(cfg, cfg.keyA, target);
    console.log(`watched ${target}`);
    console.log(`tx ${txUrl(cfg, hash)}`);
    return;
  }

  const limit = Number(flags.limit || "5");
  const rows = await fetchRegistryCsv(cfg.registryCsvUrl);
  const uniq = uniqueAddresses(rows).slice(0, limit);
  const targets = uniq.map((u) => asAddr(u.address));
  const hash = await watchBatch(cfg, cfg.keyA, targets);
  console.log(`watched ${targets.length} registry addresses`);
  for (const u of uniq) console.log(`  ${u.address}  ${u.label}`);
  console.log(`tx ${txUrl(cfg, hash)}`);
}

async function dualReport(cfg: ReturnType<typeof getConfig>, target: Address, r: DualResult) {
  const payload = evidenceHashPayload(r);
  const eh = hashEvidence(payload);
  console.log(`evidenceHash ${eh}`);
  console.log(`payload ${payload}`);

  // Ensure watched
  const card = await readCard(cfg, target);
  if (!card[0]) {
    const wh = await watchOne(cfg, cfg.keyA, target);
    console.log(`watch tx ${txUrl(cfg, wh)}`);
  }

  const ha = await reportOne(cfg, cfg.keyA, target, r.scanOK, r.visionOK, eh);
  console.log(`report A ${txUrl(cfg, ha)}`);
  const hb = await reportOne(cfg, cfg.keyB, target, r.scanOK, r.visionOK, eh);
  console.log(`report B ${txUrl(cfg, hb)}`);

  const after = await readCard(cfg, target);
  console.log(
    JSON.stringify(
      {
        watched: after[0],
        settled: after[1],
        scanOK: after[2],
        visionOK: after[3],
        dualOK: after[4],
        checkedAt: Number(after[5]),
        evidenceHash: after[6],
        card: addressUrl(cfg, cfg.twin),
      },
      null,
      2,
    ),
  );
}

async function cmdCheck(flags: Record<string, string | boolean>) {
  const cfg = getConfig();
  const target = asAddr(String(flags.address));
  const r = await probeDual(target, cfg);
  printDual(r);
  await dualReport(cfg, target, r);
  process.exit(r.scanOK && r.visionOK ? 0 : 1);
}

async function cmdCard(flags: Record<string, string | boolean>) {
  const cfg = getConfig();
  const target = asAddr(String(flags.address));
  const c = await readCard(cfg, target);
  console.log(
    JSON.stringify(
      {
        target,
        watched: c[0],
        settled: c[1],
        scanOK: c[2],
        visionOK: c[3],
        dualOK: c[4],
        checkedAt: Number(c[5]),
        evidenceHash: c[6],
      },
      null,
      2,
    ),
  );
}

async function cmdRun(flags: Record<string, string | boolean>) {
  const cfg = getConfig();
  const limit = Number(flags.limit || "5");
  const seed = flags.seed ? asAddr(String(flags.seed)) : null;

  // Always include issue #369 example if mainnet probe
  const issue369 = "0x93FE94Ad887a1B04DBFf1f736bfcD1698D4cfF66" as Address;

  const rows = await fetchRegistryCsv(cfg.registryCsvUrl);
  const uniq = uniqueAddresses(rows);
  console.log(`registry loaded: ${rows.length} rows, ${uniq.length} unique addresses`);
  console.log(`source: ${cfg.registryCsvUrl}`);
  console.log(`probe chain ${cfg.probeChainId} scan=${cfg.scanBase}`);

  const pick: Address[] = [];
  const seen = new Set<string>();
  const push = (a: Address) => {
    const k = a.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    pick.push(a);
  };
  if (seed) push(seed);
  push(issue369);
  for (const u of uniq) {
    if (pick.length >= limit) break;
    push(asAddr(u.address));
  }

  console.log(`\nwatching ${pick.length} addresses…`);
  const wh = await watchBatch(cfg, cfg.keyA, pick);
  console.log(`watchBatch ${txUrl(cfg, wh)}`);

  for (const target of pick) {
    console.log(`\n── probe ${target} ──`);
    try {
      const r = await probeDual(target, cfg);
      printDual(r);
      await dualReport(cfg, target, r);
      // polite delay for explorers + RPC
      await Bun.sleep(400);
    } catch (e) {
      console.error(`fail ${target}:`, e);
    }
  }
  console.log("\ndone. open dashboard with VITE_TWINCHECK=" + cfg.twin);
}

async function main() {
  loadEnv();
  const { out, positionals } = parseArgs(process.argv.slice(2));
  if (out.help || positionals.length === 0) usage();
  const cmd = positionals[0];
  try {
    if (cmd === "probe") await cmdProbe(out);
    else if (cmd === "watch") await cmdWatch(out);
    else if (cmd === "check") await cmdCheck(out);
    else if (cmd === "card") await cmdCard(out);
    else if (cmd === "run") await cmdRun(out);
    else usage();
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

main();
