import { NextResponse } from "next/server";
import { readMetaFromBlob } from "@/lib/roguelike/content/blobStore";

export async function GET() {
  const meta = await readMetaFromBlob();
  if (!meta) {
    return NextResponse.json({ error: "No published content" }, { status: 404 });
  }
  return NextResponse.json(meta, {
    headers: {
      "Cache-Control": "public, max-age=30, stale-while-revalidate=120",
    },
  });
}
