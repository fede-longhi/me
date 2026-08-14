import { pickRegionForLevel } from "./content";
import { normalizeBagSlots } from "./events";
import { generateMap, getNode, mapSeedForLevel } from "./map";
import { syncUidCounterFrom } from "./monsters";
import type {
  InventoryStack,
  Monster,
  RegionId,
  RunLevel,
  RunState,
} from "./types";
import { MAX_RUN_LEVEL } from "./types";

export const SAVE_STORAGE_KEY = "beast-path-save";
export const SAVE_VERSION = 4 as const;

export type SavedRunV4 = {
  version: typeof SAVE_VERSION;
  seed: number;
  currentLevel: RunLevel;
  regionId: RegionId;
  gold: number;
  party: Monster[];
  reserve: Monster[];
  items: InventoryStack[];
  relics: string[];
  currentNodeId: string;
  visited: string[];
};

function isMonster(value: unknown): value is Monster {
  if (!value || typeof value !== "object") return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.uid === "string" &&
    typeof m.speciesId === "string" &&
    typeof m.name === "string" &&
    typeof m.level === "number" &&
    typeof m.hp === "number" &&
    typeof m.maxHp === "number" &&
    Array.isArray(m.moves)
  );
}

function isRunLevel(value: unknown): value is RunLevel {
  return value === 1 || value === 2 || value === 3;
}

function isInventoryStack(value: unknown): value is InventoryStack {
  if (!value || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  return typeof s.itemId === "string" && typeof s.qty === "number" && s.qty > 0;
}

function parseSavedRun(value: unknown): SavedRunV4 | null {
  if (!value || typeof value !== "object") return null;
  const s = value as Record<string, unknown>;
  const version = s.version;
  if (
    version !== 1 &&
    version !== 2 &&
    version !== 3 &&
    version !== SAVE_VERSION
  ) {
    return null;
  }
  if (
    typeof s.seed !== "number" ||
    typeof s.gold !== "number" ||
    typeof s.currentNodeId !== "string" ||
    !Array.isArray(s.visited) ||
    !s.visited.every((id) => typeof id === "string") ||
    !Array.isArray(s.party) ||
    s.party.length === 0 ||
    !s.party.every(isMonster) ||
    !Array.isArray(s.reserve) ||
    !s.reserve.every(isMonster)
  ) {
    return null;
  }

  const currentLevel: RunLevel =
    (version === 2 || version === 3 || version === SAVE_VERSION) &&
    isRunLevel(s.currentLevel)
      ? s.currentLevel
      : 1;

  if (currentLevel > MAX_RUN_LEVEL) return null;

  const items =
    (version === 3 || version === SAVE_VERSION) && Array.isArray(s.items)
      ? normalizeBagSlots(s.items.filter(isInventoryStack))
      : [];
  const relics =
    (version === 3 || version === SAVE_VERSION) && Array.isArray(s.relics)
      ? s.relics.filter((id): id is string => typeof id === "string")
      : [];

  const regionId: RegionId =
    version === SAVE_VERSION && typeof s.regionId === "string" && s.regionId
      ? s.regionId
      : pickRegionForLevel(s.seed, currentLevel);

  return {
    version: SAVE_VERSION,
    seed: s.seed,
    currentLevel,
    regionId,
    gold: s.gold,
    party: s.party,
    reserve: s.reserve,
    items,
    relics,
    currentNodeId: s.currentNodeId,
    visited: s.visited,
  };
}

export function toSavedRun(state: RunState): SavedRunV4 {
  return {
    version: SAVE_VERSION,
    seed: state.seed,
    currentLevel: state.currentLevel,
    regionId: state.regionId,
    gold: state.gold,
    party: state.party,
    reserve: state.reserve,
    items: state.items,
    relics: state.relics,
    currentNodeId: state.currentNodeId,
    visited: state.visited,
  };
}

export function hydrateRun(saved: SavedRunV4): RunState {
  syncUidCounterFrom([...saved.party, ...saved.reserve]);
  const map = generateMap(mapSeedForLevel(saved.seed, saved.currentLevel));
  const current = getNode(map, saved.currentNodeId);
  const available = current
    ? current.next.filter((id) => !saved.visited.includes(id))
    : [];

  return {
    seed: saved.seed,
    currentLevel: saved.currentLevel,
    regionId: saved.regionId,
    gold: saved.gold,
    party: saved.party,
    reserve: saved.reserve,
    items: saved.items,
    relics: saved.relics,
    map,
    currentNodeId: saved.currentNodeId,
    visited: saved.visited,
    available,
    screen: { kind: "map" },
    battle: null,
    shopOffers: [],
    shopSoldCreature: false,
    event: null,
    eventResolved: false,
    lastMessage: null,
  };
}

export function hasSavedRun(): boolean {
  return readSavedRun() !== null;
}

export function readSavedRun(): SavedRunV4 | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = parseSavedRun(JSON.parse(raw) as unknown);
    if (!parsed) return null;
    const map = generateMap(mapSeedForLevel(parsed.seed, parsed.currentLevel));
    if (!getNode(map, parsed.currentNodeId)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveRun(state: RunState): void {
  if (typeof window === "undefined") return;
  if (state.screen.kind !== "map" || state.party.length === 0) return;
  try {
    window.localStorage.setItem(
      SAVE_STORAGE_KEY,
      JSON.stringify(toSavedRun(state)),
    );
  } catch {
    // Quota / private mode — ignore.
  }
}

export function clearSavedRun(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SAVE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Persist or clear based on the resulting screen. */
export function syncRunPersistence(state: RunState): void {
  if (state.screen.kind === "map" && state.party.length > 0) {
    saveRun(state);
    return;
  }
  if (state.screen.kind === "victory" || state.screen.kind === "defeat") {
    clearSavedRun();
  }
}
