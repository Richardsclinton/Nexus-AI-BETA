"use client";

import { wrapFetchWithPaymentLogged } from "@/lib/x402/wrapFetchWithPaymentLogged";
import { x402Client } from "@x402/core/client";
import type { PaymentRequirements } from "@x402/core/types";
import type { ClientEvmSigner } from "@x402/evm";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { ExactEvmSchemeV1 } from "@x402/evm/exact/v1/client";
import { getSelectedProvider, rehydrateProvider } from "@/lib/walletProviderStore";
import { toFacilitatorSlug } from "@/lib/x402/networkMap";
import { base } from "viem/chains";

export type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

const BASE_MAINNET_CHAIN_ID_HEX = "0x2105"; // 8453

/** Slug -> chainId pour forcer chainId dans la requirement v1 (évite BigInt(undefined)). */
const SLUG_TO_CHAIN_ID: Record<string, number> = {
  base: 8453,
  "base-sepolia": 84532,
  ethereum: 1,
  sepolia: 11155111,
  polygon: 137,
  "polygon-amoy": 80002,
  avalanche: 43114,
  "avalanche-fuji": 43113,
};

/** Adapte v1 CAIP-2 (serveur) vers slug (ExactEvmSchemeV1 / facilitator.x402.rs). */
class ExactEvmSchemeV1Caip2Adapter {
  inner: ExactEvmSchemeV1;
  scheme: string;
  constructor(signer: ClientEvmSigner) {
    this.inner = new ExactEvmSchemeV1(signer);
    this.scheme = this.inner.scheme;
  }
  async createPaymentPayload(
    x402Version: number,
    paymentRequirements: { network?: string; chainId?: number; [k: string]: unknown },
  ) {
    console.debug("[x402-ui] paymentRequirements raw =", paymentRequirements);
    const net = paymentRequirements?.network ?? "";
    if (x402Version !== 1) {
      return this.inner.createPaymentPayload(x402Version, paymentRequirements as PaymentRequirements);
    }
    const slug = toFacilitatorSlug(net);
    if (slug.includes(":")) throw new Error("Unsupported CAIP2 for v1: " + net);
    const chainIdNum = paymentRequirements.chainId ?? SLUG_TO_CHAIN_ID[slug] ?? undefined;
    const chainId = chainIdNum !== undefined ? (typeof paymentRequirements.chainId === "bigint" ? paymentRequirements.chainId : BigInt(chainIdNum)) : undefined;
    const reqForInner: PaymentRequirements = {
      ...paymentRequirements,
      network: slug,
      ...(chainId !== undefined && { chainId }),
    } as PaymentRequirements;
    console.debug("[x402-ui] v1 adapter: network=", slug, "chainId=", chainId);
    return this.inner.createPaymentPayload(x402Version, reqForInner);
  }
}

/**
 * Recursively convert BigInt to string so JSON.stringify works (EIP-712 / eth_signTypedData_v4).
 * Leaves string, number, boolean, null, and hex strings unchanged.
 */
function deepConvertBigIntToString(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(deepConvertBigIntToString);
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = deepConvertBigIntToString(v);
    }
    return out;
  }
  return value;
}

/**
 * Build a paid fetch that uses the given EIP-1193 provider for accounts, chain, and eth_signTypedData_v4 (x402).
 */
