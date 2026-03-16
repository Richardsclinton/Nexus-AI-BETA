/**
 * Constantes x402 partagées (client + serveur).
 * Côté client : NEXT_PUBLIC_X402_PROTOCOL_VERSION (1 ou 2).
 * Côté serveur : X402_PROTOCOL_VERSION. Doivent être identiques pour éviter mix v1/v2.
 */
const raw =
  typeof process !== "undefined" && process.env?.NEXT_PUBLIC_X402_PROTOCOL_VERSION != null
    ? process.env.NEXT_PUBLIC_X402_PROTOCOL_VERSION.trim()
    : "1";

/** 1 = v1 strict (X-PAYMENT, base), 2 = v2 strict (PAYMENT-SIGNATURE, eip155:8453). */
export const X402_PROTOCOL_VERSION_PUBLIC = raw === "2" ? 2 : 1;

/** Nom du header à envoyer (client) / lire (serveur) pour le paiement. */
export const PAYMENT_HEADER_NAME =
  X402_PROTOCOL_VERSION_PUBLIC === 2 ? "PAYMENT-SIGNATURE" : "X-PAYMENT";
