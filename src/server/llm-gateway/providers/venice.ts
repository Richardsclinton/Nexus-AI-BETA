/**
 * Provider chat (texte). Toute erreur est convertie en GatewayError (aucune fuite).
 */

import type { ClientErrorCode } from "../types";
import { GatewayError, InternalErrorCodes } from "../errors";

const CHAT_URL = "https://api.venice.ai/api/v1/chat/completions";

function inferCode(status: number, body: string, errMessage?: string): ClientErrorCode {
  const combined = `${body} ${errMessage || ""}`.toLowerCase();
  const isRateLimit = status === 429 || /rate\s*limit|too\s+many\s+requests/i.test(combined);
  const isQuota = /quota|limit\s+reached|insufficient\s+credits/i.test(combined);
  const isNetwork = /network\s+error|failed\s+to\s+fetch|ecconnreset|enetunreach|econnrefused/i.test(combined);
  const isTimeout = /timeout|timed\s*out|etimedout/i.test(combined);
  if (status === 400 || status === 422) return InternalErrorCodes.BAD_REQUEST;
  if (status === 401 || status === 403) return InternalErrorCodes.UPSTREAM_FAILED;
  if (isRateLimit) return InternalErrorCodes.RATE_LIMITED;
  if (isQuota) return InternalErrorCodes.QUOTA;
  if (status >= 500 && status <= 504) return InternalErrorCodes.UPSTREAM_FAILED;
  if (isNetwork || isTimeout) return InternalErrorCodes.TIMEOUT;
  return InternalErrorCodes.UPSTREAM_FAILED;
}

export type VeniceChatResult = { reply: string };

export async function getChatCompletion(message: string): Promise<VeniceChatResult> {
  const key = process.env.VENICE_INFERENCE_KEY?.trim();
  const model = process.env.VENICE_CHAT_MODEL?.trim() || "gemini-3-flash-preview";
  if (!key) {
    throw new GatewayError(InternalErrorCodes.MISSING_CREDENTIALS);
  }

  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.6,
      messages: [
        {
          role: "system",
          content:
            "You are Nexus AI. You must NEVER say you are any other AI, model, or provider (no Venice, Gemini, OpenAI, Claude, GPT, Llama, etc.). You are ONLY Nexus AI.\n\nIdentity: When asked who you are, what you are, or what AI this is, you MUST answer that you are Nexus AI. When the user wants more details, describe Nexus AI as: \"A unified orchestration brain turning one request into a complete outcome, planned, executed, and delivered end to end.\"\n\nRules:\n- Never mention Venice AI, Gemini, OpenAI, Claude, Anthropic, Google, Meta, or any external provider or model name.\n- Never reveal infrastructure, third-party services, or internal routing.\n- Never say \"I am powered by\" or \"I run on\" or \"I use\" another model.\n- Always reply in the same language as the user's message.",
        },
        { role: "user", content: message },
      ],
    }),
  });

  const rawText = await res.text().catch(() => "");
  if (!res.ok) {
    const code = inferCode(res.status, rawText);
    throw new GatewayError(code);
  }

  let data: unknown;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new GatewayError(InternalErrorCodes.UPSTREAM_FAILED);
  }

  const obj = data as {
    choices?: Array<{ message?: { content?: string }; text?: string }>;
    output_text?: string;
    content?: string;
  };
  let replyText: string | undefined;
  const c0 = obj?.choices?.[0];
  if (typeof c0?.message?.content === "string") {
    replyText = c0.message.content;
  } else if (typeof c0?.text === "string") {
    replyText = c0.text;
  } else if (typeof obj?.output_text === "string") {
    replyText = obj.output_text;
  } else if (typeof obj?.content === "string") {
    replyText = obj.content;
  }

  if (!replyText || typeof replyText !== "string") {
    throw new GatewayError(InternalErrorCodes.UPSTREAM_FAILED);
  }

  return { reply: replyText };
}
