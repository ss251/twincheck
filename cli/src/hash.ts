import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { keccak256, type Hex, toBytes, toHex } from "viem";

/** File contents → keccak256 (viem) of raw bytes for onchain evidence. */
export function hashFile(path: string): Hex {
  const abs = resolve(path);
  if (!existsSync(abs)) throw new Error(`File not found: ${abs}`);
  const buf = readFileSync(abs);
  return keccak256(toHex(buf));
}

/** String / label → keccak256. */
export function hashLabel(s: string): Hex {
  return keccak256(toBytes(s));
}

/**
 * Deterministic local gate: if --evidence is a file, require non-empty and
 * optional substring "PASS" when --require-pass-marker is set.
 * Returns { pass, evidenceHash, note }.
 */
export function runGate(opts: {
  evidencePath?: string;
  evidenceLabel?: string;
  requirePassMarker?: boolean;
}): { pass: boolean; evidenceHash: Hex; note: string } {
  if (opts.evidencePath) {
    const abs = resolve(opts.evidencePath);
    const text = readFileSync(abs, "utf8");
    const evidenceHash = hashFile(abs);
    let pass = text.length > 0;
    if (opts.requirePassMarker) {
      pass = /\bPASS\b/.test(text) && !/\bFAIL\b/.test(text);
    }
    return {
      pass,
      evidenceHash,
      note: `file:${abs} bytes=${text.length} pass=${pass}`,
    };
  }
  if (opts.evidenceLabel) {
    return {
      pass: true,
      evidenceHash: hashLabel(opts.evidenceLabel),
      note: `label:${opts.evidenceLabel}`,
    };
  }
  throw new Error("Provide --evidence <file> or --evidence-label <string>");
}

/** SHA-256 hex for display only (not onchain). */
export function sha256Preview(path: string): string {
  const buf = readFileSync(resolve(path));
  return createHash("sha256").update(buf).digest("hex").slice(0, 16);
}
