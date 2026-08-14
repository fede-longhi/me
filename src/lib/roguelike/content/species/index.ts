import type { LearnEntry, Species, SpeciesId } from "../../types";

function ls(...entries: LearnEntry[]): LearnEntry[] {
  return entries;
}

/** Thumbnail under /beast-path/species/{id}.png when present. */
export function speciesArtPath(id: SpeciesId) {
  return `/beast-path/species/${id}.png`;
}

/** Full-body art under /beast-path/species/{id}-full.png when present. */
export function speciesArtFullPath(id: SpeciesId) {
  return `/beast-path/species/${id}-full.png`;
}

export function speciesThumbArt(species?: {
  art?: string;
  artFull?: string;
} | null) {
  return species?.art || species?.artFull;
}

export function speciesFullArt(species?: {
  art?: string;
  artFull?: string;
} | null) {
  return species?.artFull || species?.art;
}

export const SPECIES: Record<SpeciesId, Species> = {
  "ember-cub": {
    id: "ember-cub",
    element: "ember",
    baseHp: 30,
    baseAtk: 8,
    baseDef: 5,
    baseSpd: 8,
    rarity: "common",
    art: speciesArtPath("ember-cub"),
    artFull: speciesArtFullPath("ember-cub"),
    learnset: ls(
      { level: 1, moveId: "scratch" },
      { level: 1, moveId: "ember-lash" },
      { level: 3, moveId: "focus" },
      { level: 5, moveId: "inferno" },
    ),
  },
  "tide-sprite": {
    id: "tide-sprite",
    element: "tide",
    baseHp: 34,
    baseAtk: 7,
    baseDef: 7,
    baseSpd: 6,
    rarity: "common",
    art: speciesArtPath("tide-sprite"),
    artFull: speciesArtFullPath("tide-sprite"),
    learnset: ls(
      { level: 1, moveId: "scratch" },
      { level: 1, moveId: "tide-bolt" },
      { level: 3, moveId: "heal-lick" },
      { level: 5, moveId: "tidal-crush" },
    ),
  },
  "gale-finch": {
    id: "gale-finch",
    element: "gale",
    baseHp: 26,
    baseAtk: 8,
    baseDef: 4,
    baseSpd: 12,
    rarity: "common",
    art: speciesArtPath("gale-finch"),
    artFull: speciesArtFullPath("gale-finch"),
    learnset: ls(
      { level: 1, moveId: "scratch" },
      { level: 1, moveId: "gale-cut" },
      { level: 3, moveId: "quicken" },
      { level: 5, moveId: "focus" },
    ),
  },
  "moss-brute": {
    id: "moss-brute",
    element: "moss",
    baseHp: 36,
    baseAtk: 6,
    baseDef: 8,
    baseSpd: 4,
    rarity: "common",
    art: speciesArtPath("moss-brute"),
    artFull: speciesArtFullPath("moss-brute"),
    learnset: ls(
      { level: 1, moveId: "scratch" },
      { level: 1, moveId: "moss-slam" },
      { level: 3, moveId: "harden" },
      { level: 4, moveId: "guard" },
    ),
  },
  "spark-mite": {
    id: "spark-mite",
    element: "spark",
    baseHp: 22,
    baseAtk: 10,
    baseDef: 3,
    baseSpd: 11,
    rarity: "uncommon",
    art: speciesArtPath("spark-mite"),
    artFull: speciesArtFullPath("spark-mite"),
    learnset: ls(
      { level: 1, moveId: "scratch" },
      { level: 1, moveId: "spark-jolt" },
      { level: 3, moveId: "quicken" },
      { level: 4, moveId: "focus" },
    ),
  },
  "shade-pup": {
    id: "shade-pup",
    element: "shade",
    baseHp: 28,
    baseAtk: 8,
    baseDef: 5,
    baseSpd: 9,
    rarity: "uncommon",
    art: speciesArtPath("shade-pup"),
    artFull: speciesArtFullPath("shade-pup"),
    learnset: ls(
      { level: 1, moveId: "scratch" },
      { level: 1, moveId: "shade-bite" },
      { level: 3, moveId: "heal-lick" },
      { level: 5, moveId: "abyss-fang" },
    ),
  },
  "cinder-fox": {
    id: "cinder-fox",
    element: "ember",
    baseHp: 30,
    baseAtk: 11,
    baseDef: 6,
    baseSpd: 10,
    rarity: "uncommon",
    art: speciesArtPath("cinder-fox"),
    artFull: speciesArtFullPath("cinder-fox"),
    learnset: ls(
      { level: 1, moveId: "ember-lash" },
      { level: 1, moveId: "scratch" },
      { level: 3, moveId: "focus" },
      { level: 4, moveId: "inferno" },
    ),
  },
  "reef-guard": {
    id: "reef-guard",
    element: "tide",
    baseHp: 40,
    baseAtk: 8,
    baseDef: 11,
    baseSpd: 5,
    rarity: "uncommon",
    art: speciesArtPath("reef-guard"),
    artFull: speciesArtFullPath("reef-guard"),
    learnset: ls(
      { level: 1, moveId: "tide-bolt" },
      { level: 1, moveId: "guard" },
      { level: 3, moveId: "harden" },
      { level: 5, moveId: "tidal-crush" },
    ),
  },
  "storm-owl": {
    id: "storm-owl",
    element: "gale",
    baseHp: 28,
    baseAtk: 11,
    baseDef: 6,
    baseSpd: 13,
    rarity: "rare",
    art: speciesArtPath("storm-owl"),
    artFull: speciesArtFullPath("storm-owl"),
    learnset: ls(
      { level: 1, moveId: "gale-cut" },
      { level: 1, moveId: "quicken" },
      { level: 3, moveId: "scratch" },
      { level: 4, moveId: "focus" },
    ),
  },
  "root-titan": {
    id: "root-titan",
    element: "moss",
    baseHp: 48,
    baseAtk: 10,
    baseDef: 12,
    baseSpd: 3,
    rarity: "rare",
    art: speciesArtPath("root-titan"),
    artFull: speciesArtFullPath("root-titan"),
    learnset: ls(
      { level: 1, moveId: "moss-slam" },
      { level: 1, moveId: "harden" },
      { level: 3, moveId: "guard" },
      { level: 5, moveId: "heal-lick" },
    ),
  },
  "volt-drake": {
    id: "volt-drake",
    element: "spark",
    baseHp: 34,
    baseAtk: 14,
    baseDef: 7,
    baseSpd: 10,
    rarity: "rare",
    art: speciesArtPath("volt-drake"),
    artFull: speciesArtFullPath("volt-drake"),
    learnset: ls(
      { level: 1, moveId: "spark-jolt" },
      { level: 1, moveId: "scratch" },
      { level: 3, moveId: "focus" },
      { level: 4, moveId: "quicken" },
    ),
  },
  "night-wraith": {
    id: "night-wraith",
    element: "shade",
    baseHp: 32,
    baseAtk: 13,
    baseDef: 7,
    baseSpd: 12,
    rarity: "rare",
    art: speciesArtPath("night-wraith"),
    artFull: speciesArtFullPath("night-wraith"),
    learnset: ls(
      { level: 1, moveId: "shade-bite" },
      { level: 1, moveId: "scratch" },
      { level: 3, moveId: "quicken" },
      { level: 5, moveId: "abyss-fang" },
    ),
  },
  "boss-hydra": {
    id: "boss-hydra",
    element: "shade",
    baseHp: 100,
    baseAtk: 7,
    baseDef: 5,
    baseSpd: 6,
    rarity: "boss",
    art: speciesArtPath("boss-hydra"),
    artFull: speciesArtFullPath("boss-hydra"),
    learnset: ls(
      { level: 1, moveId: "abyss-fang" },
      { level: 1, moveId: "shade-bite" },
      { level: 1, moveId: "guard" },
      { level: 1, moveId: "scratch" },
    ),
  },
};

export const SPECIES_IDS = Object.keys(SPECIES) as SpeciesId[];

export const BOSS_IDS: SpeciesId[] = SPECIES_IDS.filter(
  (id) => SPECIES[id].rarity === "boss",
);

export const STARTER_IDS_BASE: SpeciesId[] = [
  "ember-cub",
  "tide-sprite",
  "gale-finch",
];

/** @deprecated Use live STARTER_IDS from content/runtime. */
export const STARTER_IDS = STARTER_IDS_BASE;

export const WILD_POOL_BASE: SpeciesId[] = [
  "ember-cub",
  "tide-sprite",
  "gale-finch",
  "moss-brute",
  "spark-mite",
  "shade-pup",
  "cinder-fox",
  "reef-guard",
  "storm-owl",
  "root-titan",
  "volt-drake",
  "night-wraith",
];

export const EARLY_POOL_BASE: SpeciesId[] = [
  "ember-cub",
  "tide-sprite",
  "gale-finch",
  "moss-brute",
];
