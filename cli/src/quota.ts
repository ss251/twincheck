import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Quota source for fleetmeter post.
 *
 * Priority:
 * 1. `quota-axi --json` (local multi-provider quota windows) if available
 * 2. JSON file path via --file / FLEETMETER_QUOTA_FILE
 * 3. Explicit --units override
 *
 * Units are abstract micro-USD. We map percent-used deltas into a cost using
 * SEAT_CAP_UNITS (default 10_000_000 = $10 if 1e6 micro = $1).
 */

export type QuotaSnapshot = {
  source: string;
  provider?: string;
  windowId?: string;
  percentUsed?: number;
  percentRemaining?: number;
  /** Derived or explicit spend units for this receipt. */
  units: bigint;
  receiptLabel: string;
  raw?: unknown;
};

export type QuotaOptions = {
  units?: bigint;
  file?: string;
  provider?: string;
  /** Cap used to convert percentUsed → units when reading live quota. */
  seatCapUnits?: bigint;
  /** Optional previous percentUsed for delta costing (default: cost = (100-remaining)% of cap / 100). */
  deltaMode?: boolean;
};

const DEFAULT_CAP = 10_000_000n;

async function runQuotaAxi(provider?: string): Promise<unknown | null> {
  const args = ["--json"];
  if (provider) args.push("--provider", provider);
  try {
    const proc = Bun.spawn(["quota-axi", ...args], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const out = await new Response(proc.stdout).text();
    const code = await proc.exited;
    if (code !== 0) return null;
    return JSON.parse(out);
  } catch {
    return null;
  }
}

function pickWindow(
  data: any,
  providerPref?: string,
): { provider: string; window: any } | null {
  const providers: any[] = data?.providers ?? [];
  if (!providers.length) return null;

  const order = providerPref
    ? [providerPref, ...providers.map((p) => p.provider)]
    : ["claude", "codex", "grok", "cursor", "copilot"];

  for (const name of order) {
    const p = providers.find((x) => x.provider === name);
    if (!p?.windows?.length) continue;
    // Prefer session / five_hour window
    const win =
      p.windows.find((w: any) => w.kind === "session" || w.id === "five_hour") ||
      p.windows[0];
    return { provider: p.provider, window: win };
  }
  return null;
}

function unitsFromPercent(percentUsed: number, cap: bigint): bigint {
  // Cost of a representative action: 1% of seat cap, minimum 1 unit.
  // percentUsed is the live window utilization; we post a small receipt proportional
  // to remaining pressure so the ledger tracks real fleet heat.
  const pct = Math.max(0, Math.min(100, percentUsed));
  // Use max(1, round(cap * max(1, 100-remaining) / 100 / 50)) as a modest action cost
  // when only a snapshot is available (not a true delta).
  const heat = Math.max(1, Math.round(pct / 5)); // 0-20 "ticks"
  const units = (cap * BigInt(heat)) / 100n;
  return units > 0n ? units : 1n;
}

function fromFile(path: string, cap: bigint): QuotaSnapshot {
  const abs = resolve(path);
  if (!existsSync(abs)) throw new Error(`Quota file not found: ${abs}`);
  const raw = JSON.parse(readFileSync(abs, "utf8"));

  if (typeof raw.units === "number" || typeof raw.units === "string") {
    return {
      source: `file:${abs}`,
      units: BigInt(raw.units),
      receiptLabel: raw.receiptLabel || raw.tag || "file-quota",
      provider: raw.provider,
      windowId: raw.windowId,
      percentUsed: raw.percentUsed,
      percentRemaining: raw.percentRemaining,
      raw,
    };
  }

  if (typeof raw.percentUsed === "number") {
    return {
      source: `file:${abs}`,
      units: unitsFromPercent(raw.percentUsed, cap),
      receiptLabel: raw.receiptLabel || "file-percent",
      percentUsed: raw.percentUsed,
      percentRemaining: raw.percentRemaining,
      raw,
    };
  }

  throw new Error(
    `Quota file must include "units" (int) or "percentUsed" (0-100). See cli/examples/quota.json`,
  );
}

export async function resolveQuota(opts: QuotaOptions = {}): Promise<QuotaSnapshot> {
  const cap = opts.seatCapUnits ?? DEFAULT_CAP;

  if (opts.units !== undefined) {
    return {
      source: "cli-flag",
      units: opts.units,
      receiptLabel: "manual-units",
    };
  }

  if (opts.file) {
    return fromFile(opts.file, cap);
  }

  const envFile = process.env.FLEETMETER_QUOTA_FILE;
  if (envFile) {
    return fromFile(envFile, cap);
  }

  const axi = await runQuotaAxi(opts.provider);
  if (axi) {
    const picked = pickWindow(axi, opts.provider);
    if (picked) {
      const { provider, window } = picked;
      const percentUsed = Number(window.percentUsed ?? 0);
      const percentRemaining = Number(
        window.percentRemaining ?? 100 - percentUsed,
      );
      return {
        source: "quota-axi",
        provider,
        windowId: window.id,
        percentUsed,
        percentRemaining,
        units: unitsFromPercent(percentUsed, cap),
        receiptLabel: `${provider}:${window.id}:${percentUsed}`,
        raw: window,
      };
    }
  }

  // Documented stub: example file next to CLI
  const stub = resolve(import.meta.dir, "../examples/quota.json");
  if (existsSync(stub)) {
    console.error(
      "quota-axi unavailable or empty; using cli/examples/quota.json stub",
    );
    return fromFile(stub, cap);
  }

  throw new Error(
    "No quota source. Install quota-axi, pass --units N, or --file path.json",
  );
}
