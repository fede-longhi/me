import type { Locale } from "@/lib/types";
import type {
  Element,
  HabitatId,
  MoveDef,
  MoveId,
  RegionDef,
  RegionId,
  RunLevel,
  Species,
  SpeciesId,
} from "../types";
import { EVENTS as EVENTS_BASE } from "./events";
import type { EventDef } from "./events/_types";
import { HABITAT_IDS, HABITAT_POOLS_BASE } from "./habitats";
import { en as EN_BASE, es as ES_BASE, type LocaleLabel } from "./i18n";
import { ITEMS as ITEMS_BASE } from "./items";
import type { ItemDef } from "./items";
import { MOVES as MOVES_BASE } from "./moves";
import { normalizeMoveDef } from "./moves/normalize";
import {
  clearStoredOverrides,
  DEFAULT_REWARD_TUNING,
  emptyOverrides,
  hasOverrideData,
  looksLikeFullSpeciesCatalog,
  type ContentLabelsSlice,
  type ContentOverrides,
  type RewardTuning,
  readPublishedCache,
  readStoredOverrides,
  writePublishedCache,
  writeStoredOverrides,
} from "./overrides";
import shippedPack from "./packs/shipped.json";
import {
  REGIONS_BASE,
  REGION_IDS_BASE,
  RUN_LEVELS,
} from "./regions";
import { RELICS as RELICS_BASE } from "./relics";
import type { RelicDef } from "./relics";
import {
  EARLY_POOL_BASE,
  SPECIES as SPECIES_BASE,
  speciesArtFullPath,
  speciesArtPath,
  STARTER_IDS_BASE,
  WILD_POOL_BASE,
} from "./species";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function isDevContentAuthoring() {
  return process.env.NEXT_PUBLIC_BEAST_PATH_DEV === "true";
}

function replaceList(target: string[], next: string[]) {
  target.splice(0, target.length, ...next);
}

function toggleIn(list: string[], id: string, on?: boolean) {
  if (on === undefined) return;
  const i = list.indexOf(id);
  if (on && i < 0) list.push(id);
  if (!on && i >= 0) list.splice(i, 1);
}

function rebuildEventIndex(list: EventDef[]) {
  return Object.fromEntries(list.map((e) => [e.id, e])) as Record<
    string,
    EventDef
  >;
}

/** Live catalogs — mutated when applying author / shipped packs. */
export const SPECIES: Record<SpeciesId, Species> = clone(SPECIES_BASE);
export const MOVES: Record<MoveId, MoveDef> = clone(MOVES_BASE);
export const ITEMS: Record<string, ItemDef> = clone(ITEMS_BASE);
export const RELICS: Record<string, RelicDef> = clone(RELICS_BASE);
export let EVENTS: EventDef[] = clone(EVENTS_BASE);
export let EVENT_BY_ID: Record<string, EventDef> = rebuildEventIndex(EVENTS);
export const EVENT_IDS: string[] = EVENTS.map((e) => e.id);
export const REWARD_TUNING: RewardTuning = { ...DEFAULT_REWARD_TUNING };

export const SPECIES_IDS: SpeciesId[] = Object.keys(SPECIES_BASE);
export const MOVE_IDS: MoveId[] = Object.keys(MOVES_BASE);
export const ITEM_IDS: string[] = Object.keys(ITEMS);
export const RELIC_IDS: string[] = Object.keys(RELICS);

export const STARTER_IDS: SpeciesId[] = [...STARTER_IDS_BASE];
export const WILD_POOL: SpeciesId[] = [...WILD_POOL_BASE];
export const EARLY_POOL: SpeciesId[] = [...EARLY_POOL_BASE];
export const HABITAT_POOLS: Record<HabitatId, SpeciesId[]> = clone(
  HABITAT_POOLS_BASE,
);

export const REGIONS: Record<RegionId, RegionDef> = clone(REGIONS_BASE);
export const REGION_IDS: RegionId[] = [...REGION_IDS_BASE];

export const copy: Record<Locale, LocaleLabel> = {
  en: clone(EN_BASE),
  es: clone(ES_BASE),
};

export function listRegionIds(): RegionId[] {
  return [...REGION_IDS];
}

