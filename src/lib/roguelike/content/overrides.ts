import type { HabitatId, RegionDef } from "../types";
import type { EventDef } from "./events/_types";
import type { ItemDef } from "./items";
import type { RelicDef } from "./relics";
import type { MoveDef, Species } from "../types";

export const CONTENT_OVERRIDES_KEY = "beast-path-content-overrides";
export const CONTENT_PUBLISHED_CACHE_KEY = "beast-path-content-cache";
export const CONTENT_OVERRIDES_VERSION = 2 as const;

export type RewardTuning = {
  /** Extra gold mult per path level above 1 (default 0.15). */
  runLevelGoldStep: number;
  captureBase: number;
  captureHpScale: number;
  captureCap: number;
  xpGoldBase: number;
  xpGoldDivisor: number;
  xpFloor: number;
  xpCurveBase: number;
  xpCurvePerLevel: number;
};

export const DEFAULT_REWARD_TUNING: RewardTuning = {
  runLevelGoldStep: 0.15,
  captureBase: 0.5,
  captureHpScale: 0.4,
  captureCap: 0.95,
  xpGoldBase: 10,
  xpGoldDivisor: 4,
  xpFloor: 4,
  xpCurveBase: 12,
  xpCurvePerLevel: 8,
};

export type ContentLabelsSlice = {
  species?: Record<string, string>;
  regions?: Record<string, string>;
  moves?: Record<string, { name: string; description: string }>;
  events?: Record<
    string,
    { title: string; body: string; choices: Record<string, string> }
  >;
  items?: Record<string, { name: string; description: string }>;
  relics?: Record<string, { name: string; description: string }>;
};

export type ContentPools = {
  starters?: string[];
  wild?: string[];
  early?: string[];
  habitats?: Partial<Record<HabitatId, string[]>>;
};

/** Author / shipped content pack. v2 is a full snapshot suitable for prod. */
export type ContentOverrides = {
  version: 1 | typeof CONTENT_OVERRIDES_VERSION;
  updatedAt?: string;
  species?: Record<string, Partial<Species>>;
  moves?: Record<string, Partial<MoveDef>>;
  items?: Record<string, ItemDef>;
  relics?: Record<string, RelicDef>;
  events?: EventDef[];
  regions?: Record<string, RegionDef>;
  rewards?: Partial<RewardTuning>;
  pools?: ContentPools;
  labels?: {
    en?: ContentLabelsSlice;
    es?: ContentLabelsSlice;
  };
};

export function emptyOverrides(): ContentOverrides {
  return { version: CONTENT_OVERRIDES_VERSION };
}

function isSupportedVersion(version: unknown): version is 1 | 2 {
  return version === 1 || version === 2;
}

export function readStoredOverrides(): ContentOverrides | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONTENT_OVERRIDES_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ContentOverrides;
    if (!parsed || !isSupportedVersion(parsed.version)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeStoredOverrides(pack: ContentOverrides): void {
  if (typeof window === "undefined") return;
  const next: ContentOverrides = {
    ...pack,
    version: CONTENT_OVERRIDES_VERSION,
    updatedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(CONTENT_OVERRIDES_KEY, JSON.stringify(next));
}

export function clearStoredOverrides(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CONTENT_OVERRIDES_KEY);
}

export type PublishedContentCache = {
  hash: string;
  pack: ContentOverrides;
  fetchedAt: string;
};

export function readPublishedCache(): PublishedContentCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONTENT_PUBLISHED_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PublishedContentCache;
    if (
      !parsed?.hash ||
      !parsed.pack ||
      !isSupportedVersion(parsed.pack.version)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writePublishedCache(cache: PublishedContentCache): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    CONTENT_PUBLISHED_CACHE_KEY,
    JSON.stringify(cache),
  );
}

export function clearPublishedCache(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CONTENT_PUBLISHED_CACHE_KEY);
}

export function overridesToJson(pack: ContentOverrides): string {
  return JSON.stringify(
    { ...pack, version: CONTENT_OVERRIDES_VERSION },
    null,
    2,
  );
}

export function parseOverridesJson(raw: string): ContentOverrides {
  const parsed = JSON.parse(raw) as ContentOverrides;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid content pack");
  }
  return {
    ...parsed,
    version: CONTENT_OVERRIDES_VERSION,
  };
}

export function hasOverrideData(pack: ContentOverrides | null): boolean {
  if (!pack) return false;
  return Boolean(
    (pack.species && Object.keys(pack.species).length) ||
      (pack.moves && Object.keys(pack.moves).length) ||
      (pack.items && Object.keys(pack.items).length) ||
      (pack.relics && Object.keys(pack.relics).length) ||
      (pack.events && pack.events.length) ||
      (pack.regions && Object.keys(pack.regions).length) ||
      (pack.rewards && Object.keys(pack.rewards).length) ||
      (pack.pools &&
        ((pack.pools.starters && pack.pools.starters.length) ||
          (pack.pools.wild && pack.pools.wild.length) ||
          (pack.pools.early && pack.pools.early.length) ||
          (pack.pools.habitats && Object.keys(pack.pools.habitats).length))) ||
      (pack.labels?.en && Object.keys(pack.labels.en).length) ||
      (pack.labels?.es && Object.keys(pack.labels.es).length),
  );
}

export function looksLikeFullSpeciesCatalog(
  species: Record<string, Partial<Species>> | undefined,
): boolean {
  if (!species) return false;
  const values = Object.values(species);
  if (values.length === 0) return false;
  return values.every(
    (sp) =>
      Boolean(sp) &&
      typeof sp.baseHp === "number" &&
      Array.isArray(sp.learnset),
  );
}
