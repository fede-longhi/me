import { NextResponse } from "next/server";
import {
  authorizePublish,
  publishPackToBlob,
  readPackFromBlob,
} from "@/lib/roguelike/content/blobStore";
import {
  CONTENT_OVERRIDES_VERSION,
  hasOverrideData,
  type ContentOverrides,
} from "@/lib/roguelike/content/overrides";

export async function GET() {
  const pack = await readPackFromBlob();
  if (!pack || !hasOverrideData(pack)) {
    return NextResponse.json({ error: "No published content" }, { status: 404 });
  }
  return NextResponse.json(pack, {
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}

export async function POST(req: Request) {
  if (!authorizePublish(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let pack: ContentOverrides;
  try {
    pack = (await req.json()) as ContentOverrides;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!pack || typeof pack !== "object") {
    return NextResponse.json({ error: "Invalid pack" }, { status: 400 });
  }
  pack = { ...pack, version: CONTENT_OVERRIDES_VERSION };
  if (!hasOverrideData(pack)) {
    return NextResponse.json({ error: "Empty content pack" }, { status: 400 });
  }
  try {
    const meta = await publishPackToBlob(pack);
    return NextResponse.json({ ok: true, meta });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Publish failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