export function getRegion(id: RegionId): RegionDef | undefined {
  return REGIONS[id];
}

export function pickRegionForLevel(seed: number, level: RunLevel): RegionId {
  const candidates = REGION_IDS.filter((id) => {
    const region = REGIONS[id];
    return region?.levels?.includes(level);
  });
  const pool =
    candidates.length > 0
      ? candidates
      : REGION_IDS.filter((id) => REGIONS[id]);
  const fallback = pool[0] ?? REGION_IDS_BASE[0] ?? "meadow";
  if (pool.length === 0) return fallback;
  let t = (seed + level * 1_000_003) >>> 0;
  t += 0x6d2b79f5;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
  const u = ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  return pool[Math.floor(u * pool.length)] ?? fallback;
}

export function listBossIds(): SpeciesId[] {
  return SPECIES_IDS.filter((id) => SPECIES[id]?.rarity === "boss");
}

export function getItem(id: string): ItemDef | undefined {
  return ITEMS[id];
}

export function getRelic(id: string): RelicDef | undefined {
  return RELICS[id];
}

export function slugifyContentId(raw: string) {
  return (
    raw
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "new-beast"
  );
}

function resetLiveLabels() {
  copy.en = clone(EN_BASE);
  copy.es = clone(ES_BASE);
}

function resetLivePools() {
  replaceList(STARTER_IDS, STARTER_IDS_BASE);
  replaceList(WILD_POOL, WILD_POOL_BASE);
  replaceList(EARLY_POOL, EARLY_POOL_BASE);
  for (const habitat of HABITAT_IDS) {
    replaceList(HABITAT_POOLS[habitat], HABITAT_POOLS_BASE[habitat] ?? []);
  }
}

function resetLiveRegions() {
  for (const key of Object.keys(REGIONS)) {
    delete REGIONS[key];
  }
  Object.assign(REGIONS, clone(REGIONS_BASE));
  replaceList(REGION_IDS, [...REGION_IDS_BASE]);
}

export function resetLiveContentToBase() {
  for (const key of Object.keys(SPECIES)) {
    delete SPECIES[key];
  }
  Object.assign(SPECIES, clone(SPECIES_BASE));
  replaceList(SPECIES_IDS, Object.keys(SPECIES));

  for (const key of Object.keys(MOVES)) {
    delete MOVES[key];
  }
  Object.assign(MOVES, clone(MOVES_BASE));
  replaceList(MOVE_IDS, Object.keys(MOVES));

  for (const key of Object.keys(ITEMS)) {
    delete ITEMS[key];
  }
  Object.assign(ITEMS, clone(ITEMS_BASE));
  replaceList(ITEM_IDS, Object.keys(ITEMS));

  for (const key of Object.keys(RELICS)) {
    delete RELICS[key];
  }
  Object.assign(RELICS, clone(RELICS_BASE));
  replaceList(RELIC_IDS, Object.keys(RELICS));

  EVENTS = clone(EVENTS_BASE);
  EVENT_BY_ID = rebuildEventIndex(EVENTS);
  replaceList(EVENT_IDS, EVENTS.map((e) => e.id));

  resetLiveRegions();
  Object.assign(REWARD_TUNING, DEFAULT_REWARD_TUNING);
  resetLivePools();
  resetLiveLabels();
}

function applyLabelSlice(
  target: LocaleLabel,
  slice: ContentLabelsSlice | undefined,
  mode: "merge" | "replace",
) {
  if (!slice) return;
  if (slice.species) {
    target.species =
      mode === "replace" ? { ...slice.species } : { ...target.species, ...slice.species };
  }
  if (slice.regions) {
    target.regions =
      mode === "replace"
        ? { ...slice.regions }
        : { ...target.regions, ...slice.regions };
  }
  if (slice.moves) {
    if (mode === "replace") {
      target.moves = clone(slice.moves);
    } else {
      for (const [id, block] of Object.entries(slice.moves)) {
        target.moves[id] = { ...target.moves[id], ...block };
      }
    }
  }
  if (slice.events) {
    if (mode === "replace") {
      target.events = clone(slice.events);
    } else {
      for (const [id, block] of Object.entries(slice.events)) {
        target.events[id] = {
          ...target.events[id],
          ...block,
          choices: {
            ...(target.events[id]?.choices ?? {}),
            ...(block.choices ?? {}),
          },
        };
      }
    }
  }
  if (slice.items) {
    if (mode === "replace") {
      target.items = clone(slice.items);
    } else {
      for (const [id, block] of Object.entries(slice.items)) {
        target.items[id] = { ...target.items[id], ...block };
      }
    }
  }
  if (slice.relics) {
    if (mode === "replace") {
      target.relics = clone(slice.relics);
    } else {
      for (const [id, block] of Object.entries(slice.relics)) {
        target.relics[id] = { ...target.relics[id], ...block };
      }
    }
  }
}

