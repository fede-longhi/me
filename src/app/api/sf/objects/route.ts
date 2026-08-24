import { NextResponse } from "next/server";
import { sfConfigError, sfErrorResponse } from "@/lib/sf/api-utils";
import { listSObjects } from "@/lib/sf/rest";
import { parseSlot, readSession } from "@/lib/sf/session";

export async function GET(req: Request) {
  const configErr = sfConfigError();
  if (configErr) return configErr;

  const slot = parseSlot(new URL(req.url).searchParams.get("slot"));
  if (!slot) {
    return NextResponse.json({ error: "Invalid slot" }, { status: 400 });
  }

  const session = await readSession(slot);
  if (!session) {
    return NextResponse.json({ error: "Not connected" }, { status: 401 });
  }

  try {
    const objects = await listSObjects(session);
    return NextResponse.json({ objects });
  } catch (err) {
    return sfErrorResponse(err, "Failed to list objects");
  }
}
