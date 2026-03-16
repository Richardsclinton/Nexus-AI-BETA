/**
 * Provider upload (stockage). Toute erreur est convertie en GatewayError (aucune fuite).
 */

import { fal } from "@fal-ai/client";
import { GatewayError, InternalErrorCodes } from "../errors";

export type FalStorageResult = { url: string };

export async function uploadFile(file: File): Promise<FalStorageResult> {
  const key = process.env.FAL_KEY?.trim();
  if (!key) {
    throw new GatewayError(InternalErrorCodes.MISSING_CREDENTIALS);
  }

  fal.config({ credentials: key });
  const result = await fal.storage.upload(file);
  const anyResult = result as string | { url?: string } | { data?: { url?: string } };
  let url = "";
  if (typeof anyResult === "string") {
    url = anyResult;
  } else if (anyResult && typeof (anyResult as { url?: string }).url === "string") {
    url = (anyResult as { url: string }).url;
  } else if (anyResult && typeof (anyResult as { data?: { url?: string } }).data?.url === "string") {
    url = (anyResult as { data: { url: string } }).data.url;
  }

  if (!url) {
    throw new GatewayError(InternalErrorCodes.UPSTREAM_FAILED);
  }
  return { url };
}