function applyPools(pools: ContentOverrides["pools"]) {
  if (!pools) return;
  if (pools.starters) replaceList(STARTER_IDS, pools.starters);
  if (pools.wild) replaceList(WILD_POOL, pools.wild);
  if (pools.early) replaceList(EARLY_POOL, pools.early);
  if (pools.habitats) {
    for (const habitat of HABITAT_IDS) {
      const next = pools.habitats[habitat];
      if (next) replaceList(HABITAT_POOLS[habitat], next);
    }
  }
}

function mergePack(pack: ContentOverrides) {
  const fullSpecies =
    pack.version >= 2 && looksLikeFullSpeciesCatalog(pack.species);

  if (pack.species) {
    if (fullSpecies) {
      for (const key of Object.keys(SPECIES)) {
        delete SPECIES[key];
      }
      for (const [id, patch] of Object.entries(pack.species)) {
        if (!patch) continue;
        SPECIES[id] = {
          id,
          ...(patch.element ? { element: patch.element as Element } : {}),
          baseHp: patch.baseHp ?? 30,
          baseAtk: patch.baseAtk ?? 8,
          baseDef: patch.baseDef ?? 6,
          baseSpd: patch.baseSpd ?? 6,
          rarity: patch.rarity ?? "common",
          learnset: clone(patch.learnset ?? [{ level: 1, moveId: "scratch" }]),
          art: patch.art ?? speciesArtPath(id),
          artFull: patch.artFull ?? speciesArtFullPath(id),
        };
      }
      replaceList(SPECIES_IDS, Object.keys(SPECIES));
    } else {
      for (const id of Object.keys(pack.species)) {
        const patch = pack.species[id];
        if (!patch || !SPECIES[id]) continue;
        SPECIES[id] = {
          ...SPECIES[id],
          ...patch,
          id,
          learnset: patch.learnset
            ? clone(patch.learnset)
            : SPECIES[id].learnset,
        };
      }
    }
  }

  if (pack.moves) {
    if (pack.version >= 2) {
      for (const key of Object.keys(MOVES)) {
        delete MOVES[key];
      }
      for (const [id, patch] of Object.entries(pack.moves)) {
        if (!patch) continue;
        MOVES[id] = normalizeMoveDef({
          id,
          maxUses: patch.maxUses ?? 8,
          element: patch.element,
          effects: patch.effects ?? [],
          kind: patch.kind,
          power: patch.power,
          effect: patch.effect,
        });
      }
      replaceList(MOVE_IDS, Object.keys(MOVES));
    } else {
      for (const id of Object.keys(pack.moves) as MoveId[]) {
        const patch = pack.moves[id];
        if (!patch || !MOVES[id]) continue;
        MOVES[id] = { ...MOVES[id], ...patch, id };
      }
    }
  }

  if (pack.items) {
    for (const key of Object.keys(ITEMS)) {
      delete ITEMS[key];
    }
    Object.assign(ITEMS, clone(pack.items));
    replaceList(ITEM_IDS, Object.keys(ITEMS));
  }

  if (pack.relics) {
    for (const key of Object.keys(RELICS)) {
      delete RELICS[key];
    }
    Object.assign(RELICS, clone(pack.relics));
    replaceList(RELIC_IDS, Object.keys(RELICS));
  }

  if (pack.events) {
    EVENTS = clone(pack.events);
    EVENT_BY_ID = rebuildEventIndex(EVENTS);
    replaceList(EVENT_IDS, EVENTS.map((e) => e.id));
  }

  if (pack.regions) {
    for (const key of Object.keys(REGIONS)) {
      delete REGIONS[key];
    }
    for (const [id, def] of Object.entries(pack.regions)) {
      if (!def) continue;
      const levels = (def.levels ?? [])
        .map((n) => Number(n) as RunLevel)
        .filter((n): n is RunLevel => n === 1 || n === 2 || n === 3);
      REGIONS[id] = {
        id,
        levels: levels.length > 0 ? levels : [1],
        creatures: [...(def.creatures ?? [])],
        earlyCreatures: def.earlyCreatures
          ? [...def.earlyCreatures]
          : undefined,
        bosses: [...(def.bosses ?? [])],
        events: [...(def.events ?? [])],
      };
    }
    replaceList(REGION_IDS, Object.keys(REGIONS));
  }

  if (pack.rewards) {
    Object.assign(REWARD_TUNING, pack.rewards);
  }

  applyPools(pack.pools);

  const labelMode = pack.version >= 2 ? "replace" : "merge";
  applyLabelSlice(copy.en, pack.labels?.en, labelMode);
  applyLabelSlice(copy.es, pack.labels?.es, labelMode);
}

