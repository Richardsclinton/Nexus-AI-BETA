import { NextRequest, NextResponse } from "next/server";
import { x402ResourceServer } from "@x402/core/server";
import type { PaymentPayload, PaymentRequirements, PaymentRequired } from "@x402/core/types";
import { VerifyError } from "@x402/core/types";
import { decodePaymentSignatureHeader, encodePaymentRequiredHeader } from "@x402/core/http";
import { toFacilitatorSlug, toCaip2, SLUG_TO_CAIP2 } from "@/lib/x402/networkMap";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { FacilitatorClientWithSafeVerify } from "@/lib/x402/facilitatorClient";
import { verifyTxHashPayment, TXHASH_REGEX } from "@/lib/x402/txhashVerify";

/** EVM scheme : slug→CAIP-2 pour parsePrice + champs V1 (resource, description, mimeType, maxAmountRequired) pour le facilitator /verify */
class ExactEvmSchemeWithSlug extends ExactEvmScheme {
  override async parsePrice(
    price: Parameters<ExactEvmScheme["parsePrice"]>[0],
    network: string
  ): Promise<{ amount: string; asset: string; extra?: Record<string, unknown> }> {
    const caip2 = (network.includes(":") ? network : (SLUG_TO_CAIP2[network] ?? network)) as `${string}:${string}`;
    return super.parsePrice(price, caip2);
  }

  override async enhancePaymentRequirements(
    paymentRequirements: PaymentRequirements,
    supportedKind: { x402Version: number; scheme: string; network: `${string}:${string}`; extra?: Record<string, unknown> },
    extensionKeys: string[]
  ): Promise<PaymentRequirements> {
    const base = await super.enhancePaymentRequirements(paymentRequirements, supportedKind, extensionKeys);
    const extra = (paymentRequirements.extra as Record<string, unknown>) ?? {};
    return {
      ...base,
      resource: (extra.url as string) ?? (base as Record<string, unknown>).resource ?? "",
      description: (extra.description as string) ?? (base as Record<string, unknown>).description ?? "",
      mimeType: (extra.mimeType as string) ?? (base as Record<string, unknown>).mimeType ?? "application/json",
      maxAmountRequired: (base.amount ?? (paymentRequirements as Record<string, unknown>).amount ?? "0") as string,
      outputSchema: ((base as Record<string, unknown>).outputSchema ?? {}) as Record<string, unknown>,
    } as PaymentRequirements;
  }
}

const PAY_TO = process.env.PAY_TO?.trim();
const X402_PRICE = parseFloat(process.env.X402_PRICE ?? "0.05");
const X402_NETWORK_ENV = process.env.X402_NETWORK?.trim() || "base";
const X402_FACILITATOR_URL =
  process.env.X402_FACILITATOR_URL?.trim() || "https://facilitator.x402.rs";
const X402_VERSION_ENV = process.env.X402_VERSION?.trim();

/** Version stricte du protocole : 1 (X-PAYMENT, network slug "base") ou 2 (PAYMENT-SIGNATURE, eip155:8453). Pas de mix. */
const X402_PROTOCOL_VERSION = (() => {
  const v = process.env.X402_PROTOCOL_VERSION?.trim() || process.env.X402_VERSION?.trim() || "1";
  return v === "2" ? 2 : 1;
})();

/** Nom du header client pour le paiement : v1 = X-PAYMENT, v2 = PAYMENT-SIGNATURE. */
export const X402_PAYMENT_HEADER_NAME = X402_PROTOCOL_VERSION === 2 ? "PAYMENT-SIGNATURE" : "X-PAYMENT";

// facilitator.x402.rs /supported renvoie "network":"base" (slug), pas eip155:8453
// En mode v1 strict : network slug "base". En mode v2 strict : CAIP-2 "eip155:8453".
const slugNetwork = toFacilitatorSlug(X402_NETWORK_ENV);
const caip2Network = toCaip2(X402_NETWORK_ENV) as `${string}:${string}`;

/** USDC natif Circle sur Base (eip155:8453) - même adresse que @x402/evm exact/server */
const EXACT_TOKEN_BASE = {
  symbol: "USDC",
  address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  decimals: 6,
  name: "USD Coin",
};

