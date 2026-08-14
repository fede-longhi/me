import type { RelicDef, RelicHook } from "./types";

function hooksOf(catalog: Record<string, RelicDef>, relicIds: string[]) {
  const hooks: RelicHook[] = [];
  for (const id of relicIds) {
    const relic = catalog[id];
    if (!relic) continue;
    hooks.push(...relic.hooks);
  }
  return hooks;
}

export function relicGoldMult(
  relicIds: string[],
  catalog: Record<string, RelicDef>,
) {
  let mult = 1;
  for (const hook of hooksOf(catalog, relicIds)) {
    if (hook.type === "goldMult") mult *= hook.mult;
  }
  return mult;
}

export function relicXpMult(
  relicIds: string[],
  catalog: Record<string, RelicDef>,
) {
  let mult = 1;
  for (const hook of hooksOf(catalog, relicIds)) {
    if (hook.type === "xpMult") mult *= hook.mult;
  }
  return mult;
}

export function relicCaptureBonus(
  relicIds: string[],
  catalog: Record<string, RelicDef>,
) {
  let bonus = 0;
  for (const hook of hooksOf(catalog, relicIds)) {
    if (hook.type === "captureBonus") bonus += hook.amount;
  }
  return bonus;
}

export function relicShopDiscount(
  relicIds: string[],
  catalog: Record<string, RelicDef>,
) {
  let portion = 0;
  for (const hook of hooksOf(catalog, relicIds)) {
    if (hook.type === "shopDiscount") portion += hook.portion;
  }
  return Math.min(0.5, portion);
}

export function relicBattleStartHeal(
  relicIds: string[],
  catalog: Record<string, RelicDef>,
) {
  let portion = 0;
  for (const hook of hooksOf(catalog, relicIds)) {
    if (hook.type === "battleStartHeal") portion += hook.portion;
  }
  return portion;
}

export function relicStatBonus(
  relicIds: string[],
  catalog: Record<string, RelicDef>,
  stat: "atk" | "def" | "spd" | "maxHp",
) {
  let amount = 0;
  for (const hook of hooksOf(catalog, relicIds)) {
    if (hook.type === "statBonus" && hook.stat === stat) amount += hook.amount;
  }
  return amount;
}
