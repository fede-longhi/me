import type { HabitatId, SpeciesId } from "./types";

export const HABITAT_IDS: HabitatId[] = [
  "cave",
  "grassland",
  "forest",
  "river",
  "sea",
  "beach",
  "desert",
  "swamp",
];

/** Draft pools — tweak later when content is locked. */
export const HABITAT_POOLS: Record<HabitatId, SpeciesId[]> = {
  cave: ["moss-brute", "shade-pup", "spark-mite"],
  grassland: ["gale-finch", "ember-cub", "moss-brute"],
  forest: ["moss-brute", "shade-pup", "gale-finch"],
  river: ["tide-sprite", "moss-brute", "gale-finch"],
  sea: ["tide-sprite", "reef-guard", "shade-pup"],
  beach: ["tide-sprite", "gale-finch", "ember-cub"],
  desert: ["ember-cub", "cinder-fox", "spark-mite"],
  swamp: ["shade-pup", "moss-brute", "night-wraith"],
};

export function pickHabitat(rng: () => number): HabitatId {
  return HABITAT_IDS[Math.floor(rng() * HABITAT_IDS.length)] ?? "forest";
}
