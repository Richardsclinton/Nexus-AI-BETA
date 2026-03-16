/**
 * Client facilitator qui lit la réponse en texte avant de parser le JSON,
 * pour exposer l'erreur réelle renvoyée par le facilitator (ex. "Failed to ...")
 * et éviter SyntaxError sur response.json().
 * Envoie un body /verify conforme v1 strict (sans accepted, amount).
 */
import { HTTPFacilitatorClient, type FacilitatorClient } from "@x402/core/server";
import { VerifyError } from "@x402/core/types";
import type {
  PaymentPayload,
  PaymentRequirements,
  VerifyResponse,
  SettleResponse,
  SupportedResponse,
} from "@x402/core/types";

const X402_VERIFY_ONLY = process.env.X402_VERIFY_ONLY === "true";

function toJsonSafe(obj: unknown): unknown {
  return JSON.parse(
    JSON.stringify(obj, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}

/** Champs autorisés v1 pour paymentPayload (sans accepted). payload contient signature + authorization uniquement. */
const V1_PAYLOAD_KEYS = ["x402Version", "scheme", "network", "payload"] as const;

/** Format HexEncodedNonce pour x402-rs : "0x" + 64 hex chars (longueur 66). */
function nonceToHexEncodedNonce(nonce: unknown): string {
  if (nonce == null) return "0x" + "0".repeat(64);
  const s = String(nonce).trim();
  if (!s) return "0x" + "0".repeat(64);
  const n = s.startsWith("0x") ? BigInt(s) : BigInt("0x" + s);
  const hex = n.toString(16).padStart(64, "0").slice(-64);
  return "0x" + hex;
}

/** Normalise authorization pour /verify (x402-rs) : value string, valid_after/valid_before (snake_case), nonce "0x"+64 hex. */
function normalizeAuthorization(auth: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (auth.from !== undefined) out.from = auth.from;
  if (auth.to !== undefined) out.to = auth.to;
  if (auth.value !== undefined) out.value = String(auth.value);
  if (auth.validAfter !== undefined) out.valid_after = Number(auth.validAfter);
  if (auth.validBefore !== undefined) out.valid_before = Number(auth.validBefore);
  if (auth.nonce !== undefined) out.nonce = nonceToHexEncodedNonce(auth.nonce);
  return out;
}

/** payload interne: signature, authorization (pas d'autres champs envoyés au facilitator). */
function buildStrictPayloadInner(p: Record<string, unknown>): Record<string, unknown> {
  const inner = (p.payload as Record<string, unknown>) ?? {};
  const out: Record<string, unknown> = {};
  if (typeof inner.signature === "string") out.signature = inner.signature;
  if (inner.authorization != null && typeof inner.authorization === "object" && !Array.isArray(inner.authorization)) {
    out.authorization = normalizeAuthorization(inner.authorization as Record<string, unknown>);
  }
  return out;
}

/** Champs standard "Verify a payment" v1 pour paymentPayload (sans accepted). */
function buildStrictPaymentPayloadV1(p: PaymentPayload): Record<string, unknown> {
  const raw = p as Record<string, unknown>;
  const scheme =
    (raw.scheme as string) ??
    (raw.accepted && typeof raw.accepted === "object" && "scheme" in raw.accepted
      ? (raw.accepted as { scheme?: string }).scheme
      : undefined) ??
    "";
  const network =
    (raw.network as string) ??
    (raw.accepted && typeof raw.accepted === "object" && "network" in raw.accepted
      ? (raw.accepted as { network?: string }).network
      : undefined) ??
    "";
  const out: Record<string, unknown> = {
    x402Version: 1,
    scheme,
    network,
    payload: buildStrictPayloadInner(raw),
  };
  return out;
}

/** Champs autorisés v1 pour paymentRequirements (pas amount, pas accepted). */
const V1_REQUIREMENTS_KEYS = [
  "scheme", "network", "maxAmountRequired", "resource", "payTo", "asset",
  "maxTimeoutSeconds", "mimeType", "description", "outputSchema", "extra",
] as const;

/** Champs standard "Verify a payment" v1 pour paymentRequirements (maxAmountRequired uniquement, pas amount). */
function buildStrictPaymentRequirementsV1(
  pr: PaymentRequirements
): Record<string, unknown> {
  const raw = pr as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of V1_REQUIREMENTS_KEYS) {
    if (k === "maxAmountRequired") {
      out[k] = (raw.maxAmountRequired ?? (raw.amount ?? "0")) as string;
    } else if (k === "maxTimeoutSeconds") {
      out[k] = typeof raw.maxTimeoutSeconds === "number" ? raw.maxTimeoutSeconds : 600;
    } else if (k === "outputSchema") {
      // Facilitator x402.rs attend null, pas {} (sinon 400 Invalid request)
      out[k] = null;
    } else if (k === "extra") {
      // Ne pas envoyer extra au facilitator (x402.rs peut rejeter en 400)
      // out[k] = raw.extra; — omis
    } else {
      const v = raw[k];
      if (v !== undefined) out[k] = v;
      else if (k === "scheme" || k === "network" || k === "resource" || k === "payTo" || k === "asset" || k === "description") out[k] = "";
      else if (k === "mimeType") out[k] = "application/json";
    }
  }
  return out;
}

/** Clés racine autorisées pour le body /verify. */
export const VERIFY_BODY_ROOT_KEYS = ["x402Version", "paymentPayload", "paymentRequirements"] as const;

/** Body /verify v1 strict : x402Version, paymentPayload (sans accepted), paymentRequirements (sans amount). */
export function buildStrictVerifyBodyV1(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements
): { x402Version: number; paymentPayload: Record<string, unknown>; paymentRequirements: Record<string, unknown> } {
  const version = paymentPayload.x402Version === 1 ? 1 : 1;
  return {
    x402Version: version,
    paymentPayload: buildStrictPaymentPayloadV1(paymentPayload),
    paymentRequirements: buildStrictPaymentRequirementsV1(paymentRequirements),
  };
}

/**
 * Wrapper autour de HTTPFacilitatorClient qui surcharge verify() pour :
 * - Envoyer un body /verify v1 strict (sans accepted, amount)
 * - Lire response.text() avant tout parse
 * - Logger status, headers et body complet en cas de status >= 400
 */
export class FacilitatorClientWithSafeVerify implements FacilitatorClient {
  private inner: HTTPFacilitatorClient;

  constructor(config: { url: string }) {
    this.inner = new HTTPFacilitatorClient(config);
  }

  async getSupported(): Promise<SupportedResponse> {
    return this.inner.getSupported();
  }

  async settle(
    paymentPayload: PaymentPayload,
    paymentRequirements: PaymentRequirements
  ): Promise<SettleResponse> {
    if (X402_VERIFY_ONLY) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[x402] X402_VERIFY_ONLY=true: skip settle, return fake success");
      }
      return {
        success: true,
        transaction: "",
        network: "eip155:8453" as SettleResponse["network"],
        extensions: undefined,
      } as SettleResponse;
    }
    return this.inner.settle(paymentPayload, paymentRequirements);
  }

  async verify(
    paymentPayload: PaymentPayload,
    paymentRequirements: PaymentRequirements
  ): Promise<VerifyResponse> {
    const url = (this.inner as { url: string }).url;
    const strictBody = buildStrictVerifyBodyV1(paymentPayload, paymentRequirements);
    const body = JSON.stringify(toJsonSafe(strictBody) as object);

    if (process.env.NODE_ENV !== "production") {
      try {
        console.log("[x402] Facilitator verify request (v1 strict):", JSON.stringify(JSON.parse(body), null, 2));
      } catch {
        // ignore
      }
    }
    console.log("[x402] verify request body =", body);

    const response = await fetch(`${url}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    const text = await response.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      console.error(
        "[x402] Facilitator verify response (non-JSON):",
        response.status,
        text
      );
      throw new Error(
        `Facilitator verify failed (${response.status}): ${text}`
      );
    }

    if (!response.ok) {
      const headersObj: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headersObj[key] = value;
      });
      const parsedBody = typeof data === "object" && data !== null ? JSON.stringify(data, null, 2) : String(data);
      console.error("[x402] Facilitator verify error — status=" + response.status + ", headers=" + JSON.stringify(headersObj) + ", responseBody=" + (text || parsedBody));
    }

    if (X402_VERIFY_ONLY && typeof data === "object" && data !== null && "isValid" in data) {
      console.log("[x402] X402_VERIFY_ONLY: verify response:", JSON.stringify(data, null, 2));
    }

    if (typeof data === "object" && data !== null && "isValid" in data) {
      const verifyResponse = data as VerifyResponse;
      if (!response.ok) {
        throw new VerifyError(response.status, verifyResponse);
      }
      return verifyResponse;
    }

    // 400/4xx avec { error } = échec de vérification côté facilitator (signature, balance, ou schéma invalide)
    if (response.status >= 400 && typeof data === "object" && data !== null && "error" in data) {
      const err = data as { error?: string; invalidReason?: string };
      const reason = (err.invalidReason ?? err.error ?? "Invalid request") as string;
      if (process.env.NODE_ENV !== "production") {
        console.error("[x402] Facilitator verify rejected:", response.status, reason);
      }
      throw new VerifyError(response.status, { isValid: false, invalidReason: reason });
    }

    console.error(
      "[x402] Facilitator verify unexpected body:",
      response.status,
      text
    );
    throw new Error(
      `Facilitator verify failed (${response.status}): ${text}`
    );
  }
}
