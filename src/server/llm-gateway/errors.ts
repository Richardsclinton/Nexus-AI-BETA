/**
 * Erreurs normalisées pour le client. Aucun nom de provider ni de variable d'env ne doit sortir.
 */

import type { ClientErrorCode, NormalizedClientError } from "./types";

const SAFE_MESSAGES: Record<ClientErrorCode, string> = {
  CONFIG_ERROR: "Server configuration error. Please try again later.",
  UPSTREAM_ERROR: "Service temporarily unavailable. Please try again.",
  RATE_LIMIT: "Too many requests. Please slow down.",
  INVALID_REQUEST: "Invalid request. Please check your input.",
  PAYMENT_REQUIRED: "Payment required to complete this request.",
  TIMEOUT: "Request took too long. Please try again.",
  QUOTA: "Limit reached. Please try again later.",
  CONTENT_POLICY: "This request could not be completed due to content policy.",
  NOT_FOUND: "Resource not found.",
};

/**
 * Construit une erreur client normalisée. Le message est toujours un message générique (jamais de fuite).
 */
export function toClientError(code: ClientErrorCode): NormalizedClientError {
  return { ok: false, code, message: SAFE_MESSAGES[code] };
}

/**
 * Erreur levée par les providers ; le code est utilisé pour construire la réponse client.
 */
export class GatewayError extends Error {
  constructor(
    public readonly code: ClientErrorCode,
    readonly internalContext?: string
  ) {
    super(SAFE_MESSAGES[code]);
    this.name = "GatewayError";
  }
}

/**
 * Codes pour usage interne / logs uniquement (jamais envoyés au client tels quels).
 */
export const InternalErrorCodes = {
  MISSING_CREDENTIALS: "CONFIG_ERROR" as ClientErrorCode,
  UPSTREAM_FAILED: "UPSTREAM_ERROR" as ClientErrorCode,
  RATE_LIMITED: "RATE_LIMIT" as ClientErrorCode,
  BAD_REQUEST: "INVALID_REQUEST" as ClientErrorCode,
  PAYMENT_REQUIRED: "PAYMENT_REQUIRED" as ClientErrorCode,
  TIMEOUT: "TIMEOUT" as ClientErrorCode,
  QUOTA: "QUOTA" as ClientErrorCode,
  CONTENT_POLICY: "CONTENT_POLICY" as ClientErrorCode,
  NOT_FOUND: "NOT_FOUND" as ClientErrorCode,
};