/** Mode x402 sans facilitator : vérification par txHash on-chain (Base, USDC). */
const X402_MODE = process.env.X402_MODE?.trim().toLowerCase() || "";
const X402_MODE_TXHASH = X402_MODE === "txhash";

/** Montant USDC en unités 6 decimals (0.05 USDC = 50000). */
const TXHASH_AMOUNT = "50000";

if (!PAY_TO) {
  console.warn(
    "[x402] PAY_TO is not set. In production, this must be defined to start the server."
  );
}

const facilitatorBaseUrl = X402_FACILITATOR_URL.replace(/\/$/, "");

const exactScheme = new ExactEvmSchemeWithSlug();
const SCHEME_ID = exactScheme.scheme as string;

// Client qui lit response.text() avant JSON pour exposer l'erreur réelle du facilitator
const facilitatorClient = new FacilitatorClientWithSafeVerify({ url: facilitatorBaseUrl });
const resourceServer = new x402ResourceServer(facilitatorClient);
// Enregistrer les deux formats : le facilitator peut renvoyer "base" ou "eip155:8453" dans /supported
resourceServer.register(slugNetwork as `${string}:${string}`, exactScheme);
resourceServer.register(caip2Network, exactScheme);

let initPromise: Promise<void> | null = null;
let initDone = false;
let initError: Error | null = null;
/** Réseau effectif après init (slug ou CAIP-2 selon ce que le facilitator renvoie) */
let effectiveNetwork: `${string}:${string}` = slugNetwork as `${string}:${string}`;

export async function ensureX402Initialized(): Promise<void> {
  if (initDone) {
    if (initError) throw initError;
    return;
  }
  if (initPromise) {
    await initPromise;
    if (initError) throw initError;
    return;
  }
  initPromise = (async () => {
    try {
      await resourceServer.initialize();
    } catch (err) {
      initError = err instanceof Error ? err : new Error(String(err));
      throw initError;
    }
    // https://facilitator.x402.rs/supported renvoie kind.network = "base"
    const supported = resourceServer.getSupportedKind(1, slugNetwork as `${string}:${string}`, SCHEME_ID);
    if (!supported) {
      const fallback = resourceServer.getSupportedKind(1, caip2Network, SCHEME_ID);
      if (fallback) {
        effectiveNetwork = caip2Network;
        if (process.env.NODE_ENV !== "production") console.log("[x402] using facilitator network (caip2):", effectiveNetwork);
      } else {
        initError = new Error(
          `Facilitator does not support ${SCHEME_ID} on ${slugNetwork}. Check X402_FACILITATOR_URL and network.`
        );
        throw initError;
      }
    } else {
      effectiveNetwork = slugNetwork as `${string}:${string}`;
      if (process.env.NODE_ENV !== "production") console.log("[x402] using facilitator network (slug):", effectiveNetwork);
    }
    initDone = true;
  })();
  await initPromise;
}

const X402_MAX_TIMEOUT_SECONDS = 600; // 10 min pour validBefore (EIP-3009)

/** Construit l’URL absolue de la ressource (exigée par le facilitator x402-rs). */
function getResourceAbsoluteUrl(routeKey: string, req: NextRequest | null): string {
  if (req?.url) {
    try {
      return new URL(req.url).href;
    } catch {
      // fallback
    }
  }
  const base = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL ?? "http://localhost:3000";
  const origin = base.startsWith("http") ? base : `https://${base}`;
  const path = routeKey.startsWith("/") ? routeKey : routeKey.replace(/^[A-Z]+\s+/, "/"); // "POST /api/chat" -> "/api/chat"
  return `${origin.replace(/\/$/, "")}${path}`;
}

function getResourceConfig(routeKey: string, req?: NextRequest | null) {
  const resourceInfo = getResourceInfo(routeKey, req);
  return {
    scheme: "exact" as const,
    payTo: PAY_TO || "",
    price: X402_PRICE,
    network: effectiveNetwork,
    maxTimeoutSeconds: X402_MAX_TIMEOUT_SECONDS,
    extra: { url: resourceInfo.url, description: resourceInfo.description, mimeType: resourceInfo.mimeType },
  };
}

