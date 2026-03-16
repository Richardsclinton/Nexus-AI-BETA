import { NextRequest, NextResponse } from "next/server";
import { enforceX402Payment } from "@/lib/x402/server";
import {
  applyRateLimit,
  enforceSameOrigin,
  getOrCreateSessionId,
  attachSessionCookie,
} from "@/lib/security";
import {
  getIdempotencyEntry,
  setIdempotencyExecuted,
  setIdempotencyStatus,
} from "@/lib/idempotency";
import {
  x402IdemKey,
  getX402Idem,
  setX402IdemInFlight,
  setX402IdemDone,
  clearX402Idem,
} from "@/lib/x402/x402Idempotency";
import {
  generateVideo,
  generateText,
  generateImage,
  fetchReferenceImage,
  hasVideoCredentials,
  hasChatCredentials,
  hasReferenceImageCredentials,
  toClientError,
  GatewayError,
} from "@/server/llm-gateway";

/** Réponse client sans champs sensibles (actualPrompt, seed). Pour idempotency replay. */
function clientSafeBody(body: Record<string, unknown>): Record<string, unknown> {
  const { actualPrompt, seed, ...rest } = body;
  return rest;
}

/** Return the first non-empty string among common fields used by the UI. */
function getUserPrompt(body: Record<string, unknown> | null | undefined): string {
  if (!body || typeof body !== "object") return "";
  const candidates = [
    body.message,
    body.prompt,
    body.input,
    body.content,
    body.text,
    body.trailerPrompt,
    body.userPrompt,
    Array.isArray(body.messages) && body.messages.length > 0
      ? (body.messages[body.messages.length - 1] as Record<string, unknown>)?.content
      : undefined,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return "";
}

/** True if this is a trailer request: keyword in prompt OR body has trailer-mode flag. */
function isTrailerRequest(userPrompt: string, body: unknown): boolean {
  const keyword = /trailer/i.test(userPrompt);
  if (keyword) return true;
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    if (b.mode === "trailer") return true;
    if (b.isTrailer === true) return true;
    if (b.trailerMode === true) return true;
    if (b.chatType === "trailer") return true;
    if (b.endpoint === "trailer") return true;
  }
  return false;
}

/** Lightweight intent: true if user message requests an image / visual / picture (main chat only). */
function isImageIntent(message: string): boolean {
  if (!message || typeof message !== "string") return false;
  const lower = message.toLowerCase().trim();
  const keywords = [
    "image",
    "picture",
    "photo",
    "visual",
    "illustration",
    "draw",
    "dessine",
    "génère une image",
    "generate an image",
    "create an image",
    "visualise",
    "visuel",
  ];
  return keywords.some((kw) => lower.includes(kw));
}

const STOP_WORDS = new Set([
  "trailer", "video", "make", "generate", "create", "please", "svp",
  "je", "veux", "fais", "faire", "génère", "genere", "un", "une", "des",
  "le", "la", "les", "de", "du", "dans", "avec", "et", "pour", "sur", "au", "aux", "à", "a",
]);
const PRESERVE_TOKENS = new Set([
  "woman", "female", "man", "male", "girl", "boy", "robot", "android",
  "cyberpunk", "futuristic", "medieval", "noir", "neon", "rain", "night", "sunset",
  "city", "street", "rooftop", "forest", "desert", "space",
]);
const CINEMATIC_SUFFIX = "cinematic photo high quality dramatic lighting";
const FALLBACK_QUERY = "cinematic portrait photo high quality";