export function applyContentOverrides(
  pack: ContentOverrides | null,
  options?: { reset?: boolean },
) {
  if (options?.reset !== false) {
    resetLiveContentToBase();
  }
  if (!pack || !hasOverrideData(pack)) return;
  mergePack(pack);
}

export function getShippedPack(): ContentOverrides | null {
  const pack = shippedPack as ContentOverrides;
  if (!pack || !hasOverrideData(pack)) return null;
  return pack;
}

/** Snapshot current live catalogs into a v2 pack (ready to commit as shipped.json). */
export function captureLiveAsOverrides(): ContentOverrides {
  return {
    version: 2,
    updatedAt: new Date().toISOString(),
    species: clone(SPECIES),
    moves: clone(MOVES),
    items: clone(ITEMS),
    relics: clone(RELICS),
    events: clone(EVENTS),
    regions: clone(REGIONS),
    rewards: { ...REWARD_TUNING },
    pools: {
      starters: [...STARTER_IDS],
      wild: [...WILD_POOL],
      early: [...EARLY_POOL],
      habitats: clone(HABITAT_POOLS),
    },
    labels: {
      en: {
        species: { ...copy.en.species },
        regions: { ...copy.en.regions },
        moves: clone(copy.en.moves),
        events: clone(copy.en.events),
        items: clone(copy.en.items),
        relics: clone(copy.en.relics),
      },
      es: {
        species: { ...copy.es.species },
        regions: { ...copy.es.regions },
        moves: clone(copy.es.moves),
        events: clone(copy.es.events),
        items: clone(copy.es.items),
        relics: clone(copy.es.relics),
      },
    },
  };
}

export function saveLiveOverridesToStorage() {
  const pack = captureLiveAsOverrides();
  writeStoredOverrides(pack);
  // Verify the browser actually kept the pack (private mode / quota can fail).
  const readBack = readStoredOverrides();
  if (!readBack || !hasOverrideData(readBack)) {
    throw new Error("localStorage write failed");
  }
}

let overridesHydrated = false;

export type SyncPublishedResult = "cached" | "fetched" | "fallback";

/**
 * Hydrate catalogs: shipped base → published Blob pack (hash-cached) →
 * author draft only in DEV.
 */
export async function syncPublishedContent(): Promise<SyncPublishedResult> {
  applyContentOverrides(getShippedPack(), { reset: true });
  let result: SyncPublishedResult = "fallback";

  try {
    const metaRes = await fetch("/api/beast-path/content/meta", {
      cache: "no-store",
    });
    if (metaRes.ok) {
      const meta = (await metaRes.json()) as { hash?: string };
      const remoteHash = typeof meta.hash === "string" ? meta.hash : null;
      const cache = readPublishedCache();
      if (remoteHash && cache && cache.hash === remoteHash) {
        if (hasOverrideData(cache.pack)) {
          applyContentOverrides(cache.pack, { reset: false });
          result = "cached";
        }
      } else if (remoteHash) {
        const packRes = await fetch("/api/beast-path/content", {
          cache: "no-store",
        });
        if (packRes.ok) {
          const pack = (await packRes.json()) as ContentOverrides;
          if (hasOverrideData(pack)) {
            writePublishedCache({
              hash: remoteHash,
              pack,
              fetchedAt: new Date().toISOString(),
            });
            applyContentOverrides(pack, { reset: false });
            result = "fetched";
          }
        } else if (cache && hasOverrideData(cache.pack)) {
          applyContentOverrides(cache.pack, { reset: false });
          result = "cached";
        }
      }
    } else {
      const cache = readPublishedCache();
      if (cache && hasOverrideData(cache.pack)) {
        applyContentOverrides(cache.pack, { reset: false });
        result = "cached";
      }
    }
  } catch {
    const cache = readPublishedCache();
    if (cache && hasOverrideData(cache.pack)) {
      applyContentOverrides(cache.pack, { reset: false });
      result = "cached";
    }
  }

  if (isDevContentAuthoring()) {
    applyContentOverrides(readStoredOverrides(), { reset: false });
  }

  overridesHydrated = true;
  return result;
}