function getResourceInfo(routeKey: string, req?: NextRequest | null): { url: string; description: string; mimeType: string } {
  const url = getResourceAbsoluteUrl(routeKey, req ?? null);
  return {
    url,
    description: "Nexus AI chat execution",
    mimeType: "application/json",
  };
}

/** Force la réponse Payment Required en format v1 pour le client et le facilitator. */
function normalizePaymentRequiredToV1(pr: Record<string, unknown>): Record<string, unknown> {
  const accepts = (pr.accepts ?? pr.paymentRequirements ?? []) as Record<string, unknown>[];
  const normalized = accepts.map((a) => ({
    ...a,
    x402Version: 1,
  }));
  return {
    x402Version: 1,
    accepts: normalized,
    paymentRequirements: normalized,
    error: pr.error,
    resource: pr.resource,
    ...(pr.extensions && Object.keys(pr.extensions as object).length > 0 ? { extensions: pr.extensions } : {}),
  };
}

function build402Response(
  paymentRequiredHeader: string,
  bodyExtra?: Record<string, unknown>
): NextResponse {
  const body = { ...bodyExtra };
  const res = new NextResponse(JSON.stringify(body), { status: 402 });
  res.headers.set("Content-Type", "application/json");
  res.headers.set("PAYMENT-REQUIRED", paymentRequiredHeader);
  res.headers.set("Access-Control-Expose-Headers", "PAYMENT-REQUIRED, PAYMENT-RESPONSE");
  return res;
}

function build500FacilitatorUnsupported(message: string): NextResponse {
  const body = {
    code: "FACILITATOR_UNSUPPORTED",
    message,
  };
  const res = new NextResponse(JSON.stringify(body), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });
  return res;
}

function build500ProcessFailed(message: string, err?: unknown): NextResponse {
  const body: { error: string; message: string; stack?: string } = {
    error: "X402_PROCESS_FAILED",
    message,
  };
  if (process.env.NODE_ENV !== "production" && err instanceof Error && err.stack) {
    body.stack = err.stack;
  }
  return NextResponse.json(body, {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });
}

function build502FacilitatorError(message: string, detail?: string): NextResponse {
  return NextResponse.json(
    { error: "FACILITATOR_ERROR", message, ...(detail && { facilitatorDetail: detail }) },
    { status: 502, headers: { "Content-Type": "application/json" } }
  );
}

/** Requirements pour mode txhash (402 sans facilitator). */
function buildTxHashRequirements(routeKey: string, req?: NextRequest | null) {
  const resourceInfo = getResourceInfo(routeKey, req ?? null);
  return {
    payTo: PAY_TO || "",
    asset: EXACT_TOKEN_BASE.address,
    amount: TXHASH_AMOUNT,
    network: "base",
    description: resourceInfo.description,
    x402Mode: "txhash" as const,
  };
}

/** 402 payload when payment is required (no txHash yet). */
export type TxHash402Required = ReturnType<typeof buildTxHashRequirements>;

/** 402 payload with machine-readable status (after txHash sent). */
export type TxHash402Status =
  | { paymentStatus: "pending"; retryAfterMs: number }
  | { paymentStatus: "invalid"; reason: string }
  | { paymentStatus: "failed"; reason: string };

function build402TxHashResponse(
  requirements: ReturnType<typeof buildTxHashRequirements>,
  statusPayload?: TxHash402Status
): NextResponse {
  const body = statusPayload
    ? { ...requirements, ...statusPayload }
    : { ...requirements };
  const res = new NextResponse(JSON.stringify(body), { status: 402 });
  res.headers.set("Content-Type", "application/json");
  res.headers.set("Access-Control-Expose-Headers", "PAYMENT-REQUIRED, PAYMENT-RESPONSE");
  return res;
}

function reasonToStatusPayload(reason: string): TxHash402Status {
  if (reason === "pending/not found") {
    return { paymentStatus: "pending", retryAfterMs: 2000 };
  }
  if (reason === "failed tx") {
    return { paymentStatus: "failed", reason: "tx_failed" };
  }
  if (reason === "wrong amount") {
    return { paymentStatus: "invalid", reason: "wrong_amount" };
  }
  if (reason === "already used") {
    return { paymentStatus: "invalid", reason: "already_used" };
  }
  if (reason.includes("transfer not found") || reason.includes("wrong payTo")) {
    return { paymentStatus: "invalid", reason: "wrong_payTo" };
  }
  return { paymentStatus: "invalid", reason: "invalid" };
}

