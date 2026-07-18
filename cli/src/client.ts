import {
  createPublicClient,
  createWalletClient,
  http,
  type Account,
  type Hex,
  type Address,
  type Chain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { doneStampAbi } from "./abi";
import type { StampConfig } from "./config";

export const monadTestnet: Chain = {
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet-rpc.monad.xyz"] } },
  blockExplorers: {
    default: { name: "MonadVision", url: "https://testnet.monadvision.com" },
  },
  testnet: true,
};

export function makeClients(cfg: StampConfig, pk: Hex) {
  const account = privateKeyToAccount(pk);
  const chain: Chain = {
    ...monadTestnet,
    id: cfg.chainId,
    rpcUrls: { default: { http: [cfg.rpcUrl] } },
  };
  const publicClient = createPublicClient({ chain, transport: http(cfg.rpcUrl) });
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(cfg.rpcUrl),
  });
  return { publicClient, walletClient, account, chain };
}

export async function getCode(cfg: StampConfig, address: Address): Promise<Hex> {
  const { publicClient } = makeClients(cfg, cfg.workerKey);
  return publicClient.getCode({ address }) as Promise<Hex>;
}

export async function readIsDone(cfg: StampConfig, taskId: Hex): Promise<boolean> {
  const { publicClient } = makeClients(cfg, cfg.workerKey);
  return publicClient.readContract({
    address: cfg.stamp,
    abi: doneStampAbi,
    functionName: "isDone",
    args: [taskId],
  });
}

export async function readIsPending(cfg: StampConfig, taskId: Hex): Promise<boolean> {
  const { publicClient } = makeClients(cfg, cfg.workerKey);
  return publicClient.readContract({
    address: cfg.stamp,
    abi: doneStampAbi,
    functionName: "isPending",
    args: [taskId],
  });
}

export async function readVerify(
  cfg: StampConfig,
  taskId: Hex,
  evidenceHash: Hex,
): Promise<boolean> {
  const { publicClient } = makeClients(cfg, cfg.workerKey);
  return publicClient.readContract({
    address: cfg.stamp,
    abi: doneStampAbi,
    functionName: "verify",
    args: [taskId, evidenceHash],
  });
}

export async function commitTx(
  cfg: StampConfig,
  taskId: Hex,
  specHash: Hex,
  evidenceHash: Hex,
  gatePass: boolean,
): Promise<Hex> {
  const { walletClient, publicClient, account } = makeClients(cfg, cfg.workerKey);
  const hash = await walletClient.writeContract({
    address: cfg.stamp,
    abi: doneStampAbi,
    functionName: "commit",
    args: [taskId, specHash, evidenceHash, gatePass],
    account: account as Account,
    chain: walletClient.chain,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`commit failed: ${hash}`);
  return hash;
}

export async function acceptTx(
  cfg: StampConfig,
  taskId: Hex,
  evidenceHash: Hex,
): Promise<{ hash: Hex; ok: boolean }> {
  const { walletClient, publicClient, account } = makeClients(cfg, cfg.accepterKey);
  const { request, result } = await publicClient.simulateContract({
    address: cfg.stamp,
    abi: doneStampAbi,
    functionName: "accept",
    args: [taskId, evidenceHash],
    account: account as Account,
  });
  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`accept failed: ${hash}`);
  // re-read isDone for ground truth (result from simulate is the return)
  const ok = Boolean(result);
  return { hash, ok };
}

export async function rejectTx(
  cfg: StampConfig,
  taskId: Hex,
  reason: Hex,
): Promise<Hex> {
  const { walletClient, publicClient, account } = makeClients(cfg, cfg.accepterKey);
  const hash = await walletClient.writeContract({
    address: cfg.stamp,
    abi: doneStampAbi,
    functionName: "reject",
    args: [taskId, reason],
    account: account as Account,
    chain: walletClient.chain,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}
