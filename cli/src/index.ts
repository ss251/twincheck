#!/usr/bin/env bun
/**
 * donestamp — dual-principal completion receipts on Monad.
 *
 *   donestamp commit  — worker runs gate, posts commit (principal A)
 *   donestamp accept  — accepter re-hashes evidence, co-signs (principal B)
 *   donestamp reject  — accepter rejects claim (principal B)
 *   donestamp check   — isDone / isPending / verify; exit 1 if not done
 */
import { keccak256, stringToBytes, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  getConfig,
  loadEnv,
  asBytes32,
  txUrl,
  addressUrl,
} from "./config";
import {
  acceptTx,
  commitTx,
  getCode,
  readIsDone,
  readIsPending,
  readVerify,
  rejectTx,
} from "./client";
import { hashFile, hashLabel, runGate } from "./hash";

function usage(): never {
  console.log(`donestamp — dual-principal agent "done" receipts

Usage:
  donestamp commit --task <id> --spec <file|label> --evidence <file> [--require-pass-marker]
  donestamp accept --task <id> --evidence <file|label>
  donestamp reject --task <id> --reason <label>
  donestamp check  --task <id> [--evidence <file|label>]

Env: PRIVATE_KEY (worker A), PRINCIPAL_B_PRIVATE_KEY (accepter B),
     DONESTAMP, MONAD_RPC_URL, MONAD_CHAIN_ID

Exit codes: check/accept mismatch → 1
`);
  process.exit(2);
}

function parseArgs(argv: string[]) {
  const out: Record<string, string | boolean> = {};
  const positionals: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--require-pass-marker") out.requirePassMarker = true;
    else if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      out[key] = val;
    } else positionals.push(a);
  }
  return { out, positionals };
}

function evidenceHashFromFlag(flags: Record<string, string | boolean>): Hex {
  if (flags.evidence) {
    const p = String(flags.evidence);
    try {
      return hashFile(p);
    } catch {
      return hashLabel(p);
    }
  }
  if (flags["evidence-label"]) return hashLabel(String(flags["evidence-label"]));
  throw new Error("Need --evidence <file|label>");
}

function specHashFromFlag(flags: Record<string, string | boolean>): Hex {
  if (!flags.spec) throw new Error("Need --spec <file|label>");
  const p = String(flags.spec);
  try {
    return hashFile(p);
  } catch {
    return hashLabel(p);
  }
}

async function cmdCommit(flags: Record<string, string | boolean>) {
  const cfg = getConfig();
  const code = await getCode(cfg, cfg.stamp);
  if (!code || code === "0x") throw new Error(`No code at ${cfg.stamp}`);

  if (!flags.task) throw new Error("Need --task <id>");
  const taskId = asBytes32(String(flags.task));
  const specHash = specHashFromFlag(flags);

  const gate = runGate({
    evidencePath: flags.evidence ? String(flags.evidence) : undefined,
    evidenceLabel: flags["evidence-label"]
      ? String(flags["evidence-label"])
      : flags.evidence
        ? undefined
        : String(flags.task),
    requirePassMarker: Boolean(flags.requirePassMarker),
  });

  // If --evidence is a path that failed as file in runGate, handle label fallback
  let evidenceHash = gate.evidenceHash;
  if (flags.evidence) {
    try {
      evidenceHash = hashFile(String(flags.evidence));
    } catch {
      evidenceHash = hashLabel(String(flags.evidence));
    }
  }

  const worker = privateKeyToAccount(cfg.workerKey).address;
  console.log(
    JSON.stringify(
      {
        action: "commit",
        stamp: cfg.stamp,
        worker,
        taskId,
        specHash,
        evidenceHash,
        gatePass: gate.pass,
        note: gate.note,
      },
      null,
      2,
    ),
  );

  const hash = await commitTx(cfg, taskId, specHash, evidenceHash, gate.pass);
  console.log(
    JSON.stringify(
      { ok: true, tx: hash, explorer: txUrl(cfg, hash), pending: true },
      null,
      2,
    ),
  );
}

async function cmdAccept(flags: Record<string, string | boolean>) {
  const cfg = getConfig();
  if (!flags.task) throw new Error("Need --task <id>");
  const taskId = asBytes32(String(flags.task));
  const evidenceHash = evidenceHashFromFlag(flags);
  const accepter = privateKeyToAccount(cfg.accepterKey).address;

  console.log(
    JSON.stringify(
      {
        action: "accept",
        stamp: cfg.stamp,
        accepter,
        taskId,
        evidenceHash,
        verify: await readVerify(cfg, taskId, evidenceHash),
      },
      null,
      2,
    ),
  );

  const { hash, ok } = await acceptTx(cfg, taskId, evidenceHash);
  const done = await readIsDone(cfg, taskId);
  console.log(
    JSON.stringify(
      {
        acceptReturned: ok,
        isDone: done,
        tx: hash,
        explorer: txUrl(cfg, hash),
      },
      null,
      2,
    ),
  );
  if (!ok || !done) {
    console.error("DENIED: evidence mismatch or not done — second principal refused");
    process.exit(1);
  }
}

async function cmdReject(flags: Record<string, string | boolean>) {
  const cfg = getConfig();
  if (!flags.task) throw new Error("Need --task <id>");
  const taskId = asBytes32(String(flags.task));
  const reason = asBytes32(String(flags.reason || "rejected"));
  const hash = await rejectTx(cfg, taskId, reason);
  console.log(
    JSON.stringify(
      { ok: true, tx: hash, explorer: txUrl(cfg, hash), isDone: false },
      null,
      2,
    ),
  );
}

async function cmdCheck(flags: Record<string, string | boolean>) {
  const cfg = getConfig();
  if (!flags.task) throw new Error("Need --task <id>");
  const taskId = asBytes32(String(flags.task));
  const done = await readIsDone(cfg, taskId);
  const pending = await readIsPending(cfg, taskId);
  let verified: boolean | undefined;
  if (flags.evidence || flags["evidence-label"]) {
    verified = await readVerify(cfg, taskId, evidenceHashFromFlag(flags));
  }
  console.log(
    JSON.stringify(
      {
        stamp: cfg.stamp,
        explorer: addressUrl(cfg, cfg.stamp),
        taskId,
        isDone: done,
        isPending: pending,
        verified,
      },
      null,
      2,
    ),
  );
  if (!done) {
    console.error("NOT DONE: missing dual-principal accept");
    process.exit(1);
  }
}

async function main() {
  loadEnv();
  const { out, positionals } = parseArgs(process.argv.slice(2));
  if (out.help || positionals.length === 0) usage();
  const cmd = positionals[0];
  try {
    if (cmd === "commit") await cmdCommit(out);
    else if (cmd === "accept") await cmdAccept(out);
    else if (cmd === "reject") await cmdReject(out);
    else if (cmd === "check") await cmdCheck(out);
    else usage();
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

main();
