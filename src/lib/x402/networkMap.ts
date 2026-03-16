/**
 * Mapping between CAIP-2 network ids and facilitator-style slugs.
 * Facilitators like https://facilitator.x402.rs expose /supported with slugs (base, base-sepolia).
 * The SDK and EVM scheme use CAIP-2 (eip155:8453) for chainId and asset lookup.
 */

const CAIP2_TO_SLUG: Record<string, string> = {
  "eip155:8453": "base",
  "eip155:84532": "base-sepolia",
  "eip155:137": "polygon",
  "eip155:80002": "polygon-amoy",
  "eip155:43114": "avalanche",
  "eip155:43113": "avalanche-fuji",
  "eip155:1": "ethereum",
  "eip155:11155111": "sepolia",
};

const SLUG_TO_CAIP2: Record<string, string> = {};
for (const [caip2, slug] of Object.entries(CAIP2_TO_SLUG)) {
  SLUG_TO_CAIP2[slug] = caip2;
}

/**
 * Resolve env network (CAIP-2 or slug) to the slug used by the facilitator.
 * If the value is already a known slug, return as-is. If it's CAIP-2, return the slug.
 */
export function toFacilitatorSlug(network: string): string {
  const trimmed = network.trim();
  if (SLUG_TO_CAIP2[trimmed] !== undefined) {
    return trimmed;
  }
  return CAIP2_TO_SLUG[trimmed] ?? trimmed;
}

/**
 * Resolve env network (CAIP-2 or slug) to CAIP-2 for resourceConfig and client.
 * If the value is already CAIP-2 (contains ":"), return as-is. If it's a slug, return CAIP-2.
 */
export function toCaip2(network: string): string {
  const trimmed = network.trim();
  if (trimmed.includes(":")) {
    return trimmed;
  }
  return SLUG_TO_CAIP2[trimmed] ?? trimmed;
}

/**
 * Normalize a single network string for client exposure: if it's a known slug, return CAIP-2.
 */
export function normalizeNetworkForClient(network: string): string {
  const trimmed = network?.trim() ?? "";
  if (trimmed.includes(":")) return trimmed;
  return SLUG_TO_CAIP2[trimmed] ?? trimmed;
}

export { CAIP2_TO_SLUG, SLUG_TO_CAIP2 };
