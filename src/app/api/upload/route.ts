import { NextRequest, NextResponse } from "next/server";
import {
  applyRateLimit,
  enforceSameOrigin,
  getOrCreateSessionId,
  attachSessionCookie,
} from "@/lib/security";
import { uploadFile, toClientError, GatewayError, hasVideoCredentials } from "@/server/llm-gateway";

export async function POST(request: NextRequest) {
  const session = getOrCreateSessionId(request);
  if ("error" in session) return session.error;
  const { id: sessionId, cookie } = session;

  const originBlock = enforceSameOrigin(request);
  if (originBlock) return attachSessionCookie(originBlock, cookie);

  const rateLimitBlock = await applyRateLimit("upload", request, sessionId);
  if (rateLimitBlock) return attachSessionCookie(rateLimitBlock, cookie);

  if (!hasVideoCredentials()) {
    return attachSessionCookie(
      NextResponse.json(toClientError("CONFIG_ERROR"), { status: 500 }),
      cookie
    );
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return attachSessionCookie(
      NextResponse.json(
        { error: "Invalid content type. Expected multipart/form-data." },
        { status: 400 }
      ),
      cookie
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return attachSessionCookie(
      NextResponse.json(
        { error: "Missing file field in upload payload." },
        { status: 400 }
      ),
      cookie
    );
  }

  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return attachSessionCookie(
      NextResponse.json(
        { error: "Unsupported file type. Please upload a JPG, PNG, or WEBP image." },
        { status: 400 }
      ),
      cookie
    );
  }

  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return attachSessionCookie(
      NextResponse.json(
        { error: "File is too large. Maximum size is 10MB." },
        { status: 400 }
      ),
      cookie
    );
  }

  try {
    const out = await uploadFile(file);
    return attachSessionCookie(NextResponse.json({ url: out.url }), cookie);
  } catch (e) {
    const err = e instanceof GatewayError ? toClientError(e.code) : toClientError("UPSTREAM_ERROR");
    return attachSessionCookie(
      NextResponse.json(err, { status: 500 }),
      cookie
    );
  }
}

