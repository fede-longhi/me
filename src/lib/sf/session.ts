import { cookies } from "next/headers";
import { decryptPayload, encryptPayload } from "@/lib/sf/crypto";
import {
  SF_COOKIE_NAMES,
  SF_SESSION_MAX_AGE_SEC,
  type SfOrgSummary,
  type SfSessionPayload,
  type SfSlot,
} from "@/lib/sf/types";

export function toOrgSummary(
  slot: SfSlot,
  session: SfSessionPayload,
): SfOrgSummary {
  return {
    slot,
    instanceUrl: session.instanceUrl,
    username: session.username,
    userId: session.userId,
    orgId: session.orgId,
    loginHost: session.loginHost,
    connectedAt: session.connectedAt,
  };
}

export async function readSession(slot: SfSlot): Promise<SfSessionPayload | null> {
  const jar = await cookies();
  const raw = jar.get(SF_COOKIE_NAMES[slot])?.value;
  if (!raw) return null;
  try {
    const json = decryptPayload(raw);
    return JSON.parse(json) as SfSessionPayload;
  } catch {
    return null;
  }
}

export async function writeSession(
  slot: SfSlot,
  session: SfSessionPayload,
): Promise<void> {
  const jar = await cookies();
  const value = encryptPayload(JSON.stringify(session));
  jar.set(SF_COOKIE_NAMES[slot], value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SF_SESSION_MAX_AGE_SEC,
  });
}

export async function clearSession(slot: SfSlot): Promise<void> {
  const jar = await cookies();
  jar.delete(SF_COOKIE_NAMES[slot]);
}

export async function readAllSessions(): Promise<SfOrgSummary[]> {
  const slots: SfSlot[] = ["source", "target"];
  const summaries: SfOrgSummary[] = [];
  for (const slot of slots) {
    const session = await readSession(slot);
    if (session) summaries.push(toOrgSummary(slot, session));
  }
  return summaries;
}

export function parseSlot(value: unknown): SfSlot | null {
  return value === "source" || value === "target" ? value : null;
}
