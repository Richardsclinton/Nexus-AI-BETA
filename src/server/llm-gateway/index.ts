/**
 * LLM Gateway : API unique côté serveur. Les routes n'importent jamais directement un provider.
 * Toutes les erreurs sont normalisées (aucune fuite de nom de provider ou de variable d'env).
 */

import type {
  GenerateTextResult,
  GenerateImageResult,
  GenerateVideoResult,
  UploadFileResult,
  ReferenceImageResult,
  NormalizedClientError,
} from "./types";
import { GatewayError, toClientError } from "./errors";
import * as Venice from "./providers/venice";
import * as FalVideo from "./providers/fal-video";
import * as FalImage from "./providers/fal-image";
import * as FalStorage from "./providers/fal-storage";
import * as ReferenceImage from "./providers/reference-image";

export type { NormalizedClientError, ClientErrorCode } from "./types";
export { toClientError, GatewayError } from "./errors";
export { redact, redactString } from "./redact";

export async function generateText(message: string): Promise<GenerateTextResult> {
  const out = await Venice.getChatCompletion(message);
  return { ok: true, reply: out.reply };
}

export async function generateImage(prompt: string): Promise<GenerateImageResult> {
  const out = await FalImage.generateImage(prompt);
  return { ok: true, imageUrl: out.imageUrl, reply: "Here is your image." };
}

export async function generateVideo(
  prompt: string,
  referenceImageUrl: string,
  options?: { duration?: string }
): Promise<GenerateVideoResult> {
  const out = await FalVideo.generateVideo(prompt, referenceImageUrl, options);
  return { ok: true, videoUrl: out.videoUrl, reply: "Video generated successfully." };
}

export async function uploadFile(file: File): Promise<UploadFileResult> {
  const out = await FalStorage.uploadFile(file);
  return { ok: true, url: out.url };
}

export async function fetchReferenceImage(query: string): Promise<ReferenceImageResult> {
  const out = await ReferenceImage.fetchReferenceImage(query);
  return { ok: true, imageUrl: out.imageUrl };
}

/**
 * Vérifie si les credentials sont présentes (sans révéler lesquelles).
 */
export function hasVideoCredentials(): boolean {
  return !!process.env.FAL_KEY?.trim();
}

export function hasChatCredentials(): boolean {
  return !!process.env.VENICE_INFERENCE_KEY?.trim();
}

export function hasReferenceImageCredentials(): boolean {
  return !!process.env.PEXELS_API_KEY?.trim();
}

/**
 * Exécute une opération gateway et retourne soit le résultat soit une erreur client normalisée.
 */
export async function run<T>(
  fn: () => Promise<T>
): Promise<{ ok: true; data: T } | { ok: false; error: NormalizedClientError }> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (e) {
    if (e instanceof GatewayError) {
      return { ok: false, error: toClientError(e.code) };
    }
    return { ok: false, error: toClientError("UPSTREAM_ERROR") };
  }
}
