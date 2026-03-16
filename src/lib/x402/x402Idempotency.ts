/**
 * Idempotence serveur pour x402 txHash : 1 paiement = 1 exécution max.
 * Clé : txHash + sha256(JSON.stringify(body))
 * En dev : globalThis.__x402Idem. En prod : même API (pourrait être Redis plus tard).
 */
import { createHash } from "crypto";

export type X402IdemEntry =
  | { status: "in_flight"; startedAt: number }
  | { status: "done"; responseBody: unknown; responseStatus: number; headersSubset: Record<string, string> }
  | { status: "failed"; at: number };

declare global {
  // eslint-disable-next-line no-var
  var __x402Idem: Map<string, X402IdemEntry> | undefined;
}

function getStore(): Map<string, X402IdemEntry> {
  if (typeof globalThis.__x402Idem === "undefined") {
    globalThis.__x402Idem = new Map();
  }
  return globalThis.__x402Idem;
}

export function x402IdemKey(txHash: string, body: object): string {
  const raw = JSON.stringify(body);
  const hash = createHash("sha256").update(raw, "utf8").digest("hex");
  return `${txHash.toLowerCase()}_${hash}`;
}

export function getX402Idem(key: string): X402IdemEntry | undefined {
  return getStore().get(key);
}

export function setX402IdemInFlight(key: string): void {
  getStore().set(key, { status: "in_flight", startedAt: Date.now() });
}

export function setX402IdemDone(
  key: string,
  responseBody: unknown,
  responseStatus: number,
  headersSubset: Record<string, string>
): void {
  getStore().set(key, { status: "done", responseBody, responseStatus, headersSubset });
}

export function clearX402Idem(key: string): void {
  getStore().delete(key);
}
