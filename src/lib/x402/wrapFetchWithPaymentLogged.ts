"use client";

import { x402Client, x402HTTPClient } from "@x402/core/client";
import type { PaymentRequired } from "@x402/core/types";
import { PAYMENT_HEADER_NAME } from "@/lib/x402/constants";

function pr0Fields(pr: PaymentRequired | Record<string, unknown>): Record<string, unknown> {
  const r = pr as { paymentRequirements?: unknown[]; accepts?: unknown[] };
  const pr0 = r?.paymentRequirements?.[0] ?? r?.accepts?.[0];
  if (!pr0 || typeof pr0 !== "object") return {};
  const o = pr0 as Record<string, unknown>;
  return {
    x402Version: o.x402Version,
    scheme: o.scheme,
    network: o.network,
    amount: o.amount,
    asset: o.asset,
    payTo: o.payTo,
  };
}

type ClientLike = InstanceType<typeof x402Client> | InstanceType<typeof x402HTTPClient>;

/**
 * Wrapper autour de wrapFetchWithPayment qui ajoute des console.debug sur paymentRequired
 * et avant createPaymentPayload. Utilise la même logique que @x402/fetch.
 */
export function wrapFetchWithPaymentLogged(
  fetchFn: typeof fetch,
  client: ClientLike
): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> {
  const httpClient = client instanceof x402HTTPClient ? client : new x402HTTPClient(client as InstanceType<typeof x402Client>);

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    console.debug("[x402] wrapFetchWithPaymentLogged CALLED", { url: String(input), init });
    const request = new Request(input, init);
    const clonedRequest = request.clone();
    const response = await fetchFn(request);

    if (response.status !== 402) {
      return response;
    }

    let paymentRequired: PaymentRequired;
    try {
      const getHeader = (name: string) => response.headers.get(name);
      let body: unknown;
      try {
        const responseText = await response.text();
        if (responseText) {
          body = JSON.parse(responseText);
        }
      } catch {
        // ignore
      }
      paymentRequired = httpClient.getPaymentRequiredResponse(getHeader, body);
    } catch (error) {
      throw new Error(
        `Failed to parse payment requirements: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }

    // Normalisation : si paymentRequirements absent mais accepts présent, aligner ; puis garantir x402Version sur chaque entrée
    const pr = paymentRequired as Record<string, unknown>;
    if ((pr.paymentRequirements == null || (Array.isArray(pr.paymentRequirements) && pr.paymentRequirements.length === 0)) && Array.isArray(pr.accepts) && pr.accepts.length > 0) {
      pr.paymentRequirements = pr.accepts;
    }
    const topVersion = pr.x402Version;
    const arr = Array.isArray(pr.paymentRequirements) ? pr.paymentRequirements : [];
    const SLUG_TO_CHAIN_ID_N: Record<string, bigint> = { base: 8453n, "base-sepolia": 84532n };
    for (let i = 0; i < arr.length; i++) {
      const entry = arr[i];
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        const e = entry as Record<string, unknown>;
        if (e.x402Version === undefined && topVersion !== undefined) {
          e.x402Version = topVersion;
        }
        if (e.chainId === undefined && typeof e.network === "string") {
          const slug = e.network.includes(":") ? (e.network === "eip155:8453" ? "base" : e.network === "eip155:84532" ? "base-sepolia" : null) : e.network;
          if (slug && SLUG_TO_CHAIN_ID_N[slug] !== undefined) {
            e.chainId = SLUG_TO_CHAIN_ID_N[slug];
          }
        }
      }
    }

    const prForLog = paymentRequired as Record<string, unknown>;
    console.debug("[x402] paymentRequired =", paymentRequired);
    console.debug("[x402] paymentRequired.paymentRequirements?.[0] =", (prForLog?.paymentRequirements as unknown[] | undefined)?.[0]);
    console.debug("[x402] paymentRequired.accepts?.[0] =", (prForLog?.accepts as unknown[] | undefined)?.[0]);
    console.debug("[x402] pr0 fields =", pr0Fields(paymentRequired));

    const hookHeaders = await httpClient.handlePaymentRequired(paymentRequired);
    if (hookHeaders) {
      const hookRequest = clonedRequest.clone();
      for (const [key, value] of Object.entries(hookHeaders)) {
        hookRequest.headers.set(key, value);
      }
      const hookResponse = await fetchFn(hookRequest);
      if (hookResponse.status !== 402) {
        return hookResponse;
      }
    }

    console.debug("[x402] before createPaymentPayload, pr0 fields =", pr0Fields(paymentRequired));
    console.debug("[x402] calling createPaymentPayload with =", paymentRequired);

    let paymentPayload: unknown;
    try {
      paymentPayload = await client.createPaymentPayload(paymentRequired);
    } catch (e) {
      console.error("[x402] createPaymentPayload FAILED", e, { paymentRequired });
      throw new Error(
        `Failed to create payment payload: ${e instanceof Error ? e.message : "Unknown error"}`
      );
    }

    const paymentHeaders = httpClient.encodePaymentSignatureHeader(paymentPayload as Parameters<InstanceType<typeof x402HTTPClient>["encodePaymentSignatureHeader"]>[0]);
    const headersObj = paymentHeaders as Record<string, string>;
    const xPaymentValue = headersObj[PAYMENT_HEADER_NAME] ?? headersObj["X-PAYMENT"] ?? headersObj["PAYMENT-SIGNATURE"];
    const headerNameSent = PAYMENT_HEADER_NAME;
    if (clonedRequest.headers.has(headerNameSent)) {
      throw new Error("Payment already attempted");
    }
    if (xPaymentValue) {
      clonedRequest.headers.set(headerNameSent, xPaymentValue);
      console.debug("[x402] client sending payment header: name=" + headerNameSent + ", size=" + (xPaymentValue?.length ?? 0));
    }
    clonedRequest.headers.set("Access-Control-Expose-Headers", "PAYMENT-RESPONSE,X-PAYMENT-RESPONSE");
    const secondResponse = await fetchFn(clonedRequest);
    return secondResponse;
  };
}
