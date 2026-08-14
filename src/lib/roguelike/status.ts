import type {
  Combatant,
  StatusId,
  StatusInstance,
} from "./types";

export const STATUS_IDS: StatusId[] = [
  "burn",
  "poison",
  "paralysis",
  "freeze",
  "slow",
  "weak",
  "ward",
];

export function getStatuses(m: Combatant): StatusInstance[] {
  return m.statuses ?? [];
}

export function hasStatus(m: Combatant, id: StatusId): boolean {
  return getStatuses(m).some((s) => s.id === id);
}

export function getStatus(
  m: Combatant,
  id: StatusId,
): StatusInstance | undefined {
  return getStatuses(m).find((s) => s.id === id);
}

/** Replace or refresh a status on a combatant. */
export function applyStatusTo(
  m: Combatant,
  status: StatusId,
  turns: number,
  potency?: number,
): Combatant {
  const rest = getStatuses(m).filter((s) => s.id !== status);
  const next: StatusInstance = { id: status, turns, potency };
  return { ...m, statuses: [...rest, next] };
}

export function clearStatusFrom(
  m: Combatant,
  status?: StatusId,
): Combatant {
  if (!status) return { ...m, statuses: [] };
  return {
    ...m,
    statuses: getStatuses(m).filter((s) => s.id !== status),
  };
}

/** Consume one ward charge; returns whether damage was blocked. */
export function tryConsumeWard(
  m: Combatant,
): { blocked: boolean; combatant: Combatant } {
  const ward = getStatus(m, "ward");
  if (!ward) return { blocked: false, combatant: m };
  const turns = ward.turns - 1;
  if (turns <= 0) {
    return { blocked: true, combatant: clearStatusFrom(m, "ward") };
  }
  return {
    blocked: true,
    combatant: applyStatusTo(m, "ward", turns, ward.potency),
  };
}

/** Break freeze when taking real damage. */
export function breakFreezeOnHit(m: Combatant): Combatant {
  if (!hasStatus(m, "freeze")) return m;
  return clearStatusFrom(m, "freeze");
}

/** Tick DoTs and decrement durations after a combatant's action resolves. */
export function tickStatusesAfterAction(m: Combatant): {
  combatant: Combatant;
  dotDamage: number;
  logs: string[];
} {
  let combatant = m;
  let dotDamage = 0;
  const logs: string[] = [];
  const statuses = getStatuses(combatant);

  for (const s of statuses) {
    if (s.id === "burn") {
      const portion = s.potency ?? 0.08;
      const dmg = Math.max(1, Math.round(combatant.maxHp * portion));
      dotDamage += dmg;
      logs.push(`burn −${dmg}`);
    } else if (s.id === "poison") {
      const portion = s.potency ?? 0.06;
      const dmg = Math.max(1, Math.round(combatant.maxHp * portion));
      dotDamage += dmg;
      logs.push(`poison −${dmg}`);
    }
  }

  if (dotDamage > 0) {
    const hp = Math.max(1, combatant.hp - dotDamage);
    combatant = { ...combatant, hp };
  }

  const nextStatuses = getStatuses(combatant)
    .map((s) => ({ ...s, turns: s.turns - 1 }))
    .filter((s) => s.turns > 0);

  combatant = { ...combatant, statuses: nextStatuses };
  return { combatant, dotDamage, logs };
}

/** Effective ATK after weak. */
export function statusModifiedAtk(m: Combatant, base: number): number {
  const weak = getStatus(m, "weak");
  if (!weak) return base;
  const amount = weak.potency ?? 2;
  return Math.max(1, base - amount);
}

/** Effective SPD after slow. */
export function statusModifiedSpd(m: Combatant, base: number): number {
  const slow = getStatus(m, "slow");
  if (!slow) return base;
  const amount = slow.potency ?? 2;
  return Math.max(1, base - amount);
}

/** Paralysis skip chance (default 35%). */
export function paralysisSkipChance(m: Combatant): number {
  const p = getStatus(m, "paralysis");
  if (!p) return 0;
  return Math.min(0.9, p.potency ?? 0.35);
}
