import type { MoveDef, MoveId } from "../../types";
import { normalizeMoveCatalog } from "./normalize";

const MOVES_RAW: Record<MoveId, MoveDef> = {
  scratch: {
    id: "scratch",
    effects: [{ type: "damage", power: 0.9, target: "foe" }],
    maxUses: 20,
  },
  "ember-lash": {
    id: "ember-lash",
    element: "ember",
    effects: [
      { type: "damage", power: 1.15, target: "foe", element: "ember" },
    ],
    maxUses: 12,
  },
  "tide-bolt": {
    id: "tide-bolt",
    element: "tide",
    effects: [
      { type: "damage", power: 1.15, target: "foe", element: "tide" },
    ],
    maxUses: 12,
  },
  "gale-cut": {
    id: "gale-cut",
    element: "gale",
    effects: [
      { type: "damage", power: 1.1, target: "foe", element: "gale" },
    ],
    maxUses: 12,
  },
  "moss-slam": {
    id: "moss-slam",
    element: "moss",
    effects: [
      { type: "damage", power: 1.2, target: "foe", element: "moss" },
    ],
    maxUses: 10,
  },
  "spark-jolt": {
    id: "spark-jolt",
    element: "spark",
    effects: [
      { type: "damage", power: 1.2, target: "foe", element: "spark" },
    ],
    maxUses: 10,
  },
  "shade-bite": {
    id: "shade-bite",
    element: "shade",
    effects: [
      { type: "damage", power: 1.15, target: "foe", element: "shade" },
    ],
    maxUses: 12,
  },
  "heal-lick": {
    id: "heal-lick",
    effects: [{ type: "heal", portion: 0.35, target: "ally" }],
    maxUses: 6,
  },
  focus: {
    id: "focus",
    effects: [
      { type: "buffStat", stat: "atk", amount: 2, target: "self" },
    ],
    maxUses: 5,
  },
  harden: {
    id: "harden",
    effects: [
      { type: "buffStat", stat: "def", amount: 2, target: "self" },
    ],
    maxUses: 5,
  },
  quicken: {
    id: "quicken",
    effects: [
      { type: "buffStat", stat: "spd", amount: 2, target: "self" },
    ],
    maxUses: 5,
  },
  guard: {
    id: "guard",
    effects: [{ type: "guard", defBonus: 4, target: "self" }],
    maxUses: 8,
  },
  inferno: {
    id: "inferno",
    element: "ember",
    effects: [
      { type: "damage", power: 1.45, target: "foe", element: "ember" },
    ],
    maxUses: 5,
  },
  "tidal-crush": {
    id: "tidal-crush",
    element: "tide",
    effects: [
      { type: "damage", power: 1.4, target: "foe", element: "tide" },
    ],
    maxUses: 5,
  },
  "abyss-fang": {
    id: "abyss-fang",
    element: "shade",
    effects: [
      { type: "damage", power: 1.1, target: "foe", element: "shade" },
    ],
    maxUses: 5,
  },
};

export const MOVES: Record<MoveId, MoveDef> = normalizeMoveCatalog(MOVES_RAW);

export const MOVE_IDS = Object.keys(MOVES) as MoveId[];
