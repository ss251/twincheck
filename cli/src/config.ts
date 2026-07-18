import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { type Address, type Hex, isAddress, isHex, keccak256, toBytes } from "viem";

export type FleetConfig = {
  rpcUrl: string;
  chainId: number;
  privateKey: Hex;
  principalBPrivateKey?: Hex;
  ledger: Address;
  poolId: Hex;
  seatId: Hex;
  seatBId?: Hex;
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

/** Load repo-root .env then cwd .env (later does not override earlier). */
export function loadEnv(): void {
  const roots = [
    resolve(import.meta.dir, "../../.env"),
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../.env"),
  ];
  for (const p of roots) loadEnvFile(p);
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function asHex32(name: string, raw: string): Hex {
  if (isHex(raw) && raw.length === 66) return raw;
  // Allow human labels: hash to bytes32
  return keccak256(toBytes(raw));
}

export function getConfig(): FleetConfig {
  loadEnv();

  const privateKey = requireEnv("PRIVATE_KEY") as Hex;
  if (!isHex(privateKey) || privateKey.length !== 66) {
    throw new Error("PRIVATE_KEY must be 0x-prefixed 32-byte hex");
  }

  const ledger = (process.env.FLEETLEDGER || process.env.FLEETLEDGER_ADDRESS || "") as Address;
  if (!isAddress(ledger)) {
    throw new Error(
      "Set FLEETLEDGER to the deployed contract address (see DEPLOYMENTS.md after D2).",
    );
  }

  const rpcUrl = process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz";
  const chainId = Number(process.env.MONAD_CHAIN_ID || "10143");
  const explorerBase =
    process.env.MONAD_EXPLORER || "https://testnet.monadvision.com";

  const poolId = asHex32(
    "POOL_ID",
    process.env.POOL_ID || "fleetmeter-spark",
  );
  const seatId = asHex32(
    "SEAT_ID",
    process.env.SEAT_ID || "seat-principal-a",
  );
  const seatBId = process.env.SEAT_B_ID
    ? asHex32("SEAT_B_ID", process.env.SEAT_B_ID)
    : asHex32("SEAT_B_ID", "seat-principal-b");

  const principalBPrivateKey = process.env.PRINCIPAL_B_PRIVATE_KEY as Hex | undefined;

  return {
    rpcUrl,
    chainId,
    privateKey,
    principalBPrivateKey,
    ledger,
    poolId,
    seatId,
    seatBId,
    explorerBase,
  };
}

export function txUrl(cfg: FleetConfig, hash: Hex): string {
  return `${cfg.explorerBase}/tx/${hash}`;
}

export function addressUrl(cfg: FleetConfig, address: Address): string {
  return `${cfg.explorerBase}/address/${address}`;
}
