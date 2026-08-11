import type { MoveDef, MoveId } from "./types";

export const MOVES: Record<MoveId, MoveDef> = {
  scratch: { id: "scratch", kind: "attack", power: 0.9, maxUses: 20 },
  "ember-lash": {
    id: "ember-lash",
    kind: "attack",
    power: 1.15,
    element: "ember",
    maxUses: 12,
  },
  "tide-bolt": {
    id: "tide-bolt",
    kind: "attack",
    power: 1.15,
    element: "tide",
    maxUses: 12,
  },
  "gale-cut": {
    id: "gale-cut",
    kind: "attack",
    power: 1.1,
    element: "gale",
    maxUses: 12,
  },
  "moss-slam": {
    id: "moss-slam",
    kind: "attack",
    power: 1.2,
    element: "moss",
    maxUses: 10,
  },
  "spark-jolt": {
    id: "spark-jolt",
    kind: "attack",
    power: 1.2,
    element: "spark",
    maxUses: 10,
  },
  "shade-bite": {
    id: "shade-bite",
    kind: "attack",
    power: 1.15,
    element: "shade",
    maxUses: 12,
  },
  "heal-lick": {
    id: "heal-lick",
    kind: "passive",
    effect: { type: "heal", portion: 0.35 },
    maxUses: 6,
  },
  focus: {
    id: "focus",
    kind: "passive",
    effect: { type: "buffStat", stat: "atk", amount: 2 },
    maxUses: 5,
  },
  harden: {
    id: "harden",
    kind: "passive",
    effect: { type: "buffStat", stat: "def", amount: 2 },
    maxUses: 5,
  },
  quicken: {
    id: "quicken",
    kind: "passive",
    effect: { type: "buffStat", stat: "spd", amount: 2 },
    maxUses: 5,
  },
  guard: {
    id: "guard",
    kind: "passive",
    effect: { type: "guard", defBonus: 4 },
    maxUses: 8,
  },
  inferno: {
    id: "inferno",
    kind: "attack",
    power: 1.45,
    element: "ember",
    maxUses: 5,
  },
  "tidal-crush": {
    id: "tidal-crush",
    kind: "attack",
    power: 1.4,
    element: "tide",
    maxUses: 5,
  },
  "abyss-fang": {
    id: "abyss-fang",
    kind: "attack",
    power: 1.1,
    element: "shade",
    maxUses: 5,
  },
};

export function getMove(id: MoveId): MoveDef {
  return MOVES[id];
}

export function maxUsesFor(id: MoveId) {
  return MOVES[id].maxUses;
}

export function remainingUses(
  moveUses: Partial<Record<MoveId, number>> | undefined,
  moveId: MoveId,
) {
  const value = moveUses?.[moveId];
  return typeof value === "number" ? value : maxUsesFor(moveId);
}

export function initMoveUses(moveIds: MoveId[]): Partial<Record<MoveId, number>> {
  const uses: Partial<Record<MoveId, number>> = {};
  for (const id of moveIds) {
    uses[id] = maxUsesFor(id);
  }
  return uses;
}

export function restoreAllMoveUses(moveIds: MoveId[]): Partial<Record<MoveId, number>> {
  return initMoveUses(moveIds);
}

export function movesKnownAtLevel(
  learnset: { level: number; moveId: MoveId }[],
  level: number,
): MoveId[] {
  return learnset
    .filter((entry) => entry.level <= level)
    .sort((a, b) => a.level - b.level || a.moveId.localeCompare(b.moveId))
    .map((entry) => entry.moveId)
    .filter((id, idx, arr) => arr.indexOf(id) === idx);
}

/** Keep at most `max` moves, preferring newest learnset order. */
export function trimMoves(moveIds: MoveId[], max: number): MoveId[] {
  if (moveIds.length <= max) return moveIds;
  return moveIds.slice(moveIds.length - max);
}

export function learnMovesForLevelUp(
  current: MoveId[],
  currentUses: Partial<Record<MoveId, number>>,
  learnset: { level: number; moveId: MoveId }[],
  newLevel: number,
  max: number,
): {
  moves: MoveId[];
  moveUses: Partial<Record<MoveId, number>>;
  learned: MoveId | null;
  forgot: MoveId | null;
} {
  const entry = learnset.find((e) => e.level === newLevel);
  if (!entry || current.includes(entry.moveId)) {
    return {
      moves: current,
      moveUses: currentUses,
      learned: null,
      forgot: null,
    };
  }

  if (current.length < max) {
    return {
      moves: [...current, entry.moveId],
      moveUses: { ...currentUses, [entry.moveId]: maxUsesFor(entry.moveId) },
      learned: entry.moveId,
      forgot: null,
    };
  }

  const forgot = current[0];
  const nextUses = { ...currentUses };
  delete nextUses[forgot];
  nextUses[entry.moveId] = maxUsesFor(entry.moveId);
  return {
    moves: [...current.slice(1), entry.moveId],
    moveUses: nextUses,
    learned: entry.moveId,
    forgot,
  };
}
