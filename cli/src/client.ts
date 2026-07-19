import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  keccak256,
  toBytes,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { TwinConfig } from "./config";
import { twinAbi } from "./abi";

export function publicClient(cfg: TwinConfig): PublicClient {
  return createPublicClient({
    chain: {
      id: cfg.chainId,
      name: "Monad Testnet",
      nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
      rpcUrls: { default: { http: [cfg.rpcUrl] } },
    },
    transport: http(cfg.rpcUrl),
  });
}

export function walletClient(cfg: TwinConfig, key: Hex): WalletClient {
  const account = privateKeyToAccount(key);
  return createWalletClient({
    account,
    chain: {
      id: cfg.chainId,
      name: "Monad Testnet",
      nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
      rpcUrls: { default: { http: [cfg.rpcUrl] } },
    },
    transport: http(cfg.rpcUrl),
  });
}

export async function getCode(cfg: TwinConfig, address: Address): Promise<Hex> {
  return publicClient(cfg).getCode({ address }) as Promise<Hex>;
}

export async function readCard(cfg: TwinConfig, target: Address) {
  return publicClient(cfg).readContract({
    address: cfg.twin,
    abi: twinAbi,
    functionName: "getCard",
    args: [target],
  });
}

export async function watchOne(
  cfg: TwinConfig,
  key: Hex,
  target: Address,
): Promise<Hex> {
  const wc = walletClient(cfg, key);
  const hash = await wc.writeContract({
    address: cfg.twin,
    abi: twinAbi,
    functionName: "watch",
    args: [target],
    chain: wc.chain,
    account: wc.account!,
  });
  await publicClient(cfg).waitForTransactionReceipt({ hash });
  return hash;
}

export async function watchBatch(
  cfg: TwinConfig,
  key: Hex,
  targets: Address[],
): Promise<Hex> {
  const wc = walletClient(cfg, key);
  const hash = await wc.writeContract({
    address: cfg.twin,
    abi: twinAbi,
    functionName: "watchBatch",
    args: [targets],
    chain: wc.chain,
    account: wc.account!,
  });
  await publicClient(cfg).waitForTransactionReceipt({ hash });
  return hash;
}

export async function reportOne(
  cfg: TwinConfig,
  key: Hex,
  target: Address,
  scanOK: boolean,
  visionOK: boolean,
  evidenceHash: Hex,
): Promise<Hex> {
  const wc = walletClient(cfg, key);
  const hash = await wc.writeContract({
    address: cfg.twin,
    abi: twinAbi,
    functionName: "report",
    args: [target, scanOK, visionOK, evidenceHash],
    chain: wc.chain,
    account: wc.account!,
  });
  await publicClient(cfg).waitForTransactionReceipt({ hash });
  return hash;
}

export function hashEvidence(payload: string): Hex {
  return keccak256(toBytes(payload));
}
