/**
 * Mode x402 sans facilitator : vérification on-chain par txHash (Base, USDC Transfer).
 * X402_MODE=txhash + BASE_RPC_URL requis.
 */
import { createPublicClient, http, type Chain } from "viem";
import { base } from "viem/chains";
import { decodeEventLog } from "viem";

const BASE_RPC_URL = process.env.BASE_RPC_URL?.trim();
const BASE_RPC_FALLBACK = "https://base.publicnode.com";

/** Format attendu du txHash (64 hex chars après 0x). */
export const TXHASH_REGEX = /^0x[a-fA-F0-9]{64}$/;

/** Anti-replay : txHash déjà consommés (dev; plus tard Redis/DB). */
const consumedTxHashes = new Set<string>();

function getBaseChain(): Chain {
  return base; // id 8453
}

let publicClient: ReturnType<typeof createPublicClient> | null = null;
let fallbackClient: ReturnType<typeof createPublicClient> | null = null;

function getPublicClient() {
  if (!BASE_RPC_URL) {
    return getFallbackClient();
  }
  if (!publicClient) {
    publicClient = createPublicClient({
      chain: getBaseChain(),
      transport: http(BASE_RPC_URL),
    });
  }
  return publicClient;
}

function getFallbackClient(): ReturnType<typeof createPublicClient> {
  if (!fallbackClient) {
    fallbackClient = createPublicClient({
      chain: getBaseChain(),
      transport: http(BASE_RPC_FALLBACK),
    });
  }
  return fallbackClient;
}

/** ERC20 Transfer(address indexed from, address indexed to, uint256 value) */
const transferFragment = {
  type: "event",
  name: "Transfer",
  inputs: [
    { name: "from", type: "address", indexed: true },
    { name: "to", type: "address", indexed: true },
    { name: "value", type: "uint256", indexed: false },
  ],
} as const;

export type VerifyTxHashResult =
  | { ok: true; payer: string; txHash: string }
  | { ok: false; reason: string };

/** Polling : attente max (ms) et intervalle (ms) pour getTransactionReceipt tant que la tx n'est pas minée. */
const TXHASH_POLL_MS = 20_000;
const TXHASH_POLL_INTERVAL_MS = 2_000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** viem can throw when receipt is not found (tx not mined yet); we treat that as null and retry. */
async function getReceiptSafe(
  client: ReturnType<typeof createPublicClient>,
  hash: `0x${string}`
): Promise<Awaited<ReturnType<typeof client.getTransactionReceipt>> | null> {
  try {
    const receipt = await client.getTransactionReceipt({ hash });
    return receipt;
  } catch {
    return null;
  }
}

/**
 * Vérifie qu'une tx on-chain contient un Transfer ERC20 vers payTo d'au moins amount.
 * - getTransactionReceipt(txHash) avec polling si la tx n'est pas encore minée
 * - status === "success"
 * - logs: log.address === asset, event Transfer, to === payTo, value >= amount (bigint)
 */
export async function verifyTxHashPayment(params: {
  txHash: string;
  payTo: string;
  asset: string;
  amount: string;
}): Promise<VerifyTxHashResult> {
  const { txHash, payTo, asset, amount } = params;
  const payToLower = payTo.toLowerCase();
  const assetLower = asset.toLowerCase();
  const amountBigInt = BigInt(amount);

  if (consumedTxHashes.has(txHash.toLowerCase())) {
    return { ok: false, reason: "already used" };
  }

  const client = getPublicClient();
  const hash = txHash as `0x${string}`;
  let receipt = await getReceiptSafe(client, hash);
  const deadline = Date.now() + TXHASH_POLL_MS;
  while (!receipt && Date.now() < deadline) {
    await sleep(TXHASH_POLL_INTERVAL_MS);
    receipt = await getReceiptSafe(client, hash);
  }

  // Fallback RPC: if primary still no receipt after polling, try secondary 2–3 times
  if (!receipt) {
    const fallback = getFallbackClient();
    for (let i = 0; i < 3; i++) {
      await sleep(500);
      receipt = await getReceiptSafe(fallback, hash);
      if (receipt) break;
    }
  }

  if (!receipt) {
    return { ok: false, reason: "pending/not found" };
  }
  if (receipt.status !== "success") {
    return { ok: false, reason: "failed tx" };
  }

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== assetLower) continue;
    if (!log.topics[0]) continue;
    // Transfer topic = keccak256("Transfer(address,address,uint256)")
    const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
    if (log.topics[0].toLowerCase() !== transferTopic) continue;

    try {
      const decoded = decodeEventLog({
        abi: [transferFragment],
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== "Transfer") continue;
      const args = decoded.args as { from: string; to: string; value: bigint };
      const toLower = args.to?.toLowerCase();
      if (toLower !== payToLower) continue;
      if (args.value !== amountBigInt) {
        return { ok: false, reason: "wrong amount" };
      }
      consumedTxHashes.add(txHash.toLowerCase());
      return {
        ok: true,
        payer: args.from,
        txHash,
      };
    } catch {
      continue;
    }
  }

  return { ok: false, reason: "transfer not found / wrong amount / wrong payTo" };
}

export function isTxHashConsumed(txHash: string): boolean {
  return consumedTxHashes.has(txHash.toLowerCase());
}
