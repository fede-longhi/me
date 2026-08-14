import type { LocaleLabel } from "./content";
import { RELICS } from "./content/runtime";
import { relicStatBonus } from "./content/relics/compute";
import { calcMoveDamage, estimateMoveDamage, nextUid } from "./monsters";
import { initMoveUses, remainingUses } from "./moves";
import {
  applyStatusTo,
  breakFreezeOnHit,
  clearStatusFrom,
  hasStatus,
  paralysisSkipChance,
  statusModifiedAtk,
  statusModifiedSpd,
  tryConsumeWard,
} from "./status";
import type {
  BattleLogEntry,
  BattleState,
  Combatant,
  Element,
  MoveEffect,
  MoveEffectTarget,
  MoveId,
  PlannedAction,
  StatusId,
} from "./types";
import { getMove, moveIsOffensive } from "./moves";

export type BattleFx =
  | { kind: "act"; actorId: string; moveId: MoveId | null }
  | { kind: "damage"; targetId: string; amount: number }
  | { kind: "heal"; targetId: string; amount: number }
  | { kind: "buff"; targetId: string; text: string }
  | { kind: "guard"; targetId: string; text: string }
  | { kind: "status"; targetId: string; text: string }
  | { kind: "ward"; targetId: string }
  | { kind: "faint"; targetId: string }
  | { kind: "capture"; targetId: string; success: boolean };

function alive(list: Combatant[]) {
  return list.filter((m) => m.hp > 0);
}

function pushLog(log: BattleLogEntry[], text: string): BattleLogEntry[] {
  return [...log, { id: nextUid("log"), text }].slice(-12);
}

function findCombatant(state: BattleState, uid: string) {
  return (
    state.player.find((m) => m.uid === uid) ??
    state.enemies.find((m) => m.uid === uid) ??
    null
  );
}

function updateCombatant(
  state: BattleState,
  uid: string,
  patch: Partial<Combatant>,
): BattleState {
  const patchList = (list: Combatant[]) =>
    list.map((m) => (m.uid === uid ? { ...m, ...patch } : m));
  return {
    ...state,
    player: patchList(state.player),
    enemies: patchList(state.enemies),
  };
}

function replaceCombatant(state: BattleState, next: Combatant): BattleState {
  return updateCombatant(state, next.uid, next);
}

export function combatAtk(m: Combatant, relicIds: string[] = []): number {
  const bonus = relicStatBonus(relicIds, RELICS, "atk");
  return statusModifiedAtk(m, m.atk + bonus);
}

export function combatDef(m: Combatant, relicIds: string[] = []): number {
  const bonus = relicStatBonus(relicIds, RELICS, "def");
  return m.def + bonus;
}

export function combatSpd(m: Combatant, relicIds: string[] = []): number {
  const bonus = relicStatBonus(relicIds, RELICS, "spd");
  return statusModifiedSpd(m, m.spd + bonus);
}

function withCombatStats(
  m: Combatant,
  relicIds: string[],
): Combatant {
  return {
    ...m,
    atk: combatAtk(m, relicIds),
    def: combatDef(m, relicIds),
    spd: combatSpd(m, relicIds),
  };
}

function resolveTargets(
  state: BattleState,
  actor: Combatant,
  target: MoveEffectTarget,
  planTargetId: string | null,
): Combatant[] {
  const allies = actor.side === "player" ? state.player : state.enemies;
  const foes = actor.side === "player" ? state.enemies : state.player;
  const livingAllies = alive(allies);
  const livingFoes = alive(foes);

  if (target === "self") {
    return actor.hp > 0 ? [actor] : [];
  }
  if (target === "allAllies") return livingAllies;
  if (target === "allFoes") return livingFoes;

  if (target === "ally") {
    const pick =
      (planTargetId
        ? livingAllies.find((m) => m.uid === planTargetId)
        : undefined) ??
      [...livingAllies].sort(
        (a, b) =>
          a.hp / a.maxHp - b.hp / b.maxHp || a.uid.localeCompare(b.uid),
      )[0];
    return pick ? [pick] : [];
  }

  // foe
  const pick =
    (planTargetId
      ? livingFoes.find((m) => m.uid === planTargetId)
      : undefined) ??
    [...livingFoes].sort(
      (a, b) => a.hp - b.hp || a.uid.localeCompare(b.uid),
    )[0];
  return pick ? [pick] : [];
}

