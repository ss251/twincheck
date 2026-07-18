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
import { fleetLedgerAbi } from "./abi";
import type { FleetConfig } from "./config";

/** Monad testnet chain definition (docs.monad.xyz testnets). */
export const monadTestnet: Chain = {
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testnet-rpc.monad.xyz"] },
  },
  blockExplorers: {
    default: { name: "MonadVision", url: "https://testnet.monadvision.com" },
  },
  testnet: true,
};

export function makeClients(cfg: FleetConfig, pk?: Hex) {
  const key = pk ?? cfg.privateKey;
  const account = privateKeyToAccount(key);
  const chain: Chain = {
    ...monadTestnet,
    id: cfg.chainId,
    rpcUrls: { default: { http: [cfg.rpcUrl] } },
  };

  const publicClient = createPublicClient({
    chain,
    transport: http(cfg.rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(cfg.rpcUrl),
  });

  return { publicClient, walletClient, account, chain };
}

export async function readCanSpawn(
  cfg: FleetConfig,
  seatId: Hex,
  cost: bigint,
): Promise<boolean> {
  const { publicClient } = makeClients(cfg);
  return publicClient.readContract({
    address: cfg.ledger,
    abi: fleetLedgerAbi,
    functionName: "canSpawn",
    args: [seatId, cost],
  });
}

export async function readRemaining(cfg: FleetConfig, seatId: Hex): Promise<bigint> {
  const { publicClient } = makeClients(cfg);
  return publicClient.readContract({
    address: cfg.ledger,
    abi: fleetLedgerAbi,
    functionName: "remaining",
    args: [seatId],
  });
}

export async function postSpendTx(
  cfg: FleetConfig,
  seatId: Hex,
  units: bigint,
  receiptHash: Hex,
  pk?: Hex,
): Promise<Hex> {
  const { walletClient, publicClient, account } = makeClients(cfg, pk);
  const hash = await walletClient.writeContract({
    address: cfg.ledger,
    abi: fleetLedgerAbi,
    functionName: "postSpend",
    args: [seatId, units, receiptHash],
    account: account as Account,
    chain: walletClient.chain,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`postSpend failed: ${hash}`);
  }
  return hash;
}

export async function signalDeniedTx(
  cfg: FleetConfig,
  seatId: Hex,
  cost: bigint,
  reason: Hex,
  pk?: Hex,
): Promise<Hex> {
  const { walletClient, publicClient, account } = makeClients(cfg, pk);
  const hash = await walletClient.writeContract({
    address: cfg.ledger,
    abi: fleetLedgerAbi,
    functionName: "signalDenied",
    args: [seatId, cost, reason],
    account: account as Account,
    chain: walletClient.chain,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export async function getCode(cfg: FleetConfig, address: Address): Promise<Hex> {
  const { publicClient } = makeClients(cfg);
  return publicClient.getCode({ address }) as Promise<Hex>;
}