/** Sync hydrate: shipped + local author draft (no network). Prefer syncPublishedContent. */
export function loadAndApplyStoredOverrides() {
  applyContentOverrides(getShippedPack(), { reset: true });
  const cache = readPublishedCache();
  if (cache && hasOverrideData(cache.pack)) {
    applyContentOverrides(cache.pack, { reset: false });
  }
  if (isDevContentAuthoring()) {
    applyContentOverrides(readStoredOverrides(), { reset: false });
  }
  overridesHydrated = true;
}

/** Apply stored pack only once per page lifetime (safe to call from multiple mounts). */
export async function ensureOverridesHydrated() {
  if (overridesHydrated) return;
  await syncPublishedContent();
}

export function clearAndResetContentOverrides() {
  clearStoredOverrides();
  applyContentOverrides(getShippedPack(), { reset: true });
  const cache = readPublishedCache();
  if (cache && hasOverrideData(cache.pack)) {
    applyContentOverrides(cache.pack, { reset: false });
  }
  overridesHydrated = true;
}

/** Publish live catalogs to Vercel Blob via API. */
export async function publishLiveContent(secret: string): Promise<{
  hash: string;
  updatedAt: string;
}> {
  const pack = captureLiveAsOverrides();
  const res = await fetch("/api/beast-path/content", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(pack),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    meta?: { hash: string; updatedAt: string };
  };
  if (!res.ok || !data.meta) {
    throw new Error(data.error || `Publish failed (${res.status})`);
  }
  writePublishedCache({
    hash: data.meta.hash,
    pack,
    fetchedAt: new Date().toISOString(),
  });
  return data.meta;
}

export function patchSpecies(id: SpeciesId, patch: Partial<Species>) {
  if (!SPECIES[id]) return;
  const next: Species = {
    ...SPECIES[id],
    ...patch,
    id,
    learnset: patch.learnset ? clone(patch.learnset) : SPECIES[id].learnset,
  };
  if ("element" in patch && !patch.element) {
    delete next.element;
  }
  SPECIES[id] = next;
}

export function patchMove(id: MoveId, patch: Partial<MoveDef>) {
  if (!MOVES[id]) return;
  const merged: MoveDef = {
    ...MOVES[id],
    ...patch,
    id,
    effects: patch.effects ?? MOVES[id].effects ?? [],
  };
  if ("element" in patch && !patch.element) {
    delete merged.element;
  }
  MOVES[id] = normalizeMoveDef(merged);
}

export function addMove(input: {
  id: string;
  kind?: MoveDef["kind"];
  element?: Element;
  nameEn?: string;
  nameEs?: string;
}): MoveId {
  let id = slugifyContentId(input.id);
  if (MOVES[id]) {
    let n = 2;
    while (MOVES[`${id}-${n}`]) n += 1;
    id = `${id}-${n}`;
  }
  const kind = input.kind ?? "attack";
  MOVES[id] = normalizeMoveDef({
    id,
    maxUses: kind === "attack" ? 12 : 6,
    element: input.element,
    effects:
      kind === "attack"
        ? [{ type: "damage", power: 1.1, target: "foe" }]
        : [{ type: "heal", portion: 0.35, target: "self" }],
  });
  MOVE_IDS.push(id);
  const nameEn = input.nameEn?.trim() || id;
  const nameEs = input.nameEs?.trim() || nameEn;
  copy.en.moves[id] = { name: nameEn, description: "" };
  copy.es.moves[id] = { name: nameEs, description: "" };
  return id;
}

