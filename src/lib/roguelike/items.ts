import type { ItemEffect } from "./content/items";
import { healParty, restorePartyMoves } from "./monsters";
import {
  applyStatusTo,
  clearStatusFrom,
} from "./status";
import type { Combatant, Monster, StatusId } from "./types";

function isCombatant(m: Monster): m is Combatant {
  return "side" in m;
}

/** Apply consumable effects to a party (map or battle combatants). */
export function applyItemEffectsToParty<T extends Monster>(
  party: T[],
  effects: ItemEffect[],
): T[] {
  let next = party;
  for (const effect of effects) {
    if (effect.type === "healParty") {
      next = healParty(next, effect.amount) as T[];
      if (effect.amount === "half" || effect.amount === "full") {
        next = restorePartyMoves(next) as T[];
      }
    } else if (effect.type === "buffParty") {
      next = next.map((m) =>
        m.hp <= 0
          ? m
          : { ...m, [effect.stat]: m[effect.stat] + effect.amount },
      );
    } else if (effect.type === "damageParty") {
      next = next.map((m) =>
        m.hp <= 0 ? m : { ...m, hp: Math.max(1, m.hp - effect.amount) },
      );
    } else if (effect.type === "permStat") {
      next = next.map((m) => {
        if (m.hp <= 0) return m;
        if (effect.stat === "maxHp") {
          const maxHp = m.maxHp + effect.amount;
          return {
            ...m,
            maxHp,
            hp: Math.min(maxHp, m.hp + effect.amount),
          };
        }
        return {
          ...m,
          [effect.stat]: m[effect.stat] + effect.amount,
        };
      });
    } else if (effect.type === "applyStatus") {
      next = next.map((m) => {
        if (m.hp <= 0 || !isCombatant(m)) return m;
        return applyStatusTo(
          m,
          effect.status as StatusId,
          effect.turns,
          effect.potency,
        ) as unknown as T;
      });
    } else if (effect.type === "clearStatus") {
      next = next.map((m) => {
        if (m.hp <= 0 || !isCombatant(m)) return m;
        return clearStatusFrom(
          m,
          effect.status as StatusId | undefined,
        ) as unknown as T;
      });
    }
  }
  return next;
}