function dealDamage(
  state: BattleState,
  actor: Combatant,
  target: Combatant,
  power: number,
  element: Element | undefined,
  labels: LocaleLabel,
  relicIds: string[],
): { state: BattleState; fx: BattleFx[]; dealt: number } {
  const fx: BattleFx[] = [];
  let next = state;
  let current = findCombatant(next, target.uid);
  if (!current || current.hp <= 0) return { state: next, fx, dealt: 0 };

  const ward = tryConsumeWard(current);
  if (ward.blocked) {
    next = replaceCombatant(next, ward.combatant);
    fx.push({ kind: "ward", targetId: current.uid });
    next = {
      ...next,
      log: pushLog(next.log, `${current.name} wards the hit`),
    };
    return { state: next, fx, dealt: 0 };
  }

  const atkActor = withCombatStats(actor, relicIds);
  const defTarget = {
    ...withCombatStats(current, relicIds),
    tempDefBonus: current.tempDefBonus,
  };
  const dmg = calcMoveDamage(
    atkActor,
    defTarget,
    power,
    element,
    current.tempDefBonus ?? 0,
  );
  const hp = Math.max(0, current.hp - dmg);
  let updated: Combatant = { ...current, hp };
  if (dmg > 0) updated = breakFreezeOnHit(updated);
  next = replaceCombatant(next, updated);
  fx.push({ kind: "damage", targetId: current.uid, amount: dmg });
  next = {
    ...next,
    log: pushLog(
      next.log,
      `${actor.name} ${labels.ui.logAttack} ${current.name} (−${dmg})`,
    ),
  };
  if (hp <= 0) {
    fx.push({ kind: "faint", targetId: current.uid });
    next = {
      ...next,
      log: pushLog(next.log, `${current.name} ${labels.ui.logFaint}`),
    };
  }
  return { state: next, fx, dealt: dmg };
}

