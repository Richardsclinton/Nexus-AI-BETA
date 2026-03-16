"use client";

import { createPublicClient, createWalletClient, custom } from "viem";
import { writeContract, sendTransaction, switchChain } from "viem/actions";
import { base } from "viem/chains";

const BASE_CHAIN_ID = 8453;

/** USDC Base mainnet (same as x402) */
export const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
/** USDT Base mainnet (bridged) */
export const USDT_BASE = "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2" as const;

const ERC20_ABI = [
  { type: "function", name: "balanceOf", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "transfer", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

export type EIP1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

export type MixerBalances = {
  eth: string;
  usdc: string;
  usdt: string;
};

/** Format ETH (18 decimals) or ERC20 (6 decimals) for display */
export function formatMixerBalance(raw: bigint, decimals: 6 | 18): string {
  const div = 10 ** decimals;
  const int = raw / BigInt(div);
  const frac = raw % BigInt(div);
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, 4).replace(/0+$/, "") || "0";
  return `${int}.${fracStr}`;
}

/** Parse user amount string to bigint (6 decimals for USDC/USDT, 18 for ETH) */
export function parseMixerAmount(value: string, decimals: 6 | 18): bigint | null {
  const trimmed = value.trim().replace(/,/g, ".");
  if (!trimmed || !/^\d*\.?\d*$/.test(trimmed)) return null;
  const [intPart = "0", fracPart = ""] = trimmed.split(".");
  const fracPadded = fracPart.slice(0, decimals).padEnd(decimals, "0");
  const combined = intPart + fracPadded;
  if (combined.length > 50) return null;
  return BigInt(combined);
}

/** Check if string is a valid Base (EVM) address */
export function isValidBaseAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr.trim());
}

/**
 * Fetch ETH and ERC20 (USDC, USDT) balances on Base using the wallet provider.
 */
export async function getMixerBalances(
  provider: EIP1193Provider | null,
  address: string
): Promise<{ ok: true; balances: MixerBalances } | { ok: false; error: string }> {
  if (!provider?.request || !address) {
    return { ok: false, error: "No provider or address" };
  }
  try {
    const chainId = (await provider.request({ method: "eth_chainId" })) as string;
    const chainIdNum = typeof chainId === "string" ? parseInt(chainId, 16) : chainId;
    if (chainIdNum !== BASE_CHAIN_ID) {
      return { ok: false, error: "Switch to Base network" };
    }

    const publicClient = createPublicClient({
      chain: base,
      transport: custom(provider as Parameters<typeof custom>[0]),
    });

    const ethBalance = await publicClient.getBalance({ address: address as `0x${string}` });
    const usdcBalance = (await publicClient.readContract({
      address: USDC_BASE,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [address as `0x${string}`],
    })) as bigint;
    const usdtBalance = (await publicClient.readContract({
      address: USDT_BASE,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [address as `0x${string}`],
    })) as bigint;

    return {
      ok: true,
      balances: {
        eth: formatMixerBalance(ethBalance, 18),
        usdc: formatMixerBalance(usdcBalance, 6),
        usdt: formatMixerBalance(usdtBalance, 6),
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg.slice(0, 150) };
  }
}

export type MixerTransferParams = {
  token: "ETH" | "USDC" | "USDT";
  amountRaw: bigint;
  to: `0x${string}`;
};

/**
 * Perform a normal transfer (no mixing). ETH via sendTransaction, USDC/USDT via ERC20 transfer.
 */
export async function sendMixerTransfer(
  provider: EIP1193Provider,
  fromAddress: `0x${string}`,
  params: MixerTransferParams
): Promise<{ ok: true; txHash: string } | { ok: false; error: string }> {
  try {
    const walletClient = createWalletClient({
      chain: base,
      transport: custom(provider as Parameters<typeof custom>[0]),
    });

    let chainId: string | number = 0;
    try {
      chainId = (await provider.request({ method: "eth_chainId" })) as string;
    } catch {
      return { ok: false, error: "Cannot read network" };
    }
    const chainIdNum = typeof chainId === "string" ? parseInt(chainId, 16) : chainId;
    if (chainIdNum !== BASE_CHAIN_ID) {
      try {
        await switchChain(walletClient, { id: BASE_CHAIN_ID });
      } catch (e) {
        const err = e as { code?: number };
        if (err?.code === 4001) return { ok: false, error: "Network switch rejected" };
        return { ok: false, error: "Switch to Base network" };
      }
    }

    if (params.token === "ETH") {
      const hash = await sendTransaction(walletClient, {
        to: params.to,
        value: params.amountRaw,
        account: { address: fromAddress, type: "json-rpc" },
      });
      return { ok: true, txHash: hash };
    }

    const contractAddress = params.token === "USDC" ? USDC_BASE : USDT_BASE;
    const hash = await writeContract(walletClient, {
      address: contractAddress,
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [params.to, params.amountRaw],
      account: { address: fromAddress, type: "json-rpc" },
    });
    return { ok: true, txHash: hash };
  } catch (e) {
    const err = e as { code?: number; message?: string; shortMessage?: string };
    const msg = err?.shortMessage ?? err?.message ?? String(e);
    if (err?.code === 4001 || /rejected/i.test(msg)) return { ok: false, error: "Transaction rejected" };
    if (/insufficient funds|exceeds balance/i.test(msg)) return { ok: false, error: "Insufficient balance" };
    if (/insufficient.*gas/i.test(msg)) return { ok: false, error: "Insufficient ETH for gas" };
    return { ok: false, error: msg.slice(0, 180) };
  }
}