export function removeMove(id: MoveId): boolean {
  if (!MOVES[id] || MOVE_IDS.length <= 1) return false;
  delete MOVES[id];
  const idx = MOVE_IDS.indexOf(id);
  if (idx >= 0) MOVE_IDS.splice(idx, 1);
  delete copy.en.moves[id];
  delete copy.es.moves[id];
  for (const speciesId of SPECIES_IDS) {
    const sp = SPECIES[speciesId];
    if (!sp) continue;
    const next = sp.learnset.filter((entry) => entry.moveId !== id);
    if (next.length !== sp.learnset.length) {
      SPECIES[speciesId] = {
        ...sp,
        learnset:
          next.length > 0 ? next : [{ level: 1, moveId: MOVE_IDS[0] ?? "scratch" }],
      };
    }
  }
  return true;
}

export function patchItem(id: string, patch: Partial<ItemDef>) {
  const current = ITEMS[id] ?? {
    id,
    effects: [],
  };
  ITEMS[id] = { ...current, ...patch, id };
  if (!ITEM_IDS.includes(id)) ITEM_IDS.push(id);
}

export function addItem(input: {
  id: string;
  nameEn?: string;
  nameEs?: string;
}): string {
  let id = slugifyContentId(input.id);
  if (ITEMS[id]) {
    let n = 2;
    while (ITEMS[`${id}-${n}`]) n += 1;
    id = `${id}-${n}`;
  }
  ITEMS[id] = {
    id,
    maxStack: 1,
    shopCost: 20,
    art: `/beast-path/items/${id}.png`,
    effects: [{ type: "healParty", amount: "half" }],
  };
  ITEM_IDS.push(id);
  const nameEn = input.nameEn?.trim() || id;
  const nameEs = input.nameEs?.trim() || nameEn;
  copy.en.items[id] = { name: nameEn, description: "" };
  copy.es.items[id] = { name: nameEs, description: "" };
  return id;
}

export function removeItem(id: string): boolean {
  if (!ITEMS[id] || ITEM_IDS.length <= 1) return false;
  delete ITEMS[id];
  const idx = ITEM_IDS.indexOf(id);
  if (idx >= 0) ITEM_IDS.splice(idx, 1);
  delete copy.en.items[id];
  delete copy.es.items[id];
  return true;
}

export function patchRelic(id: string, patch: Partial<RelicDef>) {
  const current = RELICS[id] ?? { id, hooks: [] };
  RELICS[id] = { ...current, ...patch, id };
  if (!RELIC_IDS.includes(id)) RELIC_IDS.push(id);
}

export function addRelic(input: {
  id: string;
  nameEn?: string;
  nameEs?: string;
}): string {
  let id = slugifyContentId(input.id);
  if (RELICS[id]) {
    let n = 2;
    while (RELICS[`${id}-${n}`]) n += 1;
    id = `${id}-${n}`;
  }
  RELICS[id] = {
    id,
    art: `/beast-path/relics/${id}.png`,
    hooks: [{ type: "goldMult", mult: 1.1 }],
  };
  RELIC_IDS.push(id);
  const nameEn = input.nameEn?.trim() || id;
  const nameEs = input.nameEs?.trim() || nameEn;
  copy.en.relics[id] = { name: nameEn, description: "" };
  copy.es.relics[id] = { name: nameEs, description: "" };
  return id;
}

export function removeRelic(id: string): boolean {
  if (!RELICS[id] || RELIC_IDS.length <= 1) return false;
  delete RELICS[id];
  const idx = RELIC_IDS.indexOf(id);
  if (idx >= 0) RELIC_IDS.splice(idx, 1);
  delete copy.en.relics[id];
  delete copy.es.relics[id];
  return true;
}

export function patchEvent(id: string, next: EventDef) {
  const idx = EVENTS.findIndex((e) => e.id === id);
  if (idx >= 0) {
    EVENTS[idx] = clone(next);
  } else {
    EVENTS.push(clone(next));
    EVENT_IDS.push(id);
  }
  EVENT_BY_ID = rebuildEventIndex(EVENTS);
  replaceList(EVENT_IDS, EVENTS.map((e) => e.id));
}

