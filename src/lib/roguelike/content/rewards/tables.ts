import type { NodeType } from "../../types";
import {
  relicCaptureBonus,
  relicGoldMult,
  relicXpMult,
} from "../relics/compute";
import { RELICS, REWARD_TUNING } from "../runtime";

/** Base gold before run-level and relic multipliers. */
export function baseGoldFor(nodeType: NodeType, column: number) {
  if (nodeType === "boss") return 80;
  if (nodeType === "elite") return 35 + column * 3;
  if (nodeType === "habitat") return 10 + column * 2;
  return 14 + column * 2;
}

export function runLevelGoldMult(runLevel: number) {
  const boost = Math.max(0, runLevel - 1);
  return 1 + boost * REWARD_TUNING.runLevelGoldStep;
}

export function rewardGoldFor(
  nodeType: NodeType,
  column: number,
  runLevel = 1,
  relicIds: string[] = [],
) {
  const raw =
    baseGoldFor(nodeType, column) *
    runLevelGoldMult(runLevel) *
    relicGoldMult(relicIds, RELICS);
  return Math.round(raw);
}

/** XP shared to each living party member from a battle gold reward. */
export function xpFromGoldReward(goldReward: number, relicIds: string[] = []) {
  const base = Math.max(
    REWARD_TUNING.xpFloor,
    Math.round(
      REWARD_TUNING.xpGoldBase + goldReward / REWARD_TUNING.xpGoldDivisor,
    ),
  );
  return Math.max(1, Math.round(base * relicXpMult(relicIds, RELICS)));
}

/** Capture chance from HP ratio, optionally boosted by relics. */
export function captureChance(
  hp: number,
  maxHp: number,
  relicIds: string[] = [],
) {
  const safeMax = Math.max(1, maxHp);
  const ratio = Math.max(0, Math.min(1, hp / safeMax));
  const base =
    REWARD_TUNING.captureBase +
    REWARD_TUNING.captureHpScale * (1 - ratio);
  return Math.min(
    REWARD_TUNING.captureCap,
    base + relicCaptureBonus(relicIds, RELICS),
  );
}

/** XP needed to advance from `level` to level+1. */
export function xpToNext(level: number) {
  return REWARD_TUNING.xpCurveBase + level * REWARD_TUNING.xpCurvePerLevel;
}
