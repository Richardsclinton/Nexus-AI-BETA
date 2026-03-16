/**
 * Types pour la couche LLM Gateway.
 * Aucun nom de provider ni de variable d'env ne doit apparaître dans les types exposés au client.
 */

export type ClientErrorCode =
  | "CONFIG_ERROR"
  | "UPSTREAM_ERROR"
  | "RATE_LIMIT"
  | "INVALID_REQUEST"
  | "PAYMENT_REQUIRED"
  | "TIMEOUT"
  | "QUOTA"
  | "CONTENT_POLICY"
  | "NOT_FOUND";

export type NormalizedClientError = {
  ok: false;
  code: ClientErrorCode;
  message: string;
};

export type GenerateTextResult = { ok: true; reply: string };
export type GenerateImageResult = { ok: true; imageUrl: string; reply?: string };
export type GenerateVideoResult = { ok: true; videoUrl: string; reply: string };
export type UploadFileResult = { ok: true; url: string };
export type ReferenceImageResult = { ok: true; imageUrl: string };

export type GatewayResult<T> = T | NormalizedClientError;