/** Extract requested duration in seconds from user prompt (e.g. "10 sec", "15 seconds", "20s"). */
function extractDurationFromPrompt(userPrompt: string): number | null {
  if (!userPrompt || typeof userPrompt !== "string") return null;
  const m = userPrompt.match(/(\d{1,2})\s*(s|sec|secs|secondes?|seconds?)?\b/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (Number.isNaN(n)) return null;
  const clamped = Math.max(1, Math.min(25, n));
  return clamped;
}

/** Build a concise Pexels search query from a natural language prompt. */
function buildPexelsQueryFromPrompt(prompt: string): string {
  if (!prompt || typeof prompt !== "string") return FALLBACK_QUERY;
  let text = prompt
    .toLowerCase()
    .replace(/[^\w\s\u00C0-\u024F'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  text = text.replace(/\bfemme\b/g, "woman").replace(/\bhomme\b/g, "man");
  const tokens = text.split(/\s+/).filter((t) => t.length > 0);
  const kept: string[] = [];
  for (const t of tokens) {
    if (kept.length >= 12) break;
    const lower = t.toLowerCase();
    if (STOP_WORDS.has(lower)) continue;
    if (PRESERVE_TOKENS.has(lower) || t.length > 2) kept.push(t);
  }
  const base = kept.length > 0 ? kept.join(" ") : "";
  const query = base ? `${base} ${CINEMATIC_SUFFIX}` : CINEMATIC_SUFFIX;
  const tokenCount = query.split(/\s+/).filter(Boolean).length;
  return tokenCount >= 3 ? query : FALLBACK_QUERY;
}

function isIdentityQuery(message: string): boolean {
  if (!message || typeof message !== "string") {
    return false;
  }

  const lowerMessage = message.toLowerCase().trim();

  // Patterns to match identity questions (case-insensitive)
  const identityPatterns = [
    /^who\s+(are|r)\s+(you|u)(\?|$)/i,
    /^what\s+(are|is)\s+(you|nexus)(\?|$)/i,
    /^what\s+is\s+nexus(\?|$)/i,
    /^are\s+you\s+nexus(\?|$)/i,
    /^what\s+model\s+(are|is)\s+(you|this)(\?|$)/i,
    /^who\s+(am\s+i\s+)?(talking\s+to|speaking\s+with)(\?|$)/i,
    /^what\s+ai\s+(is\s+)?(this|that)(\?|$)/i,
    /^are\s+you\s+(venice|gemini)(\?|$)/i,
    /^who\s+u(\?|$)/i,
    /^wyd\s+who\s+(are|r)\s+(you|u)(\?|$)/i,
    /^who\s+are\s+you\s+exactly(\?|$)/i,
    /^tell\s+me\s+(who|what)\s+(you|are)(\?|$)/i,
    /^what\s+(do\s+you\s+)?(call|name)\s+(yourself|you)(\?|$)/i,
    /^identify\s+(yourself|as)(\?|$)/i,
  ];

  // Check if message matches any identity pattern
  for (const pattern of identityPatterns) {
    if (pattern.test(lowerMessage)) {
      return true;
    }
  }

  // Also check for key phrases anywhere in the message
  const keyPhrases = [
    "who are you",
    "what are you",
    "what is nexus",
    "are you nexus",
    "what model are you",
    "who am i talking to",
    "what ai is this",
    "are you venice",
    "are you gemini",
    "who r u",
    "who u",
    "wyd who are you",
  ];

  for (const phrase of keyPhrases) {
    if (lowerMessage.includes(phrase)) {
      return true;
    }
  }

  return false;
}

function sanitizeChatReply(text: string): string {
  if (!text || typeof text !== "string") {
    return "How can I help?";
  }

  const forbiddenTerms = [
    "gemini",
    "venice",
    "openai",
    "google",
    "claude",
    "anthropic",
    "gpt-",
    "llama",
    "meta",
    "provider",
    "powered by",
    "run on",
    "model name",
    "uncensored",
    "censorship",
  ];

  const lowerText = text.toLowerCase();
  const hasForbiddenTerm = forbiddenTerms.some((term) => lowerText.includes(term));

  if (!hasForbiddenTerm) {
    return text.trim();
  }

  // Split by sentences (periods, exclamation marks, question marks, newlines)
  const sentenceEnders = /[.!?\n]+/;
  const sentences = text.split(sentenceEnders).filter((s) => s.trim().length > 0);

  // Remove sentences containing forbidden terms
  const cleanedSentences = sentences.filter((sentence) => {
    const lowerSentence = sentence.toLowerCase();
    return !forbiddenTerms.some((term) => lowerSentence.includes(term));
  });

  // Join cleaned sentences back together
  const cleaned = cleanedSentences.join(". ").trim();

  // If nothing remains after cleaning, return fallback
  if (!cleaned || cleaned.length === 0) {
    return "How can I help?";
  }

  return cleaned;
}

export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  console.log("[api/chat] hit", new Date().toISOString());

  try {
  const session = getOrCreateSessionId(request);
  if ("error" in session) return session.error;
  const { id: sessionId, cookie } = session;

  // Anti-clone (même domaine uniquement)
  const originBlock = enforceSameOrigin(request);
  if (originBlock) return attachSessionCookie(originBlock, cookie);

  // Rate limit IP + session forte
  const rateLimitBlock = await applyRateLimit("chat", request, sessionId);
  if (rateLimitBlock) return attachSessionCookie(rateLimitBlock, cookie);
  const { X402_PAYMENT_HEADER_NAME } = await import("@/lib/x402/server");
  const xPayment = request.headers.get(X402_PAYMENT_HEADER_NAME);
  console.log("[api/chat] payment header: name=" + X402_PAYMENT_HEADER_NAME + ", present=" + Boolean(xPayment) + (xPayment ? ", length=" + xPayment.length : ""));

  const idempotencyKey = request.headers.get("Idempotency-Key");

  // Read body first (needed for x402 idem key and validation)
  let body: {
    message?: string;
    referenceImageUrl?: string | string[] | null;
    image_urls?: string[];
    video_urls?: string[];
    isTrailer?: boolean;
    trailerMode?: boolean;
    mode?: string;
    chatType?: string;
    endpoint?: string;
    prompt?: string;
    input?: string;
    content?: string;
    text?: string;
    trailerPrompt?: string;
    userPrompt?: string;
    messages?: unknown[];
    duration?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const userPrompt = getUserPrompt(body as Record<string, unknown>);
  const isTrailer = isTrailerRequest(userPrompt, body);

  if (!isTrailer && !message) {
    return NextResponse.json({ error: "Missing or empty message" }, { status: 400 });
  }
  if (isTrailer && !userPrompt) {
    return attachSessionCookie(
      NextResponse.json(
        {
          mode: "trailer" as const,
          error: "MISSING_PROMPT" as const,
          reply: "Please describe what you want in the trailer.",
        },
        { status: 400 }
      ),
      cookie
    );
  }

  // Idempotence client (Idempotency-Key header)
  const existing = getIdempotencyEntry(idempotencyKey);
  if (existing && existing.status === "executed" && existing.responseBody) {
    return attachSessionCookie(
      NextResponse.json(clientSafeBody(existing.responseBody as Record<string, unknown>), { status: 200 }),
      cookie
    );
  }

  // x402: exiger paiement avant d'exécuter le chat
  const guard = await enforceX402Payment(request, "POST /api/chat");
  if (!guard.ok) {
    if (guard.response.status === 500) {
      console.error("[api/chat] x402 guard returned 500");
    } else if (guard.response.status === 402) {
      console.log("[api/chat] x402 guard returned 402 (payment required)");
    }
    return attachSessionCookie(guard.response, cookie);
  }
  console.log("[api/chat] x402 guard ok, proceeding");
  if ("payer" in guard && guard.payer && "txHash" in guard && guard.txHash) {
    console.log("[api/chat] x402 txhash verified payer=" + guard.payer + " txHash=" + guard.txHash);
  }
  const paymentResponseHeader = guard.paymentResponseHeader;

  if (idempotencyKey) {
    setIdempotencyStatus(idempotencyKey, "paid");
  }

  // x402 idempotence: 1 payment = 1 execution (key = txHash + sha256(body))
  let x402IdemKeyValue: string | null = null;
  if ("txHash" in guard && typeof guard.txHash === "string") {
    x402IdemKeyValue = x402IdemKey(guard.txHash, body);
    const idemEntry = getX402Idem(x402IdemKeyValue);
    if (idemEntry?.status === "in_flight") {
      console.log("[api/chat] x402 idem in_flight, return 202");
      return attachSessionCookie(
        NextResponse.json({ status: "processing" }, { status: 202 }),
        cookie
      );
    }
    if (idemEntry?.status === "done") {
      const safeBody = clientSafeBody((idemEntry.responseBody ?? {}) as Record<string, unknown>);
      const res = NextResponse.json(safeBody, {
        status: idemEntry.responseStatus,
        headers: idemEntry.headersSubset,
      });
      return attachSessionCookie(res, cookie);
    }
    setX402IdemInFlight(x402IdemKeyValue);
  }

  // Normalize reference image: string, array, or image_urls / video_urls
  let referenceImageUrl = "";
  const rawRef = body?.referenceImageUrl;
  if (typeof rawRef === "string" && rawRef.trim()) {
    referenceImageUrl = rawRef.trim();
  } else if (Array.isArray(rawRef) && typeof rawRef[0] === "string" && (rawRef[0] as string).trim()) {
    referenceImageUrl = (rawRef[0] as string).trim();
  }
  const imageUrls = Array.isArray(body?.image_urls) ? body.image_urls : [];
  const videoUrls = Array.isArray(body?.video_urls) ? body.video_urls : [];
  const hasReferenceImage =
    !!referenceImageUrl ||
    imageUrls.some((u) => typeof u === "string" && u.trim()) ||
    videoUrls.some((u) => typeof u === "string" && u.trim());
  if (!referenceImageUrl && imageUrls.length > 0 && typeof imageUrls[0] === "string") {
    referenceImageUrl = (imageUrls[0] as string).trim();
  }
  if (!referenceImageUrl && videoUrls.length > 0 && typeof videoUrls[0] === "string") {
    referenceImageUrl = (videoUrls[0] as string).trim();
  }

  if (isTrailer) {
    if (!hasVideoCredentials()) {
      return attachSessionCookie(
        NextResponse.json(toClientError("CONFIG_ERROR"), { status: 500 }),
        cookie
      );
    }

    if (!hasReferenceImage) {
      const searchQuery = buildPexelsQueryFromPrompt(userPrompt);
      try {
        const refResult = await fetchReferenceImage(searchQuery);
        referenceImageUrl = refResult.imageUrl;
      } catch (e) {
        if (x402IdemKeyValue) clearX402Idem(x402IdemKeyValue);
        const err = e instanceof GatewayError ? toClientError(e.code) : toClientError("UPSTREAM_ERROR");
        return attachSessionCookie(
          NextResponse.json(
            { mode: "trailer" as const, ...err, reply: err.message },
            { status: 502 }
          ),
          cookie
        );
      }
    }

    try {
      const out = await generateVideo(userPrompt || message, referenceImageUrl, { duration: "10" });
      const responseBody = {
        mode: "trailer" as const,
        reply: out.reply,
        videoUrl: out.videoUrl,
      };
      if (idempotencyKey) setIdempotencyExecuted(idempotencyKey, responseBody);
      const headers: Record<string, string> = {};
      if (paymentResponseHeader) headers["PAYMENT-RESPONSE"] = paymentResponseHeader;
      if (x402IdemKeyValue) setX402IdemDone(x402IdemKeyValue, responseBody, 200, headers);
      return attachSessionCookie(NextResponse.json(responseBody, { status: 200, headers }), cookie);
    } catch (e) {
      if (x402IdemKeyValue) clearX402Idem(x402IdemKeyValue);
      const err = e instanceof GatewayError ? toClientError(e.code) : toClientError("UPSTREAM_ERROR");
      return NextResponse.json({ error: true, ...err }, { status: 200 });
    }
  }

  // --- Chat branch (messages SANS "trailer") ---
  if (!hasChatCredentials()) {
    const err = toClientError("CONFIG_ERROR");
    return NextResponse.json({ mode: "chat" as const, ...err, reply: err.message }, { status: 500 });
  }

  // Check for identity queries BEFORE calling provider
  if (isIdentityQuery(message)) {
    const responseBody = {
      mode: "chat" as const,
      reply:
        "I am Nexus AI—a unified orchestration brain turning one request into a complete outcome, planned, executed, and delivered end to end. Ask me for more details if you’d like. How can I assist you today?",
    };
    if (idempotencyKey) setIdempotencyExecuted(idempotencyKey, responseBody);
    const headers: Record<string, string> = {};
    if (paymentResponseHeader) {
      headers["PAYMENT-RESPONSE"] = paymentResponseHeader;
    }
    if (x402IdemKeyValue) setX402IdemDone(x402IdemKeyValue, responseBody, 200, headers);
    return NextResponse.json(responseBody, { status: 200, headers });
  }

  // Main chat: image intent → text-to-image
  const forceImageOnly = !isTrailer && body?.chatType === "image-only";
  if (forceImageOnly || isImageIntent(message)) {
    if (hasVideoCredentials()) {
      try {
        const out = await generateImage(message);
        const responseBody = {
          mode: "image" as const,
          imageUrl: out.imageUrl,
          reply: out.reply ?? "Here is your image.",
        };
        if (idempotencyKey) setIdempotencyExecuted(idempotencyKey, responseBody);
        const headers: Record<string, string> = {};
        if (paymentResponseHeader) headers["PAYMENT-RESPONSE"] = paymentResponseHeader;
        if (x402IdemKeyValue) setX402IdemDone(x402IdemKeyValue, responseBody, 200, headers);
        return attachSessionCookie(NextResponse.json(responseBody, { status: 200, headers }), cookie);
      } catch (e) {
        if (x402IdemKeyValue) clearX402Idem(x402IdemKeyValue);
        const err = e instanceof GatewayError ? toClientError(e.code) : toClientError("UPSTREAM_ERROR");
        return NextResponse.json({ error: true, ...err }, { status: 200 });
      }
    }
  }

  try {
    const out = await generateText(message);
    const sanitizedReply = sanitizeChatReply(out.reply);
    const responseBody = { mode: "chat" as const, reply: sanitizedReply };
    if (idempotencyKey) setIdempotencyExecuted(idempotencyKey, responseBody);
    const headers: Record<string, string> = {};
    if (paymentResponseHeader) headers["PAYMENT-RESPONSE"] = paymentResponseHeader;
    if (x402IdemKeyValue) setX402IdemDone(x402IdemKeyValue, responseBody, 200, headers);
    return attachSessionCookie(NextResponse.json(responseBody, { status: 200, headers }), cookie);
  } catch (e) {
    if (x402IdemKeyValue) clearX402Idem(x402IdemKeyValue);
    const err = e instanceof GatewayError ? toClientError(e.code) : toClientError("UPSTREAM_ERROR");
    return NextResponse.json({ error: true, ...err }, { status: 200 });
  }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[api/chat] unhandled error:", msg);
    const clientErr = toClientError("UPSTREAM_ERROR");
    return NextResponse.json({ error: true, ...clientErr }, { status: 500 });
  }
}
