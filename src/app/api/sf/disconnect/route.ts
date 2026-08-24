import { NextResponse } from "next/server";
import { sfConfigError } from "@/lib/sf/api-utils";
import { clearSession, parseSlot } from "@/lib/sf/session";

export async function POST(req: Request) {
  const configErr = sfConfigError();
  if (configErr) return configErr;

  let body: { slot?: string };
  try {
    body = (await req.json()) as { slot?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slot = parseSlot(body.slot);
  if (!slot) {
    return NextResponse.json({ error: "Invalid slot" }, { status: 400 });
  }

  await clearSession(slot);
  return NextResponse.json({ ok: true });
}
