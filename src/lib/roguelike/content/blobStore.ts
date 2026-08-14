import { createHash } from "crypto";
import { get, put } from "@vercel/blob";
import {
  CONTENT_OVERRIDES_VERSION,
  type ContentOverrides,
} from "./overrides";

export const PACK_PATHNAME = "beast-path/content-pack.json";
export const META_PATHNAME = "beast-path/content-meta.json";

export type ContentMeta = {
  hash: string;
  updatedAt: string;
  size: number;
};

/** Stable JSON body used for hashing and Blob storage. */
export function canonicalizePack(pack: ContentOverrides): string {
  return JSON.stringify({
    ...pack,
    version: CONTENT_OVERRIDES_VERSION,
  });
}

export function hashContentBody(body: string): string {
  return createHash("sha256").update(body, "utf8").digest("hex");
}

function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function readPackFromBlob(): Promise<ContentOverrides | null> {
  if (!blobConfigured()) return null;
  try {
    const result = await get(PACK_PATHNAME, {
      access: "public",
      useCache: false,
    });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const text = await new Response(result.stream).text();
    const parsed = JSON.parse(text) as ContentOverrides;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      ...parsed,
      version: CONTENT_OVERRIDES_VERSION,
    };
  } catch {
    return null;
  }
}

export async function readMetaFromBlob(): Promise<ContentMeta | null> {
  if (!blobConfigured()) return null;
  try {
    const result = await get(META_PATHNAME, {
      access: "public",
      useCache: false,
    });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const text = await new Response(result.stream).text();
    const parsed = JSON.parse(text) as ContentMeta;
    if (!parsed?.hash || typeof parsed.hash !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function publishPackToBlob(
  pack: ContentOverrides,
): Promise<ContentMeta> {
  if (!blobConfigured()) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not configured");
  }
  const body = canonicalizePack(pack);
  const hash = hashContentBody(body);
  const meta: ContentMeta = {
    hash,
    updatedAt: new Date().toISOString(),
    size: Buffer.byteLength(body, "utf8"),
  };
  const putOpts = {
    access: "public" as const,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  };
  await put(PACK_PATHNAME, body, putOpts);
  await put(META_PATHNAME, JSON.stringify(meta), putOpts);
  return meta;
}

export function authorizePublish(req: Request): boolean {
  const secret = process.env.BEAST_PATH_CONTENT_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}