export async function createPaidFetchFromProvider(provider: EthereumProvider): Promise<
  (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
> {
  // 1) Récupérer les comptes
  let accounts: string[] = [];
  try {
    accounts = (await provider.request({ method: "eth_accounts" })) as string[];
  } catch {
    // ignore, on tentera eth_requestAccounts ensuite
  }

  if (!accounts || accounts.length === 0) {
    try {
      accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
    } catch {
      throw new Error("WALLET_NOT_CONNECTED");
    }
  }

  if (!accounts || accounts.length === 0) {
    throw new Error("WALLET_NOT_CONNECTED");
  }

  const address = accounts[0] as `0x${string}`;

  // 2) Forcer Base (eip155:8453)
  let chainId: string | undefined;
  try {
    chainId = (await provider.request({ method: "eth_chainId" })) as string;
    const normalized = chainId?.toLowerCase();
    if (normalized !== BASE_MAINNET_CHAIN_ID_HEX) {
      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: BASE_MAINNET_CHAIN_ID_HEX }],
        });
      } catch (switchErr: unknown) {
        const err = switchErr as { code?: number | string };
        if (err && (err.code === 4902 || err.code === "4902")) {
          try {
            await provider.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: BASE_MAINNET_CHAIN_ID_HEX,
                  chainName: "Base",
                  nativeCurrency: {
                    name: "Ether",
                    symbol: "ETH",
                    decimals: 18,
                  },
                  rpcUrls: ["https://mainnet.base.org"],
                  blockExplorerUrls: ["https://basescan.org"],
                },
              ],
            });
          } catch {
            throw new Error("WRONG_NETWORK");
          }
        } else {
          throw new Error("WRONG_NETWORK");
        }
      }
    }
  } catch {
    throw new Error("WRONG_NETWORK");
  }

  console.log("[x402-ui] wallet address", address, "chainId", chainId);

  // 3) Signer pour eth_signTypedData_v4 (x402), avec chain pour ExactEvmSchemeV1
  const signer = {
    address,
    async signTypedData(message: {
      domain: Record<string, unknown>;
      types: Record<string, unknown>;
      primaryType: string;
      message: Record<string, unknown>;
    }): Promise<`0x${string}`> {
      const typedData = {
        domain: message.domain,
        types: message.types,
        primaryType: message.primaryType,
        message: message.message,
      };
      const convertedTypedData = deepConvertBigIntToString(typedData);
      console.debug("[x402-ui] signTypedData: bigint normalized");
      const params = [address, JSON.stringify(convertedTypedData)];
      try {
        const signature = (await provider.request({
          method: "eth_signTypedData_v4",
          params,
        })) as string;
        return signature as `0x${string}`;
      } catch (err: unknown) {
        const e = err as { code?: number | string; message?: string; stack?: string };
        console.error("[x402-ui] eth_signTypedData_v4 error:", {
          code: e?.code,
          message: e?.message,
          stack: e?.stack,
          primaryType: message.primaryType,
        });
        throw err;
      }
    },
  };

  const signerWithChain = { ...signer, chain: (signer as { chain?: typeof base }).chain ?? base };
  console.debug("[x402-ui] walletClient.chain?.id =", (signerWithChain as { chain?: { id: number } }).chain?.id);

  const client = new x402Client();
  const signerCast = signerWithChain as unknown as ClientEvmSigner;
  registerExactEvmScheme(client as any, {
    signer: signerCast,
    networks: ["eip155:8453"],
    evm: { chainId: 8453n },
  } as any);
  client.registerV1("eip155:8453", new ExactEvmSchemeV1Caip2Adapter(signerCast));
  client.registerV1("eip155:84532", new ExactEvmSchemeV1Caip2Adapter(signerCast));
  client.registerV1("base", new ExactEvmSchemeV1(signerCast));
  client.registerV1("base-sepolia", new ExactEvmSchemeV1(signerCast));

  console.debug("[x402-ui] registered schemes: exact eip155:8453/base (v1 adapter + v2)");

  const paidFetch = wrapFetchWithPaymentLogged(window.fetch.bind(window), client);
  console.debug("[x402-ui] using paidFetch wrapper =", typeof paidFetch);
  return paidFetch;
}

/**
 * Uses the provider chosen in the wallet picker (Navbar or enter page), or rehydrates from localStorage
 * so the wallet stays connected across reloads until the user disconnects in the wallet.
 */
export async function createPaidFetchFromConnectedWallet(): Promise<
  (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
> {
  if (typeof window === "undefined") {
    throw new Error("NO_WALLET_PROVIDER");
  }

  // Rehydrate from localStorage if store is empty (e.g. after page reload before Navbar mounted)
  let provider = getSelectedProvider();
  if (!provider) {
    rehydrateProvider();
    provider = getSelectedProvider();
  }

  const eth = (window as Window & { ethereum?: EthereumProvider }).ethereum;
  provider = provider ?? eth ?? null;
  if (!provider?.request) {
    throw new Error("NO_WALLET_PROVIDER");
  }

  return createPaidFetchFromProvider(provider as EthereumProvider);
}

