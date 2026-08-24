import { NextResponse } from "next/server";
import { sfConfigError, sfErrorResponse } from "@/lib/sf/api-utils";
import { runSoql } from "@/lib/sf/rest";
import { parseSlot, readSession } from "@/lib/sf/session";

export async function POST(req: Request) {
  const configErr = sfConfigError();
  if (configErr) return configErr;

  let body: { slot?: string; soql?: string };
  try {
    body = (await req.json()) as { slot?: string; soql?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slot = parseSlot(body.slot);
  const soql = body.soql?.trim();
  if (!slot) {
    return NextResponse.json({ error: "Invalid slot" }, { status: 400 });
  }
  if (!soql) {
    return NextResponse.json({ error: "SOQL is required" }, { status: 400 });
  }

  const session = await readSession(slot);
  if (!session) {
    return NextResponse.json({ error: "Not connected" }, { status: 401 });
  }

  try {
    const result = await runSoql(session, soql);
    return NextResponse.json(result);
  } catch (err) {
    return sfErrorResponse(err, "Query failed");
  }
}
