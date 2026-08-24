import { NextResponse } from "next/server";
import { sfConfigError, sfErrorResponse } from "@/lib/sf/api-utils";
import { describeSObject } from "@/lib/sf/rest";
import { parseSlot, readSession } from "@/lib/sf/session";

export async function GET(req: Request) {
  const configErr = sfConfigError();
  if (configErr) return configErr;

  const url = new URL(req.url);
  const slot = parseSlot(url.searchParams.get("slot"));
  const name = url.searchParams.get("name")?.trim();
  if (!slot) {
    return NextResponse.json({ error: "Invalid slot" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "Missing object name" }, { status: 400 });
  }

  const session = await readSession(slot);
  if (!session) {
    return NextResponse.json({ error: "Not connected" }, { status: 401 });
  }

  try {
    const describe = await describeSObject(session, name);
    return NextResponse.json({ describe });
  } catch (err) {
    return sfErrorResponse(err, "Failed to describe object");
  }
}
