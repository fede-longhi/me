import { NextResponse } from "next/server";
import { listBeastPathArt } from "@/lib/roguelike/content/art";
import { isBeastPathDev } from "@/lib/roguelike/content/dev";

export async function GET() {
  if (!isBeastPathDev()) {
    return NextResponse.json({ images: [] }, { status: 404 });
  }

  const images = await listBeastPathArt();
  return NextResponse.json({ images });
}