export function addEvent(input: {
  id: string;
  titleEn?: string;
  titleEs?: string;
  global?: boolean;
}): string {
  let id = slugifyContentId(input.id);
  if (EVENT_BY_ID[id]) {
    let n = 2;
    while (EVENT_BY_ID[`${id}-${n}`]) n += 1;
    id = `${id}-${n}`;
  }
  const def: EventDef = {
    id,
    global: input.global ?? true,
    choices: [
      { id: "ok", labelKey: "ok", effects: [{ type: "noop" }] },
    ],
  };
  EVENTS.push(def);
  EVENT_BY_ID = rebuildEventIndex(EVENTS);
  replaceList(EVENT_IDS, EVENTS.map((e) => e.id));
  const titleEn = input.titleEn?.trim() || id;
  const titleEs = input.titleEs?.trim() || titleEn;
  copy.en.events[id] = {
    title: titleEn,
    body: "",
    choices: { ok: "OK" },
  };
  copy.es.events[id] = {
    title: titleEs,
    body: "",
    choices: { ok: "OK" },
  };
  return id;
}

export function removeEvent(id: string): boolean {
  if (!EVENT_BY_ID[id] || EVENTS.length <= 1) return false;
  EVENTS = EVENTS.filter((e) => e.id !== id);
  EVENT_BY_ID = rebuildEventIndex(EVENTS);
  replaceList(EVENT_IDS, EVENTS.map((e) => e.id));
  delete copy.en.events[id];
  delete copy.es.events[id];
  for (const regionId of REGION_IDS) {
    const region = REGIONS[regionId];
    if (!region) continue;
    region.events = region.events.filter((eid) => eid !== id);
  }
  return true;
}

export function patchRegion(id: RegionId, patch: Partial<RegionDef>) {
  if (!REGIONS[id]) return;
  REGIONS[id] = {
    ...REGIONS[id],
    ...patch,
    id,
    levels: patch.levels ? [...patch.levels] : REGIONS[id].levels,
    creatures: patch.creatures
      ? [...patch.creatures]
      : REGIONS[id].creatures,
    earlyCreatures:
      patch.earlyCreatures !== undefined
        ? patch.earlyCreatures
          ? [...patch.earlyCreatures]
          : undefined
        : REGIONS[id].earlyCreatures,
    bosses: patch.bosses ? [...patch.bosses] : REGIONS[id].bosses,
    events: patch.events ? [...patch.events] : REGIONS[id].events,
  };
}

export function patchRegionLabels(id: RegionId, names: { en: string; es: string }) {
  copy.en.regions[id] = names.en;
  copy.es.regions[id] = names.es;
}

export function addRegion(input: {
  id: string;
  nameEn?: string;
  nameEs?: string;
}): RegionId {
  let id = slugifyContentId(input.id);
  if (REGIONS[id]) {
    let n = 2;
    while (REGIONS[`${id}-${n}`]) n += 1;
    id = `${id}-${n}`;
  }
  REGIONS[id] = {
    id,
    levels: [1],
    creatures: [],
    earlyCreatures: [],
    bosses: listBossIds().slice(0, 1),
    events: [],
  };
  REGION_IDS.push(id);
  const nameEn = input.nameEn?.trim() || id;
  const nameEs = input.nameEs?.trim() || nameEn;
  copy.en.regions[id] = nameEn;
  copy.es.regions[id] = nameEs;
  return id;
}

export function removeRegion(id: RegionId): boolean {
  if (!REGIONS[id] || REGION_IDS.length <= 1) return false;
  delete REGIONS[id];
  const idx = REGION_IDS.indexOf(id);
  if (idx >= 0) REGION_IDS.splice(idx, 1);
  delete copy.en.regions[id];
  delete copy.es.regions[id];
  return true;
}

export function patchRewardTuning(patch: Partial<RewardTuning>) {
  Object.assign(REWARD_TUNING, patch);
}

export function patchSpeciesLabels(
  id: SpeciesId,
  names: { en: string; es: string },
) {
  copy.en.species[id] = names.en;
  copy.es.species[id] = names.es;
}

