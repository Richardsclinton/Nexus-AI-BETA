/**
 * Provider image de référence (recherche). Ne renvoie jamais de nom de provider ni "Missing PEXELS_API_KEY".
 */

import { GatewayError, InternalErrorCodes } from "../errors";

const PEXELS_SEARCH_URL = "https://api.pexels.com/v1/search";

type PexelsPhoto = {
  width?: number;
  height?: number;
  src?: { original?: string; large?: string; large2x?: string };
  url?: string;
};

function pickBestPhoto(photos: PexelsPhoto[]): PexelsPhoto | null {
  if (!Array.isArray(photos) || photos.length === 0) return null;
  let best: PexelsPhoto | null = null;
  let bestScore = -1;
  for (const p of photos) {
    const w = typeof p.width === "number" ? p.width : 0;
    const h = typeof p.height === "number" ? p.height : 0;
    const area = w * h;
    const isLandscape = w >= h ? 1 : 0;
    const score = isLandscape * 1e10 + area;
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best ?? photos[0] ?? null;
}

function getImageUrl(photo: PexelsPhoto): string | null {
  const src = photo?.src;
  if (src?.large && /^https?:\/\//i.test(src.large)) return src.large;
  if (src?.large2x && /^https?:\/\//i.test(src.large2x)) return src.large2x;
  if (src?.original && /^https?:\/\//i.test(src.original)) return src.original;
  if (typeof photo?.url === "string" && /^https?:\/\//i.test(photo.url)) return photo.url;
  return null;
}

export type ReferenceImageResult = { imageUrl: string };

export async function fetchReferenceImage(query: string): Promise<ReferenceImageResult> {
  const apiKey = process.env.PEXELS_API_KEY?.trim();
  if (!apiKey) {
    throw new GatewayError(InternalErrorCodes.MISSING_CREDENTIALS);
  }

  const q = typeof query === "string" ? query.trim() : "";
  if (!q) {
    throw new GatewayError(InternalErrorCodes.BAD_REQUEST);
  }

  const params = new URLSearchParams({
    query: q,
    per_page: "8",
    orientation: "landscape",
  });
  const url = `${PEXELS_SEARCH_URL}?${params.toString()}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: apiKey },
    });

    if (!res.ok) {
      throw new GatewayError(InternalErrorCodes.UPSTREAM_FAILED);
    }

    const data = (await res.json()) as { photos?: PexelsPhoto[] };
    const photos = data?.photos;
    if (!Array.isArray(photos) || photos.length === 0) {
      throw new GatewayError(InternalErrorCodes.NOT_FOUND);
    }

    const chosen = pickBestPhoto(photos);
    const imageUrl = chosen ? getImageUrl(chosen) : null;
    if (!imageUrl) {
      throw new GatewayError(InternalErrorCodes.UPSTREAM_FAILED);
    }

    return { imageUrl };
  } catch (e) {
    if (e instanceof GatewayError) throw e;
    throw new GatewayError(InternalErrorCodes.UPSTREAM_FAILED);
  }
}
