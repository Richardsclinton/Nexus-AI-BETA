/**
 * Redaction de chaînes sensibles : noms de providers, URLs upstream, noms de variables d'env.
 * À utiliser pour tout ce qui pourrait sortir vers le client ou être loggé en production.
 */

const PROVIDER_PATTERNS = [
  /fal\.ai/gi,
  /\bfal\b/gi,
  /venice\.ai/gi,
  /\bvenice\b/gi,
  /pexels/gi,
  /openai/gi,
  /anthropic/gi,
  /gemini/gi,
  /claude/gi,
  /gpt-\d/gi,
  /llama/gi,
];

const ENV_VAR_PATTERNS = [
  /FAL_KEY/gi,
  /VENICE_INFERENCE_KEY/gi,
  /VENICE_CHAT_MODEL/gi,
  /PEXELS_API_KEY/gi,
  /SESSION_SIGNING_SECRET/gi,
  /VERCEL_ENV/gi,
  /VERCEL_URL/gi,
];

const REPLACEMENT = "[redacted]";

/**
 * Redacte toute chaîne pouvant révéler un provider ou une variable d'env.
 */
export function redact(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = redact(v);
    }
    return out;
  }
  return value;
}

export function redactString(s: string): string {
  let out = s;
  for (const re of PROVIDER_PATTERNS) {
    out = out.replace(re, REPLACEMENT);
  }
  for (const re of ENV_VAR_PATTERNS) {
    out = out.replace(re, REPLACEMENT);
  }
  return out;
}

/**
 * Vérifie qu'une chaîne ne contient pas de fuite connue (pour assertions).
 */
export function hasLeak(s: string): boolean {
  const lower = s.toLowerCase();
  const leaks = [
    "fal_key",
    "venice",
    "pexels",
    "openai",
    "anthropic",
    "session_signing_secret",
    "vercel env",
    "check vercel",
  ];
  return leaks.some((l) => lower.includes(l));
}
