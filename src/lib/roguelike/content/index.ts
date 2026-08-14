import {
  SPECIES,
  SPECIES_IDS,
  MOVES,
  MOVE_IDS,
  ITEMS,
  ITEM_IDS,
  RELICS,
  RELIC_IDS,
  EVENTS,
  EVENT_BY_ID,
  EVENT_IDS,
  REWARD_TUNING,
  STARTER_IDS,
  WILD_POOL,
  EARLY_POOL,
  HABITAT_POOLS,
  HABITAT_IDS,
  REGIONS,
  REGION_IDS,
  RUN_LEVELS,
  copy,
  listBossIds,
  listRegionIds,
  getRegion,
  pickRegionForLevel,
  getItem,
  getRelic,
  applyContentOverrides,
  resetLiveContentToBase,
  loadAndApplyStoredOverrides,
  clearAndResetContentOverrides,
  saveLiveOverridesToStorage,
  captureLiveAsOverrides,
  getShippedPack,
  ensureOverridesHydrated,
  syncPublishedContent,
  publishLiveContent,
  patchSpecies,
  patchMove,
  patchItem,
  patchRelic,
  patchEvent,
  addEvent,
  removeEvent,
  addMove,
  removeMove,
  addItem,
  removeItem,
  addRelic,
  removeRelic,
  patchRegion,
  patchRegionLabels,
  addRegion,
  removeRegion,
  patchRewardTuning,
  patchSpeciesLabels,
  patchMoveLabels,
  patchItemLabels,
  patchRelicLabels,
  patchEventLabels,
  setSpeciesPools,
  addSpecies,
  removeSpecies,
  habitatsForSpecies,
  slugifyContentId,
} from "./runtime";

export {
  SPECIES,
  SPECIES_IDS,
  MOVES,
  MOVE_IDS,
  ITEMS,
  ITEM_IDS,
  RELICS,
  RELIC_IDS,
  EVENTS,
  EVENT_BY_ID,
  EVENT_IDS,
  REWARD_TUNING,
  STARTER_IDS,
  WILD_POOL,
  EARLY_POOL,
  HABITAT_POOLS,
  HABITAT_IDS,
  REGIONS,
  REGION_IDS,
  RUN_LEVELS,
  copy,
  listBossIds,
  listRegionIds,
  getRegion,
  pickRegionForLevel,
  getItem,
  getRelic,
  applyContentOverrides,
  resetLiveContentToBase,
  loadAndApplyStoredOverrides,
  clearAndResetContentOverrides,
  saveLiveOverridesToStorage,
  captureLiveAsOverrides,
  getShippedPack,
  ensureOverridesHydrated,
  syncPublishedContent,
  publishLiveContent,
  patchSpecies,
  patchMove,
  patchItem,
  patchRelic,
  patchEvent,
  addEvent,
  removeEvent,
  addMove,
  removeMove,
  addItem,
  removeItem,
  addRelic,
  removeRelic,
  patchRegion,
  patchRegionLabels,
  addRegion,
  removeRegion,
  patchRewardTuning,
  patchSpeciesLabels,
  patchMoveLabels,
  patchItemLabels,
  patchRelicLabels,
  patchEventLabels,
  setSpeciesPools,
  addSpecies,
  removeSpecies,
  habitatsForSpecies,
  slugifyContentId,
};

/** Live boss list (respects rarity overrides). Alias of listBossIds. */
export { listBossIds as BOSS_IDS } from "./runtime";

export type { RegionDef } from "../types";

export {
  speciesArtPath,
  speciesArtFullPath,
  speciesThumbArt,
  speciesFullArt,
} from "./species";

export { pickHabitat } from "./habitats";

export type { EventDef, EventEffect, EventChoiceDef } from "./events/_types";
export type { ItemDef, ItemEffect } from "./items";
export type { RelicDef, RelicHook } from "./relics";
export {
  relicGoldMult,
  relicXpMult,
  relicCaptureBonus,
  relicShopDiscount,
  relicBattleStartHeal,
  relicStatBonus,
} from "./relics/compute";

export {
  rewardGoldFor,
  xpFromGoldReward,
  captureChance,
  xpToNext,
  baseGoldFor,
  runLevelGoldMult,
} from "./rewards/tables";

export type { LocaleLabel } from "./i18n";
export { isBeastPathDev, collectContentWarnings } from "./dev";
export type { ContentWarning } from "./dev";

export {
  CONTENT_OVERRIDES_KEY,
  DEFAULT_REWARD_TUNING,
  emptyOverrides,
  hasOverrideData,
  readStoredOverrides,
  writeStoredOverrides,
  clearStoredOverrides,
  overridesToJson,
  parseOverridesJson,
  type ContentOverrides,
  type RewardTuning,
} from "./overrides";

import type { Element } from "../types";

export const ELEMENT_COLOR: Record<Element, string> = {
  ember: "#c45c2a",
  tide: "#2a7cad",
  gale: "#5a8fbf",
  moss: "#2f8a5b",
  spark: "#c9a227",
  shade: "#5b4b8a",
};

/** Soft muted fallback when a beast/move has no element. */
export function elementColorOf(element?: Element | null): string {
  return element ? ELEMENT_COLOR[element] : "var(--bp-muted)";
}
