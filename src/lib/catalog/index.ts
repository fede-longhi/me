import { cache } from "react";
import { get, put } from "@vercel/blob";
import { unstable_cache } from "next/cache";
import rawData from "../../../data.json";
import { normalizeCatalog } from "@/lib/catalog/normalize";
import { localizedDataSchema } from "@/lib/catalog/schema";
import {
  isPublished,
  type LocalizedData,
  type SiteData,
} from "@/lib/types";

export const CATALOG_BLOB_PATH = "site/catalog.json";

const PUT_OPTS = {
  access: "public" as const,
  addRandomSuffix: false,
  allowOverwrite: true,
  contentType: "application/json",
  cacheControlMaxAge: 60,
};

function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function seedCatalog(): LocalizedData {
  return normalizeCatalog(rawData as LocalizedData);
}

function parseCatalog(value: unknown): LocalizedData {
  const parsed = localizedDataSchema.safeParse(
    normalizeCatalog(value as LocalizedData),
  );
  if (!parsed.success) {
    throw new Error("Invalid site catalog");
  }
  return parsed.data as LocalizedData;
}

async function readCatalogFromBlob(): Promise<LocalizedData | null> {
  if (!blobConfigured()) return null;
  try {
    const result = await get(CATALOG_BLOB_PATH, {
      access: "public",
      useCache: false,
    });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const text = await new Response(result.stream).text();
    return parseCatalog(JSON.parse(text));
  } catch {
    return null;
  }
}

const loadCachedCatalog = unstable_cache(
  async () => {
    const fromBlob = await readCatalogFromBlob();
    return fromBlob ?? seedCatalog();
  },
  ["site-catalog"],
  { tags: ["site-catalog"], revalidate: 60 },
);

export const getSiteCatalog = cache(loadCachedCatalog);

export function getSeedCatalog(): LocalizedData {
  return seedCatalog();
}

export async function saveSiteCatalog(
  catalog: LocalizedData,
): Promise<LocalizedData> {
  if (!blobConfigured()) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not configured");
  }
  const normalized = parseCatalog(catalog);
  const body = JSON.stringify(normalized);
  await put(CATALOG_BLOB_PATH, body, PUT_OPTS);
  return normalized;
}

export function toPublicCatalog(catalog: LocalizedData): LocalizedData {
  const next = structuredClone(catalog);
  for (const locale of ["en", "es"] as const) {
    next[locale] = filterPublicLocale(next[locale]);
  }
  return next;
}

function filterPublicLocale(data: SiteData): SiteData {
  const toolsEnabled = data.flags.tools;
  const gamesEnabled = data.flags.games;
  const tools = toolsEnabled ? data.tools.filter(isPublished) : [];
  const games = gamesEnabled ? data.games.filter(isPublished) : [];
  const projects = data.projects.filter(isPublished);

  return {
    ...data,
    tools,
    games,
    projects,
    ui: {
      ...data.ui,
      nav: data.ui.nav.filter((link) => {
        if (link.href === "/tools" || link.href.startsWith("/tools")) {
          return toolsEnabled;
        }
        if (link.href === "/games" || link.href.startsWith("/games")) {
          return gamesEnabled;
        }
        return true;
      }),
    },
  };
}

export async function getPublicCatalog(): Promise<LocalizedData> {
  return toPublicCatalog(await getSiteCatalog());
}