export function patchMoveLabels(
  id: MoveId,
  labels: {
    en: { name: string; description: string };
    es: { name: string; description: string };
  },
) {
  copy.en.moves[id] = labels.en;
  copy.es.moves[id] = labels.es;
}

export function patchItemLabels(
  id: string,
  labels: {
    en: { name: string; description: string };
    es: { name: string; description: string };
  },
) {
  copy.en.items[id] = labels.en;
  copy.es.items[id] = labels.es;
}

export function patchRelicLabels(
  id: string,
  labels: {
    en: { name: string; description: string };
    es: { name: string; description: string };
  },
) {
  copy.en.relics[id] = labels.en;
  copy.es.relics[id] = labels.es;
}

export function patchEventLabels(
  id: string,
  labels: {
    en: { title: string; body: string; choices: Record<string, string> };
    es: { title: string; body: string; choices: Record<string, string> };
  },
) {
  copy.en.events[id] = labels.en;
  copy.es.events[id] = labels.es;
}

export function setSpeciesPools(
  id: SpeciesId,
  pools: {
    starter?: boolean;
    wild?: boolean;
    early?: boolean;
    habitats?: HabitatId[];
  },
) {
  toggleIn(STARTER_IDS, id, pools.starter);
  toggleIn(WILD_POOL, id, pools.wild);
  toggleIn(EARLY_POOL, id, pools.early);
  if (pools.habitats) {
    const selected = new Set(pools.habitats);
    for (const habitat of HABITAT_IDS) {
      toggleIn(HABITAT_POOLS[habitat], id, selected.has(habitat));
    }
  }
}

export function addSpecies(input: {
  id: string;
  element?: Element;
  nameEn?: string;
  nameEs?: string;
}): SpeciesId {
  let id = slugifyContentId(input.id);
  if (SPECIES[id]) {
    let n = 2;
    while (SPECIES[`${id}-${n}`]) n += 1;
    id = `${id}-${n}`;
  }
  SPECIES[id] = {
    id,
    ...(input.element ? { element: input.element } : {}),
    baseHp: 30,
    baseAtk: 8,
    baseDef: 6,
    baseSpd: 6,
    rarity: "common",
    art: speciesArtPath(id),
    artFull: speciesArtFullPath(id),
    learnset: [{ level: 1, moveId: "scratch" }],
  };
  SPECIES_IDS.push(id);
  WILD_POOL.push(id);
  const nameEn = input.nameEn?.trim() || id;
  const nameEs = input.nameEs?.trim() || nameEn;
  copy.en.species[id] = nameEn;
  copy.es.species[id] = nameEs;
  return id;
}

export function removeSpecies(id: SpeciesId): boolean {
  if (!SPECIES[id] || SPECIES_IDS.length <= 1) return false;
  delete SPECIES[id];
  const idx = SPECIES_IDS.indexOf(id);
  if (idx >= 0) SPECIES_IDS.splice(idx, 1);
  toggleIn(STARTER_IDS, id, false);
  toggleIn(WILD_POOL, id, false);
  toggleIn(EARLY_POOL, id, false);
  for (const habitat of HABITAT_IDS) {
    toggleIn(HABITAT_POOLS[habitat], id, false);
  }
  for (const regionId of REGION_IDS) {
    const region = REGIONS[regionId];
    if (!region) continue;
    region.creatures = region.creatures.filter((sid) => sid !== id);
    if (region.earlyCreatures) {
      region.earlyCreatures = region.earlyCreatures.filter((sid) => sid !== id);
    }
    region.bosses = region.bosses.filter((sid) => sid !== id);
  }
  delete copy.en.species[id];
  delete copy.es.species[id];
  if (STARTER_IDS.length === 0 && SPECIES_IDS[0]) {
    STARTER_IDS.push(SPECIES_IDS[0]);
  }
  return true;
}

export function habitatsForSpecies(id: SpeciesId): HabitatId[] {
  return HABITAT_IDS.filter((habitat) => HABITAT_POOLS[habitat]?.includes(id));
}

applyContentOverrides(getShippedPack(), { reset: false });

export {
  emptyOverrides,
  hasOverrideData,
  readStoredOverrides,
  HABITAT_IDS,
  RUN_LEVELS,
};
