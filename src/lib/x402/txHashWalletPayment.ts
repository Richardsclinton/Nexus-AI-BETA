"use client";

import { createWalletClient, custom } from "viem";
import { writeContract, switchChain } from "viem/actions";
import { base } from "viem/chains";

/** USDC Base mainnet */
export const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

/** 0.05 USDC (6 decimals) */
export const AMOUNT_RAW = 50000n;

const ERC20_TRANSFER_ABI = [
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

export type EIP1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

/** Machine-readable codes for UI (no generic "Error"). */
export type TxHashPaymentErrorCode =
  | "wallet_not_ready"
  | "wrong_network"
  | "user_rejected"
  | "rpc_unavailable"
  | "pending_confirmation"
  | "insufficient_funds"
  | "insufficient_gas";

export type TxHashPaymentResult =
  | { ok: true; txHash: string }
  | { ok: false; error: string; code?: number | TxHashPaymentErrorCode };

const BASE_CHAIN_ID = 8453;

/** Wallet readiness for UI gate: avoid first-click fail. */
export async function getWalletReadiness(provider: EIP1193Provider | null): Promise<{
  ready: boolean;
  code?: "no_provider" | "wrong_network" | "no_address";
  chainId?: number;
  address?: string;
}> {
  if (!provider?.request) {
    return { ready: false, code: "no_provider" };
  }
  let chainId: string | number = 0;
  try {
    chainId = (await provider.request({ method: "eth_chainId" })) as string;
  } catch {
    return { ready: false, code: "no_provider" };
  }
  const chainIdNum = typeof chainId === "string" ? parseInt(chainId, 16) : chainId;
  if (chainIdNum !== BASE_CHAIN_ID) {
    return { ready: false, code: "wrong_network", chainId: chainIdNum };
  }
  let accounts: string[] = [];
  try {
    accounts = (await provider.request({ method: "eth_accounts" })) as string[];
  } catch {
    return { ready: false, code: "no_address" };
  }
  if (!accounts?.length) {
    return { ready: false, code: "no_address" };
  }
  return { ready: true, chainId: chainIdNum, address: accounts[0] };
}

/**
 * Warm-up provider (first RPC call can be cold in dev). Call once before first transfer.
 */
export async function warmUpProvider(provider: EIP1193Provider): Promise<{ ok: boolean; code?: "rpc_unavailable" }> {
  try {
    await provider.request({ method: "eth_chainId" });
    return { ok: true };
  } catch {
    try {
      await provider.request({ method: "eth_chainId" });
      return { ok: true };
    } catch {
      return { ok: false, code: "rpc_unavailable" };
    }
  }
}

/**
 * Transfer USDC (Base) via wallet. Switches to Base if needed. Returns txHash for X-PAYMENT.
 */
export async function sendUsdcTransferAndGetTxHash(params: {
  provider: EIP1193Provider;
  payTo: string;
  amount?: bigint;
}): Promise<TxHashPaymentResult> {
  const { provider, payTo, amount = AMOUNT_RAW } = params;

  const walletClient = createWalletClient({
    chain: base,
    transport: custom(provider as Parameters<typeof custom>[0]),
  });

  let chainId: string | number = 0;
  try {
    chainId = (await provider.request({ method: "eth_chainId" })) as string;
  } catch {
    return { ok: false, error: "Cannot read network.", code: "rpc_unavailable" };
  }
  const chainIdNum = typeof chainId === "string" ? parseInt(chainId, 16) : chainId;

  if (chainIdNum !== BASE_CHAIN_ID) {
    try {
      await switchChain(walletClient, { id: BASE_CHAIN_ID });
    } catch (e) {
      const err = e as { code?: number };
      if (err?.code === 4001) {
        return { ok: false, error: "Network switch rejected. Please switch to Base manually.", code: "user_rejected" };
      }
      return { ok: false, error: "Switch to Base network in your wallet.", code: "wrong_network" };
    }
    try {
      chainId = (await provider.request({ method: "eth_chainId" })) as string;
    } catch {
      return { ok: false, error: "Network not updated. Try again.", code: "rpc_unavailable" };
    }
    const again = typeof chainId === "string" ? parseInt(chainId, 16) : chainId;
    if (again !== BASE_CHAIN_ID) {
      return { ok: false, error: "Switch to Base network in your wallet.", code: "wrong_network" };
    }
  }

  let accounts: string[] = [];
  try {
    accounts = (await provider.request({ method: "eth_accounts" })) as string[];
  } catch {
    return { ok: false, error: "Cannot read accounts.", code: "wallet_not_ready" };
  }
  if (!accounts?.length) {
    try {
      accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
    } catch (e) {
      const err = e as { code?: number };
      if (err?.code === 4001) return { ok: false, error: "Connection rejected.", code: "user_rejected" };
      return { ok: false, error: "Connect your wallet first.", code: "wallet_not_ready" };
    }
  }
  if (!accounts?.length) {
    return { ok: false, error: "No account connected.", code: "wallet_not_ready" };
  }

  const account = accounts[0] as `0x${string}`;
  let hash: `0x${string}`;
  try {
    hash = await writeContract(walletClient, {
      address: USDC_BASE,
      abi: ERC20_TRANSFER_ABI,
      functionName: "transfer",
      args: [payTo as `0x${string}`, amount],
      account: { address: account, type: "json-rpc" },
    });
  } catch (e) {
    const err = e as { code?: number | string; message?: string; shortMessage?: string };
    const msg = err?.shortMessage ?? err?.message ?? String(e);
    if (err?.code === 4001 || /user rejected|rejected/i.test(msg)) {
      return { ok: false, error: "Payment cancelled.", code: "user_rejected" };
    }
    if (/insufficient funds|exceeds balance|transfer amount exceeds/i.test(msg)) {
      return { ok: false, error: "Insufficient USDC. 0.05 USDC required on Base.", code: "insufficient_funds" };
    }
    if (/insufficient funds for gas/i.test(msg)) {
      return { ok: false, error: "Insufficient funds. Add some ETH on Base for gas.", code: "insufficient_gas" };
    }
    return { ok: false, error: msg.slice(0, 200), code: "rpc_unavailable" };
  }

  if (!hash) return { ok: false, error: "No transaction hash.", code: "rpc_unavailable" };

  return { ok: true, txHash: hash };
}
