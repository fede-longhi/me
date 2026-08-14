import { MOVES } from "./content/runtime";
import { normalizeMoveDef, moveIsOffensive, moveNeedsTargetChoice } from "./content/moves/normalize";
import type { MoveDef, MoveId } from "./types";

export { MOVES } from "./content/runtime";
export { moveIsOffensive, moveNeedsTargetChoice, normalizeMoveDef };

export function getMove(id: MoveId): MoveDef {
  const raw = MOVES[id];
  if (!raw) {
    return {
      id,
      effects: [{ type: "damage", power: 1, target: "foe" }],
      maxUses: 10,
    };
  }
  return normalizeMoveDef(raw);
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
