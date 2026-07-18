import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { type Address, type Hex, isAddress, isHex } from "viem";

export type TwinConfig = {
  rpcUrl: string;
  chainId: number;
  keyA: Hex;
  keyB: Hex;
  twin: Address;
  explorerBase: string;
  registryCsvUrl: string;
  /** Chain id used when probing explorers (mainnet registry → 143). */
  probeChainId: number;
  scanBase: string;
  visionSourcifyBase: string;
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

export function getConfig(): TwinConfig {
  loadEnv();
  const keyA = asHexKey("PRIVATE_KEY", requireEnv("PRIVATE_KEY"));
  const keyB = asHexKey(
    "PRINCIPAL_B_PRIVATE_KEY",
    requireEnv("PRINCIPAL_B_PRIVATE_KEY"),
  );
  const twin = (process.env.TWINCHECK || process.env.TWINCHECK_ADDRESS || "") as Address;
  if (!isAddress(twin)) {
    throw new Error("Set TWINCHECK to the deployed TwinCheck address.");
  }
  const probeChainId = Number(process.env.PROBE_CHAIN_ID || "143");
  const isMainnetProbe = probeChainId === 143;
  return {
    rpcUrl: process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz",
    chainId: Number(process.env.MONAD_CHAIN_ID || "10143"),
    keyA,
    keyB,
    twin,
    explorerBase: process.env.MONAD_EXPLORER || "https://testnet.monadvision.com",
    registryCsvUrl:
      process.env.REGISTRY_CSV_URL ||
      "https://raw.githubusercontent.com/monad-crypto/protocols/refs/heads/main/protocols-mainnet.csv",
    probeChainId,
    scanBase:
      process.env.MONADSCAN_BASE ||
      (isMainnetProbe ? "https://monadscan.com" : "https://testnet.monadscan.com"),
    visionSourcifyBase:
      process.env.VISION_SOURCIFY_BASE ||
      "https://sourcify-api-monad.blockvision.org/v2/contract",
  };
}

export function txUrl(cfg: TwinConfig, hash: Hex): string {
  return `${cfg.explorerBase}/tx/${hash}`;
}

export function addressUrl(cfg: TwinConfig, address: Address): string {
  return `${cfg.explorerBase}/address/${address}`;
}
