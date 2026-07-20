import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  decodeEventLog,
  encodeAbiParameters,
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

export function assertConfiguredAttestors(
  keyA: Hex,
  keyB: Hex,
  attestorA: Address,
  attestorB: Address,
): void {
  const actualA = privateKeyToAccount(keyA).address;
  const actualB = privateKeyToAccount(keyB).address;
  if (actualA.toLowerCase() !== attestorA.toLowerCase()) {
    throw new Error(
      `PRIVATE_KEY must match TwinCheck attestorA ${attestorA}; got ${actualA}`,
    );
  }
  if (actualB.toLowerCase() !== attestorB.toLowerCase()) {
    throw new Error(
      `PRINCIPAL_B_PRIVATE_KEY must match TwinCheck attestorB ${attestorB}; got ${actualB}`,
    );
  }
}

export async function validateAttestorConfig(cfg: TwinConfig): Promise<void> {
  const pc = publicClient(cfg);
  const [attestorA, attestorB] = await Promise.all([
    pc.readContract({
      address: cfg.twin,
      abi: twinAbi,
      functionName: "attestorA",
    }),
    pc.readContract({
      address: cfg.twin,
      abi: twinAbi,
      functionName: "attestorB",
    }),
  ]);
  assertConfiguredAttestors(cfg.keyA, cfg.keyB, attestorA, attestorB);
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
) {
  const wc = walletClient(cfg, key);
  const hash = await wc.writeContract({
    address: cfg.twin,
    abi: twinAbi,
    functionName: "report",
    args: [target, scanOK, visionOK, evidenceHash],
    chain: wc.chain,
    account: wc.account!,
  });
  const receipt = await publicClient(cfg).waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Report transaction reverted: ${hash}`);
  }
  return { hash, receipt };
}

export function hashEvidence(payload: string): Hex {
  return keccak256(toBytes(payload));
}

export function hashDualEvidence(evidenceA: Hex, evidenceB: Hex): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "bytes32" }],
      [evidenceA, evidenceB],
    ),
  );
}

export function hasMatchingSettlement(
  logs: readonly {
    address: Address;
    data: Hex;
    topics: readonly Hex[];
  }[],
  contract: Address,
  target: Address,
  scanOK: boolean,
  visionOK: boolean,
  evidenceHash: Hex,
): boolean {
  for (const log of logs) {
    if (log.address.toLowerCase() !== contract.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: twinAbi,
        eventName: "DualStatusSettled",
        data: log.data,
        topics: log.topics as [Hex, ...Hex[]],
      });
      const args = decoded.args;
      if (
        args.target.toLowerCase() === target.toLowerCase() &&
        args.scanOK === scanOK &&
        args.visionOK === visionOK &&
        args.dualOK === (scanOK && visionOK) &&
        args.evidenceHash.toLowerCase() === evidenceHash.toLowerCase()
      ) {
        return true;
      }
    } catch {}
  }
  return false;
}
