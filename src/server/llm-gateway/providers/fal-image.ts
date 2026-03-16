/**
 * Provider image (text-to-image). Toute erreur est convertie en GatewayError (aucune fuite).
 */

import { fal } from "@fal-ai/client";
import type { ClientErrorCode } from "../types";
import { GatewayError, InternalErrorCodes } from "../errors";

const FAL_IMAGE_APP_ID = "fal-ai/kling-image/v3/text-to-image";

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

export type FalImageResult = { imageUrl: string };

export async function generateImage(prompt: string): Promise<FalImageResult> {
  const key = process.env.FAL_KEY?.trim();
  if (!key) {
    throw new GatewayError(InternalErrorCodes.MISSING_CREDENTIALS);
  }

  fal.config({ credentials: key });
  const result = await fal.subscribe(FAL_IMAGE_APP_ID, {
    input: {
      prompt: prompt.slice(0, 2500),
      aspect_ratio: "1:1",
      resolution: "1K",
    },
  });

  const data = (result as { data?: { images?: Array<{ url?: string }> } })?.data;
  const imageUrl = data?.images?.[0]?.url;
  if (imageUrl && typeof imageUrl === "string") {
    return { imageUrl };
  }

  const err = (result as { error?: string | { message?: string } })?.error;
  const errMessage =
    (typeof err === "string" && err) ||
    (err && typeof (err as { message?: string }).message === "string" && (err as { message: string }).message) ||
    "";
  throw new GatewayError(inferCode((result as { status?: number })?.status, errMessage));
}