export function resolveMoveEffects(
  state: BattleState,
  plan: PlannedAction,
  labels: LocaleLabel,
): { state: BattleState; fx: BattleFx[] } {
  let next = state;
  const fx: BattleFx[] = [];
  const actor = findCombatant(next, plan.actorId);
  if (!actor || actor.hp <= 0 || !plan.moveId) return { state: next, fx };

  const move = getMove(plan.moveId);
  const relicIds = state.relicIds ?? [];
  let damageDealt = 0;

  for (const effect of move.effects) {
    const freshActor = findCombatant(next, plan.actorId);
    if (!freshActor || freshActor.hp <= 0) break;

    if (effect.type === "damage") {
      const targets = resolveTargets(
        next,
        freshActor,
        effect.target,
        plan.targetId,
      );
      const element =
        effect.element ?? move.element ?? freshActor.element;
      for (const t of targets) {
        const result = dealDamage(
          next,
          freshActor,
          t,
          effect.power,
          element,
          labels,
          relicIds,
        );
        next = result.state;
        fx.push(...result.fx);
        damageDealt += result.dealt;
      }
      continue;
    }

    if (effect.type === "chain") {
      const foes =
        freshActor.side === "player" ? next.enemies : next.player;
      let living = alive(foes);
      const ordered: Combatant[] = [];
      const first =
        (plan.targetId
          ? living.find((m) => m.uid === plan.targetId)
          : undefined) ?? living[0];
      if (first) {
        ordered.push(first);
        living = living.filter((m) => m.uid !== first.uid);
      }
      while (ordered.length < effect.jumps && living.length > 0) {
        const nextFoe = living[0]!;
        ordered.push(nextFoe);
        living = living.filter((m) => m.uid !== nextFoe.uid);
      }
      let power = effect.power;
      const element =
        effect.element ?? move.element ?? freshActor.element;
      for (let i = 0; i < ordered.length; i += 1) {
        const t = findCombatant(next, ordered[i]!.uid);
        const a = findCombatant(next, plan.actorId);
        if (!t || !a || t.hp <= 0) continue;
        const result = dealDamage(
          next,
          a,
          t,
          power,
          element,
          labels,
          relicIds,
        );
        next = result.state;
        fx.push(...result.fx);
        damageDealt += result.dealt;
        power *= effect.falloff;
      }
      continue;
    }

    if (effect.type === "drain") {
      if (damageDealt <= 0) continue;
      const healAmt = Math.max(
        1,
        Math.round(damageDealt * effect.portion),
      );
      const a = findCombatant(next, plan.actorId);
      if (!a || a.hp <= 0) continue;
      const hp = Math.min(a.maxHp, a.hp + healAmt);
      next = updateCombatant(next, a.uid, { hp });
      fx.push({ kind: "heal", targetId: a.uid, amount: healAmt });
      next = {
        ...next,
        log: pushLog(
          next.log,
          `${a.name} ${labels.ui.logHeal} ${healAmt} HP`,
        ),
      };
      continue;
    }

    if (effect.type === "heal") {
      const targets = resolveTargets(
        next,
        freshActor,
        effect.target,
        plan.targetId,
      );
      for (const t of targets) {
        const cur = findCombatant(next, t.uid);
        if (!cur || cur.hp <= 0) continue;
        const amount = Math.max(
          1,
          Math.round(cur.maxHp * effect.portion),
        );
        const hp = Math.min(cur.maxHp, cur.hp + amount);
        next = updateCombatant(next, cur.uid, { hp });
        fx.push({ kind: "heal", targetId: cur.uid, amount });
        next = {
          ...next,
          log: pushLog(
            next.log,
            `${cur.name} ${labels.ui.logHeal} ${amount} HP`,
          ),
        };
      }
      continue;
    }

    if (effect.type === "buffStat") {
      const targets = resolveTargets(
        next,
        freshActor,
        effect.target,
        plan.targetId,
      );
      for (const t of targets) {
        const cur = findCombatant(next, t.uid);
        if (!cur || cur.hp <= 0) continue;
        const text = `+${effect.amount} ${effect.stat.toUpperCase()}`;
        next = updateCombatant(next, cur.uid, {
          [effect.stat]: cur[effect.stat] + effect.amount,
        });
        fx.push({ kind: "buff", targetId: cur.uid, text });
        next = {
          ...next,
          log: pushLog(
            next.log,
            `${cur.name} ${labels.ui.logBuff} ${text}`,
          ),
        };
      }
      continue;
    }

    if (effect.type === "guard") {
      const targets = resolveTargets(
        next,
        freshActor,
        effect.target,
        plan.targetId,
      );
      for (const t of targets) {
        const cur = findCombatant(next, t.uid);
        if (!cur || cur.hp <= 0) continue;
        const text = `+${effect.defBonus} DEF`;
        next = updateCombatant(next, cur.uid, {
          tempDefBonus: effect.defBonus,
        });
        fx.push({ kind: "guard", targetId: cur.uid, text });
        next = {
          ...next,
          log: pushLog(
            next.log,
            `${cur.name} ${labels.ui.logGuard} ${text}`,
          ),
        };
      }
      continue;
    }

    if (effect.type === "restoreUses") {
      const targets = resolveTargets(
        next,
        freshActor,
        effect.target,
        plan.targetId,
      );
      for (const t of targets) {
        const cur = findCombatant(next, t.uid);
        if (!cur || cur.hp <= 0) continue;
        next = updateCombatant(next, cur.uid, {
          moveUses: initMoveUses(cur.moves),
        });
        fx.push({
          kind: "buff",
          targetId: cur.uid,
          text: "moves",
        });
      }
      continue;
    }

    if (effect.type === "applyStatus") {
      const targets = resolveTargets(
        next,
        freshActor,
        effect.target,
        plan.targetId,
      );
      for (const t of targets) {
        const cur = findCombatant(next, t.uid);
        if (!cur || cur.hp <= 0) continue;
        const updated = applyStatusTo(
          cur,
          effect.status,
          effect.turns,
          effect.potency,
        );
        next = replaceCombatant(next, updated);
        fx.push({
          kind: "status",
          targetId: cur.uid,
          text: effect.status,
        });
        next = {
          ...next,
          log: pushLog(next.log, `${cur.name}: ${effect.status}`),
        };
      }
      continue;
    }

    if (effect.type === "clearStatus") {
      const targets = resolveTargets(
        next,
        freshActor,
        effect.target,
        plan.targetId,
      );
      for (const t of targets) {
        const cur = findCombatant(next, t.uid);
        if (!cur || cur.hp <= 0) continue;
        next = replaceCombatant(
          next,
          clearStatusFrom(cur, effect.status as StatusId | undefined),
        );
      }
    }
  }

  return { state: next, fx };
}

export function estimateEffectDamage(
  actor: Combatant,
  target: Combatant,
  power: number,
  element: Element | undefined,
  relicIds: string[],
): number {
  return estimateMoveDamage(
    withCombatStats(actor, relicIds),
    withCombatStats(target, relicIds),
    power,
    element,
    target.tempDefBonus ?? 0,
  );
}

export { alive, findCombatant, updateCombatant, pushLog, hasStatus, paralysisSkipChance, moveIsOffensive };
