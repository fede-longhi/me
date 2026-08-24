import { NextResponse } from "next/server";
import { sfConfigError } from "@/lib/sf/api-utils";
import { readAllSessions } from "@/lib/sf/session";

export async function GET() {
  const configErr = sfConfigError();
  if (configErr) return configErr;

  const orgs = await readAllSessions();
  return NextResponse.json({ orgs });
}