export async function enforceX402Payment(
  req: NextRequest,
  routeKey: string
): Promise<
  | { ok: true; paymentResponseHeader?: string; payer?: string; txHash?: string }
  | { ok: false; response: NextResponse }
> {
  const paymentHeaderName = X402_PAYMENT_HEADER_NAME;
  const xPaymentHeader = req.headers.get(paymentHeaderName);
  if (process.env.NODE_ENV !== "production") {
    console.log("[x402] server reading payment header: name=" + paymentHeaderName + ", length=" + (xPaymentHeader?.length ?? 0));
  }

  // Mode txhash ou PAY_TO défini : flux 402 + vérification par txHash (modale + transaction USDC).
  if (X402_MODE_TXHASH || PAY_TO) {
    if (!xPaymentHeader) {
      const requirements = buildTxHashRequirements(routeKey, req);
      if (process.env.NODE_ENV !== "production") {
        console.log("[x402] returning 402 txhash payTo=", requirements.payTo ? requirements.payTo.slice(0, 14) + "..." : "(empty)");
      }
      return { ok: false, response: build402TxHashResponse(requirements) };
    }
    let payload: { txHash?: string };
    try {
      payload = JSON.parse(xPaymentHeader) as { txHash?: string };
    } catch {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "X402_TXHASH_INVALID", message: "X-PAYMENT must be JSON object with txHash" },
          { status: 400, headers: { "Content-Type": "application/json" } }
        ),
      };
    }
    const txHash = payload?.txHash;
    if (typeof txHash !== "string" || !TXHASH_REGEX.test(txHash)) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "X402_TXHASH_INVALID", message: "txHash must match 0x + 64 hex chars" },
          { status: 400, headers: { "Content-Type": "application/json" } }
        ),
      };
    }
    const payTo = PAY_TO || "";
    if (!payTo) {
      // Ne pas renvoyer 500 : renvoyer 402 avec message pour que le front puisse afficher une erreur config
      const requirements = buildTxHashRequirements(routeKey, req);
      return {
        ok: false,
        response: build402TxHashResponse(
          { ...requirements, payTo: "" },
          { paymentStatus: "invalid", reason: "Server PAY_TO not configured. Set PAY_TO in Vercel env." }
        ),
      };
    }
    try {
      const result = await verifyTxHashPayment({
        txHash,
        payTo,
        asset: EXACT_TOKEN_BASE.address,
        amount: TXHASH_AMOUNT,
      });
      if (!result.ok) {
        const requirements = buildTxHashRequirements(routeKey, req);
        const statusPayload = reasonToStatusPayload(result.reason);
        return { ok: false, response: build402TxHashResponse(requirements, statusPayload) };
      }
      console.log("[x402] txhash verified payer=" + result.payer + " txHash=" + result.txHash);
      return { ok: true, payer: result.payer, txHash: result.txHash };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[x402] verifyTxHashPayment failed:", msg);
      const requirements = buildTxHashRequirements(routeKey, req);
      return {
        ok: false,
        response: build402TxHashResponse(requirements, { paymentStatus: "failed", reason: "tx_failed" }),
      };
    }
  }

  try {
    await ensureX402Initialized();
  } catch (err) {
    console.error("[x402] ERROR message =", err instanceof Error ? err.message : String(err));
    console.error("[x402] ERROR stack =", err instanceof Error ? err.stack : "(no stack)");
    // Retourner 402 au lieu de 500 pour que le front affiche toujours la modale de paiement.
    const requirements = buildTxHashRequirements(routeKey, req);
    return {
      ok: false,
      response: build402TxHashResponse(
        { ...requirements, payTo: PAY_TO || "" },
        { paymentStatus: "invalid", reason: "Server temporarily unavailable. Try again later." }
      ),
    };
  }

  if (!xPaymentHeader) {
    let result;
    try {
      result = await resourceServer.processPaymentRequest(
        null,
        getResourceConfig(routeKey, req),
        getResourceInfo(routeKey, req)
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[x402] processPaymentRequest(no payment) failed:", msg);
      if (err instanceof Error && err.stack) console.error("[x402] stack:", err.stack);
      // Retourner 402 pour que la modale de paiement s'affiche (au lieu de 500).
      const requirements = buildTxHashRequirements(routeKey, req);
      return {
        ok: false,
        response: build402TxHashResponse(
          { ...requirements, payTo: PAY_TO || "" },
          { paymentStatus: "invalid", reason: "Payment service error. Try again." }
        ),
      };
    }
    if (result.requiresPayment) {
      // Facilitator et client utilisent x402 v1 ; le SDK renvoie v2 par défaut → on force v1
      const forClient = normalizePaymentRequiredToV1(result.requiresPayment);
      const headerValue = encodePaymentRequiredHeader(forClient as PaymentRequired);
      return { ok: false, response: build402Response(headerValue, forClient) };
    }
    console.error("[x402] processPaymentRequest returned no requiresPayment (no payment header)");
    return { ok: false, response: build500ProcessFailed("Server could not build payment requirements.") };
  }

  let paymentPayload: PaymentPayload & { accepted?: { scheme: string; network: string } };
  try {
    paymentPayload = decodePaymentSignatureHeader(xPaymentHeader);
  } catch (decodeErr) {
    const msg = decodeErr instanceof Error ? decodeErr.message : String(decodeErr);
    return { ok: false, response: build500ProcessFailed(msg, decodeErr) };
  }

  // Le SDK findMatchingRequirements attend paymentPayload.accepted ; le payload v1 du client n'a que scheme/network à la racine
  const pr = paymentPayload as Record<string, unknown>;
  if (paymentPayload.x402Version === 1) {
    const p = paymentPayload as { scheme?: string; network?: string; accepted?: { scheme?: string; network?: string } };
    const accepted = pr.accepted ?? { scheme: p.scheme ?? "", network: p.network ?? "" };
    pr.accepted = {
      scheme: (accepted as { scheme?: string }).scheme ?? p.scheme ?? "",
      network: (accepted as { network?: string }).network ?? p.network ?? "",
    };
  }

  let result;
  try {
    result = await resourceServer.processPaymentRequest(
      paymentPayload,
      getResourceConfig(routeKey, req),
      getResourceInfo(routeKey, req)
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[x402] processPaymentRequest(with payment) failed:", msg);
    if (err instanceof Error && err.stack) console.error("[x402] stack:", err.stack);
    // VerifyError (ex. 400 Invalid request) → renvoyer 402 pour permettre de réessayer
    if (err instanceof VerifyError) {
      const reason = err.invalidReason ?? msg;
      let result402;
      try {
        result402 = await resourceServer.processPaymentRequest(null, getResourceConfig(routeKey, req), getResourceInfo(routeKey, req));
      } catch {
        return { ok: false, response: build502FacilitatorError(msg) };
      }
      if (result402.requiresPayment) {
        const forClient = normalizePaymentRequiredToV1(result402.requiresPayment);
        const headerValue = encodePaymentRequiredHeader(forClient as PaymentRequired);
        return { ok: false, response: build402Response(headerValue, { ...forClient, paymentError: reason }) };
      }
      return { ok: false, response: build502FacilitatorError(msg) };
    }
    // Réponse facilitator en texte (ex. "Failed to ...") au lieu de JSON → 502
    const isFacilitatorError =
      err instanceof SyntaxError ||
      (typeof msg === "string" && (msg.includes("is not valid JSON") || msg.includes("Failed to")));
    if (isFacilitatorError || msg.includes("FACILITATOR_VERIFY_FAILED") || msg.includes("FACILITATOR_SETTLE_FAILED")) {
      return { ok: false, response: build502FacilitatorError(msg) };
    }
    return { ok: false, response: build500ProcessFailed(msg, err) };
  }

  if (!result.success) {
    const paymentRequired = result.requiresPayment;
    if (paymentRequired) {
      const headerValue = encodePaymentRequiredHeader(paymentRequired);
      return { ok: false, response: build402Response(headerValue, { tokenForBase: EXACT_TOKEN_BASE }) };
    }
    return { ok: false, response: build500ProcessFailed("Payment verification failed; no payment required data.") };
  }

  // encodePaymentResponseHeader expects SettleResponse; we only have verificationResult here
  const paymentResponseHeader = undefined;
  return { ok: true, paymentResponseHeader };
}
