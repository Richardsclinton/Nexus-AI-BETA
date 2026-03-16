import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import crypto from "crypto";

/**
 * Utilitaires de sécurité backend-only.
 * IMPORTANT : aucun effet sur le rendu (HTML/CSS/JS), uniquement sur les réponses API
 * en cas d'abus (429/403) ou de mauvaise configuration serveur.
 */

export type RateLimitKind = "chat" | "upload" | "contact" | "reference-image";

type LimitConfig = {
  perMinuteIp: number;
  perMinuteSession: number;
  burst10sIp: number;
  burst10sSession: number;
};

const RATE_LIMIT_CONFIG: Record<RateLimitKind, LimitConfig> = {
  chat: {
    perMinuteIp: 20,
    perMinuteSession: 15,
    burst10sIp: 5,
    burst10sSession: 4,
  },
  upload: {
    perMinuteIp: 6,
    perMinuteSession: 4,
    burst10sIp: 2,
    burst10sSession: 2,
  },
  contact: {
    perMinuteIp: 3,
    perMinuteSession: 2,
    burst10sIp: 1,
    burst10sSession: 1,
  },
  "reference-image": {
    perMinuteIp: 15,
    perMinuteSession: 10,
    burst10sIp: 4,
    burst10sSession: 3,
  },
};

const SESSION_COOKIE_NAME = "nexus_sid";

const env = process.env.VERCEL_ENV || process.env.NODE_ENV || "development";
const isProdLike = env === "production" || env === "preview";

let redis: Redis | null = null;
try {
  redis = Redis.fromEnv();
} catch (e) {
  console.error("[security] Redis client init failed:", e);
  redis = null;
}

export function getClientIp(req: NextRequest): string {
  const direct = (req as any).ip as string | undefined;
  if (direct) return direct;

  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  return "unknown";
}

function signSessionId(id: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(id).digest("hex");
}

function verifySessionCookieValue(raw: string, secret: string): string | null {
  const [id, sig] = raw.split(".");
  if (!id || !sig) return null;
  const expected = signSessionId(id, secret);
  return sig === expected ? id : null;
}

/**
 * Crée ou lit l'identifiant de session signé.
 * En production/preview : si SESSION_SIGNING_SECRET est absent → erreur 500 "fail closed".
 * En dev : un secret de fallback est utilisé.
 */
export function getOrCreateSessionId(
  req: NextRequest
): { id: string; cookie: string | null } | { error: NextResponse } {
  const secret = process.env.SESSION_SIGNING_SECRET;

  if (!secret) {
    if (isProdLike) {
      return {
        error: NextResponse.json(
          { ok: false, code: "CONFIG_ERROR", message: "Server configuration error. Please try again later." },
          { status: 500 }
        ),
      };
    }
  }

  const effectiveSecret = secret ?? "dev-local-session-secret-only";

  const existing = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (existing) {
    const validId = verifySessionCookieValue(existing, effectiveSecret);
    if (validId) {
      return { id: validId, cookie: null };
    }
  }

  const id = crypto.randomUUID();
  const sig = signSessionId(id, effectiveSecret);
  const value = `${id}.${sig}`;

  const maxAgeSeconds = 30 * 24 * 60 * 60; // 30 jours
  const cookie = `${SESSION_COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;

  return { id, cookie };
}

export function attachSessionCookie(res: NextResponse, cookie: string | null): NextResponse {
  if (cookie) {
    res.headers.append("Set-Cookie", cookie);
  }
  return res;
}

/**
 * Applique un rate limit Redis par IP + sessionId pour un type d'API donné.
 * - En production/preview : si Redis est mal configuré, on bloque /api/chat et /api/upload.
 * - En dev : si Redis absent, on log et on laisse passer (pas de rate limit persistant).
 */
export async function applyRateLimit(
  kind: RateLimitKind,
  req: NextRequest,
  sessionId: string
): Promise<NextResponse | null> {
  const cfg = RATE_LIMIT_CONFIG[kind];

  if (!redis) {
    // En prod/preview : ne pas bloquer si Redis absent (ex. Vercel sans Upstash) pour que l'app fonctionne.
    // Rate limit désactivé jusqu'à configuration UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.
    if (isProdLike) {
      console.warn("[security] Redis not configured in production/preview - rate limiting disabled for", kind);
    } else {
      console.warn("[security] Redis not configured - rate limiting disabled for kind:", kind);
    }
    return null;
  }

  const ip = getClientIp(req);

  const keys = [
    { key: `rl:${kind}:ip:${ip}:1m`, limit: cfg.perMinuteIp, ttl: 60 },
    { key: `rl:${kind}:sid:${sessionId}:1m`, limit: cfg.perMinuteSession, ttl: 60 },
    { key: `rl:${kind}:ip:${ip}:10s`, limit: cfg.burst10sIp, ttl: 10 },
    { key: `rl:${kind}:sid:${sessionId}:10s`, limit: cfg.burst10sSession, ttl: 10 },
  ];

  for (const { key, limit, ttl } of keys) {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, ttl);
    }
    if (count > limit) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        { status: 429 }
      );
    }
  }

  return null;
}

/**
 * Vérifie que les requêtes proviennent bien du même domaine (anti-clone basique).
 * - Si Origin est absent : on autorise (scripts locaux, tests).
 * - Si Origin est présent : il doit correspondre à Host.
 */
export function enforceSameOrigin(req: NextRequest): NextResponse | null {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");

  if (!origin || !host) {
    // Pas d'Origin → on ne bloque pas (CLI / outils internes).
    return null;
  }

  let originHost: string | null = null;
  try {
    originHost = new URL(origin).host;
  } catch {
    // Origin invalide → on laisse passer (ne pas casser les cas exotiques)
    return null;
  }

  if (originHost !== host) {
    // Requête provenant d'un autre domaine → on bloque.
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}

