/**
 * Provider vidéo (trailer). Toute erreur est convertie en GatewayError (aucune fuite).
 */

import { fal } from "@fal-ai/client";
import type { ClientErrorCode } from "../types";
import { GatewayError, InternalErrorCodes } from "../errors";

function inferCode(status: number | undefined, message: string): ClientErrorCode {
  const combined = (message || "").toLowerCase();
  const isPolicy = /safety|inappropriate|nsfw|blocked|refused|content\s*policy|policy\s*violation|violates|adult|explicit|sensitive/i.test(combined);
  const isRateLimit = status === 429 || /rate\s*limit|too\s+many\s+requests/i.test(combined);
  const isNetwork = /network\s+error|failed\s+to\s+fetch|ecconnreset|enetunreach|econnrefused/i.test(combined);
  const isTimeout = /timeout|timed\s*out|etimedout/i.test(combined);
  if (status === 400 || status === 422) return InternalErrorCodes.BAD_REQUEST;
  if (isPolicy) return InternalErrorCodes.CONTENT_POLICY;
  if (isRateLimit) return InternalErrorCodes.RATE_LIMITED;
  if (status != null && status >= 500) return InternalErrorCodes.UPSTREAM_FAILED;
  if (isNetwork || isTimeout) return InternalErrorCodes.TIMEOUT;
  return InternalErrorCodes.UPSTREAM_FAILED;
}

export type FalVideoResult = { videoUrl: string };

export async function generateVideo(
  prompt: string,
  referenceImageUrl: string,
  options?: { duration?: string }
): Promise<FalVideoResult> {
  const key = process.env.FAL_KEY?.trim();
  const appId = process.env.FAL_APP_ID?.trim() || "wan/v2.6/reference-to-video/flash";
  if (!key) {
    throw new GatewayError(InternalErrorCodes.MISSING_CREDENTIALS);
  }

  fal.config({ credentials: key });
  const duration = options?.duration ?? "10";

  const result: unknown = await fal.subscribe(appId, {
    input: {
      prompt: prompt || "",
      aspect_ratio: "16:9",
      resolution: "720p",
      duration,
      image_urls: [referenceImageUrl],
      enable_prompt_expansion: true,
      multi_shots: true,
      enable_audio: false,
      enable_safety_checker: true,
    },
    logs: true,
  });

  const data = (result as { data?: Record<string, unknown>; status?: string; error?: unknown })?.data ?? {};
  const status = (result as { status?: number })?.status;
  const err = (result as { error?: string | { message?: string } })?.error;
  const errMessage =
    (typeof err === "string" && err) ||
    (err && typeof (err as { message?: string }).message === "string" && (err as { message: string }).message) ||
    (data?.error as string) ||
    "";

  const videoUrl: string | undefined =
    (data?.video as { url?: string })?.url ||
    (typeof (result as { video?: { url?: string } })?.video?.url === "string"
      ? (result as { video: { url: string } }).video.url
      : undefined);

  const failed =
    (result as { status?: string })?.status === "failed" ||
    (result as { status?: string })?.status === "error" ||
    !!err ||
    !!(data as { error?: unknown }).error;

  if (!videoUrl || failed) {
    throw new GatewayError(inferCode(status, errMessage));
  }

  return { videoUrl };
}
