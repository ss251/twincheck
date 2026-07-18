#!/usr/bin/env bun
/**
 * fleetmeter — thin CLI over FleetLedger on Monad testnet.
 *
 *   fleetmeter post   — read quota (quota-axi or JSON) → postSpend receipt tx
 *   fleetmeter gate   — canSpawn check; exit 1 on deny; optional signalDenied
 *   fleetmeter status — remaining / canSpawn snapshot
 */
import { keccak256, stringToBytes, type Hex } from "viem";
import { getConfig, txUrl, addressUrl, loadEnv } from "./config";
import { resolveQuota } from "./quota";
import {
  postSpendTx,
  readCanSpawn,
  readRemaining,
  signalDeniedTx,
  getCode,
} from "./client";

function usage(): never {
  console.log(`fleetmeter — onchain fleet quota ledger CLI

Usage:
  fleetmeter post  [--units N] [--file path.json] [--provider NAME] [--seat A|B]
  fleetmeter gate  [--cost N] [--file path.json] [--provider NAME] [--seat A|B] [--signal]
  fleetmeter status [--seat A|B]

Env (repo .env or process):
  PRIVATE_KEY, FLEETLEDGER, MONAD_RPC_URL, MONAD_CHAIN_ID
  POOL_ID, SEAT_ID, SEAT_B_ID (labels hashed to bytes32 if not 0x…)
  FLEETMETER_QUOTA_FILE (optional JSON stub)

Quota source order for post/gate:
  1. --units N
  2. --file / FLEETMETER_QUOTA_FILE
  3. quota-axi --json (if installed)
  4. cli/examples/quota.json documented stub
`);
  process.exit(2);
}

function parseArgs(argv: string[]) {
  const out: Record<string, string | boolean> = {};
  const positionals: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--signal") out.signal = true;
    else if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      out[key] = val;
    } else positionals.push(a);
  }
  return { out, positionals };
}

function seatFor(cfg: ReturnType<typeof getConfig>, which?: string): Hex {
  if (!which || which === "A" || which === "a" || which === "seat-a") return cfg.seatId;
  if (which === "B" || which === "b" || which === "seat-b") {
    if (!cfg.seatBId) throw new Error("SEAT_B_ID not configured");
    return cfg.seatBId;
  }
  // raw label or hex
  if (which.startsWith("0x") && which.length === 66) return which as Hex;
  return keccak256(stringToBytes(which));
}

async function cmdPost(flags: Record<string, string | boolean>) {
  const cfg = getConfig();
  const code = await getCode(cfg, cfg.ledger);
  if (!code || code === "0x") {
    throw new Error(`No contract code at ${cfg.ledger}. Deploy first (D2).`);
  }

  const quota = await resolveQuota({
    units: flags.units !== undefined ? BigInt(String(flags.units)) : undefined,
    file: flags.file ? String(flags.file) : undefined,
    provider: flags.provider ? String(flags.provider) : undefined,
  });

  const seatId = seatFor(cfg, flags.seat ? String(flags.seat) : undefined);
  const receiptHash = keccak256(
    stringToBytes(`${quota.receiptLabel}:${Date.now()}`),
  );

  console.log(
    JSON.stringify(
      {
        action: "post",
        ledger: cfg.ledger,
        seatId,
        units: quota.units.toString(),
        source: quota.source,
        provider: quota.provider,
        percentUsed: quota.percentUsed,
        receiptHash,
      },
      null,
      2,
    ),
  );

  const ok = await readCanSpawn(cfg, seatId, quota.units);
  if (!ok) {
    console.error("canSpawn=false — refusing to post (use `fleetmeter gate` for loud deny)");
    process.exit(1);
  }

  const hash = await postSpendTx(cfg, seatId, quota.units, receiptHash);
  const remaining = await readRemaining(cfg, seatId);
  console.log(
    JSON.stringify(
      {
        ok: true,
        tx: hash,
        explorer: txUrl(cfg, hash),
        remaining: remaining.toString(),
      },
      null,
      2,
    ),
  );
}

async function cmdGate(flags: Record<string, string | boolean>) {
  const cfg = getConfig();
  const seatId = seatFor(cfg, flags.seat ? String(flags.seat) : undefined);

  let cost: bigint;
  if (flags.cost !== undefined) {
    cost = BigInt(String(flags.cost));
  } else {
    const quota = await resolveQuota({
      units: flags.units !== undefined ? BigInt(String(flags.units)) : undefined,
      file: flags.file ? String(flags.file) : undefined,
      provider: flags.provider ? String(flags.provider) : undefined,
    });
    cost = quota.units;
    console.error(`gate cost from ${quota.source}: ${cost}`);
  }

  const allowed = await readCanSpawn(cfg, seatId, cost);
  const remaining = await readRemaining(cfg, seatId);

  console.log(
    JSON.stringify(
      {
        action: "gate",
        ledger: cfg.ledger,
        seatId,
        cost: cost.toString(),
        canSpawn: allowed,
        remaining: remaining.toString(),
        contract: addressUrl(cfg, cfg.ledger),
      },
      null,
      2,
    ),
  );

  if (allowed) {
    process.exit(0);
  }

  // Loud denial path
  if (flags.signal) {
    const reason = keccak256(stringToBytes(`denied:${cost}:${Date.now()}`));
    try {
      const hash = await signalDeniedTx(cfg, seatId, cost, reason);
      console.error(`Denied onchain: ${txUrl(cfg, hash)}`);
    } catch (e) {
      console.error("signalDenied failed:", e);
    }
  }

  console.error("DENIED: canSpawn=false — spawn blocked by FleetLedger");
  process.exit(1);
}

async function cmdStatus(flags: Record<string, string | boolean>) {
  const cfg = getConfig();
  const seatId = seatFor(cfg, flags.seat ? String(flags.seat) : undefined);
  const remaining = await readRemaining(cfg, seatId);
  const sample = 1n;
  const can = await readCanSpawn(cfg, seatId, sample);
  console.log(
    JSON.stringify(
      {
        ledger: cfg.ledger,
        explorer: addressUrl(cfg, cfg.ledger),
        seatId,
        remaining: remaining.toString(),
        canSpawn1: can,
      },
      null,
      2,
    ),
  );
}

async function main() {
  loadEnv();
  const argv = process.argv.slice(2);
  const { out, positionals } = parseArgs(argv);
  if (out.help || positionals.length === 0) usage();

  const cmd = positionals[0];
  try {
    if (cmd === "post") await cmdPost(out);
    else if (cmd === "gate") await cmdGate(out);
    else if (cmd === "status") await cmdStatus(out);
    else usage();
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

main();
