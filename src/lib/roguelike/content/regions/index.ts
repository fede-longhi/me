import type { RegionDef, RegionId, RunLevel } from "../../types";

export const RUN_LEVELS: RunLevel[] = [1, 2, 3];

export const REGIONS_BASE: Record<RegionId, RegionDef> = {
  meadow: {
    id: "meadow",
    levels: [1],
    creatures: [
      "ember-cub",
      "gale-finch",
      "moss-brute",
      "spark-mite",
      "cinder-fox",
      "storm-owl",
    ],
    earlyCreatures: ["ember-cub", "gale-finch", "moss-brute"],
    bosses: ["boss-hydra"],
    events: ["meadow-festival"],
  },
  cavern: {
    id: "cavern",
    levels: [1],
    creatures: [
      "moss-brute",
      "shade-pup",
      "spark-mite",
      "root-titan",
      "night-wraith",
      "volt-drake",
    ],
    earlyCreatures: ["moss-brute", "shade-pup", "spark-mite"],
    bosses: ["boss-hydra"],
    events: ["cavern-echo"],
  },
  coast: {
    id: "coast",
    levels: [2],
    creatures: [
      "tide-sprite",
      "gale-finch",
      "reef-guard",
      "spark-mite",
      "storm-owl",
      "volt-drake",
    ],
    earlyCreatures: ["tide-sprite", "gale-finch", "spark-mite"],
    bosses: ["boss-hydra"],
    events: [],
  },
  marsh: {
    id: "marsh",
    levels: [2],
    creatures: [
      "shade-pup",
      "moss-brute",
      "tide-sprite",
      "night-wraith",
      "root-titan",
      "reef-guard",
    ],
    earlyCreatures: ["shade-pup", "moss-brute", "tide-sprite"],
    bosses: ["boss-hydra"],
    events: [],
  },
  highlands: {
    id: "highlands",
    levels: [2, 3],
    creatures: [
      "ember-cub",
      "gale-finch",
      "cinder-fox",
      "storm-owl",
      "volt-drake",
      "root-titan",
    ],
    earlyCreatures: ["ember-cub", "gale-finch", "cinder-fox"],
    bosses: ["boss-hydra"],
    events: [],
  },
  abyss: {
    id: "abyss",
    levels: [3],
    creatures: [
      "shade-pup",
      "night-wraith",
      "volt-drake",
      "root-titan",
      "cinder-fox",
      "reef-guard",
      "storm-owl",
    ],
    earlyCreatures: ["shade-pup", "night-wraith", "volt-drake"],
    bosses: ["boss-hydra"],
    events: ["abyss-whisper"],
  },
};

export const REGION_IDS_BASE: RegionId[] = Object.keys(REGIONS_BASE);
