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
import type { Address } from "viem";
import {
  getConfig,
  getProbeConfig,
  loadEnv,
  txUrl,
  addressUrl,
} from "./config";
import {
  getCode,
  hashEvidence,
  readCard,
  reportOne,
  watchBatch,
} from "./client";
import {
  evidenceHashPayload,
  hasProbeError,
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
  const cfg = getProbeConfig();
  const address = asAddr(String(flags.address));
  const r = await probeDual(address, cfg);
  printDual(r);
  // exit 0 = dual verified, 1 = genuinely not dual-verified, 2 = indeterminate
  if (hasProbeError(r)) process.exit(2);
  process.exit(r.scanOK && r.visionOK ? 0 : 1);
}

function printDual(r: DualResult, label?: string) {
  const dual = !hasProbeError(r) && r.scanOK && r.visionOK;
  console.log(
    JSON.stringify(
      {
        ...(label ? { observer: label } : {}),
        address: r.address,
        dualOK: dual,
        indeterminate: hasProbeError(r) || undefined,
        monadscan: {
          ok: r.scanOK,
          error: r.scanError || undefined,
          signal: r.scanSignal,
          url: r.scanUrl,
        },
        monadVision: {
          ok: r.visionOK,
          error: r.visionError || undefined,
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
    // TwinCheck.watch reverts AlreadyWatched — pre-check instead of burning
    // gas on a guaranteed revert (same guard dualReport already uses).
    const card = await readCard(cfg, target);
    if (card[0]) {
      console.log(`already watched ${target} — nothing to do`);
      return;
    }
    const hash = await watchBatch(cfg, cfg.keyA, [target]);
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

export type DualReportOutcome = {
  rA: DualResult;
  rB: DualResult;
  reportedA: boolean;
  reportedB: boolean;
  settled: boolean;
  dualOK: boolean;
};

/**
 * Dual-principal attestation with INDEPENDENT measurements: each principal
 * runs its own explorer probe and signs its own observation. The contract
 * settles only when both independently-observed bit sets match (and consumes
 * both observations — see TwinCheck.report). One shared measurement signed
 * twice would make the second signature meaningless.
 */
async function dualReport(
  cfg: ReturnType<typeof getConfig>,
  target: Address,
): Promise<DualReportOutcome> {
  // Ensure watched
  const card = await readCard(cfg, target);
  if (!card[0]) {
    const wh = await watchBatch(cfg, cfg.keyA, [target]);
    console.log(`watch tx ${txUrl(cfg, wh)}`);
  }

  const principals = [
    { label: "A", key: cfg.keyA },
    { label: "B", key: cfg.keyB },
  ] as const;

  const results: DualResult[] = [];
  const reported: boolean[] = [];
  for (const p of principals) {
    const r = await probeDual(target, cfg);
    printDual(r, `principal ${p.label}`);
    results.push(r);
    if (hasProbeError(r)) {
      console.error(
        `principal ${p.label}: refusing to attest ${target} — indeterminate probe ` +
          `(monadscan=${r.scanSignal}, monadVision=${r.visionSignal})`,
      );
      reported.push(false);
      continue;
    }
    const payload = evidenceHashPayload(r);
    const eh = hashEvidence(payload);
    console.log(`principal ${p.label} evidenceHash ${eh}`);
    console.log(`principal ${p.label} payload ${payload}`);
    const h = await reportOne(cfg, p.key, target, r.scanOK, r.visionOK, eh);
    console.log(`report ${p.label} ${txUrl(cfg, h)}`);
    reported.push(true);
  }

  if (!reported[0] && !reported[1]) {
    throw new Error(
      `no attestation for ${target}: both principals had indeterminate probes. ` +
        `Transient explorer failures must not be recorded on-chain as "unverified".`,
    );
  }
  const [rA, rB] = results;
  if (reported[0] && reported[1] && (rA.scanOK !== rB.scanOK || rA.visionOK !== rB.visionOK)) {
    console.error(
      `principals disagree on ${target} (A: scan=${rA.scanOK}/vision=${rA.visionOK}, ` +
        `B: scan=${rB.scanOK}/vision=${rB.visionOK}) — card stays unsettled until they agree`,
    );
  }

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
  return {
    rA,
    rB,
    reportedA: reported[0],
    reportedB: reported[1],
    settled: Boolean(after[1]),
    dualOK: Boolean(after[4]),
  };
}

async function cmdCheck(flags: Record<string, string | boolean>) {
  const cfg = getConfig();
  const target = asAddr(String(flags.address));
  // Each principal probes AND signs independently inside dualReport.
  const out = await dualReport(cfg, target);
  // exit 0 = settled dual-verified, 1 = determinate but not dual-verified,
  // 2 = at least one principal could not get a trustworthy answer
  process.exit(dualReportExitCode(out));
}

export function dualReportExitCode(out: DualReportOutcome): 0 | 1 | 2 {
  if (!out.reportedA || !out.reportedB) return 2;
  const agrees =
    out.rA.scanOK === out.rB.scanOK && out.rA.visionOK === out.rB.visionOK;
  return agrees && out.rA.scanOK && out.rA.visionOK ? 0 : 1;
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

  let failures = 0;
  for (const target of pick) {
    console.log(`\n── check ${target} ──`);
    try {
      const out = await dualReport(cfg, target);
      if (!out.reportedA || !out.reportedB) failures++;
      // polite delay for explorers + RPC
      await Bun.sleep(400);
    } catch (e) {
      failures++;
      console.error(`fail ${target}:`, e instanceof Error ? e.message : e);
    }
  }
  console.log("\ndone. open dashboard with VITE_TWINCHECK=" + cfg.twin);
  if (failures > 0) {
    console.error(`${failures}/${pick.length} addresses failed — exiting non-zero`);
    process.exit(1);
  }
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

if (import.meta.main) main();
