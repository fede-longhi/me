import { readdir } from "node:fs/promises";
import path from "node:path";

export const BEAST_PATH_ART_ROOT = "beast-path";

export type BeastPathArtFile = {
  src: string;
  name: string;
  folder: string;
};

const IMAGE_EXT = new Set([
  ".png",
  ".webp",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".avif",
]);

function publicArtDir() {
  return path.join(process.cwd(), "public", BEAST_PATH_ART_ROOT);
}

async function walkImages(
  dir: string,
  relative: string,
  out: BeastPathArtFile[],
) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of sorted) {
    if (entry.name.startsWith(".")) continue;
    const nextRel = relative ? `${relative}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkImages(full, nextRel, out);
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!IMAGE_EXT.has(ext)) continue;
    const folder = relative || ".";
    out.push({
      src: `/${BEAST_PATH_ART_ROOT}/${nextRel.replace(/\\/g, "/")}`,
      name: entry.name,
      folder,
    });
  }
}

/** Recursively list images under public/beast-path. */
export async function listBeastPathArt(): Promise<BeastPathArtFile[]> {
  const files: BeastPathArtFile[] = [];
  await walkImages(publicArtDir(), "", files);
  return files;
}
