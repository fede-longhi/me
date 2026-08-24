import { NextResponse } from "next/server";
import { isSessionCryptoConfigured } from "@/lib/sf/crypto";

export function sfConfigError(): NextResponse | null {
  if (!isSessionCryptoConfigured()) {
    return NextResponse.json(
      { error: "SF_SESSION_ENCRYPT_KEY is not configured on the server." },
      { status: 503 },
    );
  }
  return null;
}

export function sfErrorResponse(err: unknown, fallback = "Request failed") {
  const message = err instanceof Error ? err.message : fallback;
  const status =
    message.includes("Session expired") || message.includes("reconnect")
      ? 401
      : message.includes("Login") || message.includes("Token validation")
        ? 400
        : 500;
  return NextResponse.json({ error: message }, { status });
}
