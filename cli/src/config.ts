import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { type Address, type Hex, isAddress, isHex, keccak256, toBytes } from "viem";

export type StampConfig = {
  rpcUrl: string;
  chainId: number;
  workerKey: Hex;
  accepterKey: Hex;
  stamp: Address;
  explorerBase: string;
};

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

export function loadEnv(): void {
  for (const p of [
    resolve(import.meta.dir, "../../.env"),
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../.env"),
  ]) {
    loadEnvFile(p);
  }
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function asHexKey(name: string, raw: string): Hex {
  let h = raw.trim();
  if (!h.startsWith("0x")) h = `0x${h}`;
  if (!isHex(h) || h.length !== 66) {
    throw new Error(`${name} must be 0x-prefixed 32-byte hex`);
  }
  return h as Hex;
}

export function asBytes32(labelOrHex: string): Hex {
  if (isHex(labelOrHex) && labelOrHex.length === 66) return labelOrHex as Hex;
  return keccak256(toBytes(labelOrHex));
}

export function getConfig(): StampConfig {
  loadEnv();
  const workerKey = asHexKey("PRIVATE_KEY", requireEnv("PRIVATE_KEY"));
  const accepterKey = asHexKey(
    "PRINCIPAL_B_PRIVATE_KEY",
    requireEnv("PRINCIPAL_B_PRIVATE_KEY"),
  );
  const stamp = (process.env.DONESTAMP || process.env.DONESTAMP_ADDRESS || "") as Address;
  if (!isAddress(stamp)) {
    throw new Error("Set DONESTAMP to the deployed DoneStamp address (see DEPLOYMENTS.md).");
  }
  return {
    rpcUrl: process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz",
    chainId: Number(process.env.MONAD_CHAIN_ID || "10143"),
    workerKey,
    accepterKey,
    stamp,
    explorerBase: process.env.MONAD_EXPLORER || "https://testnet.monadvision.com",
  };
}

export function txUrl(cfg: StampConfig, hash: Hex): string {
  return `${cfg.explorerBase}/tx/${hash}`;
}

export function addressUrl(cfg: StampConfig, address: Address): string {
  return `${cfg.explorerBase}/address/${address}`;
}
