import type { LocaleLabel } from "./content";
import { EARLY_POOL, SPECIES, WILD_POOL } from "./content";
import { HABITAT_POOLS } from "./habitats";
import { getMove, initMoveUses, remainingUses } from "./moves";
import {
  calcMoveDamage,
  createMonster,
  createMonsterById,
  estimateMoveDamage,
  nextUid,
} from "./monsters";
import type {
  BattleKind,
  BattleLogEntry,
  BattleState,
  Combatant,
  HabitatId,
  Monster,
  MoveId,
  NodeType,
  PlannedAction,
} from "./types";

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWild(rng: () => number, column: number) {
  if (column <= 2) {
    const id = EARLY_POOL[Math.floor(rng() * EARLY_POOL.length)] ?? "ember-cub";
    return SPECIES[id];
  }

  const tier = column >= 8 ? 0.45 : column >= 5 ? 0.25 : 0.08;
  const pool = WILD_POOL.filter((id) => {
    const rarity = SPECIES[id].rarity;
    if (rarity === "rare") return rng() < tier;
    if (rarity === "uncommon") return column >= 3 && rng() < 0.4 + tier;
    return true;
  });
  const id = pool[Math.floor(rng() * pool.length)] ?? "ember-cub";
  return SPECIES[id];
}

function softenEnemy(monster: Monster, column: number, nodeType: NodeType): Monster {
  if (nodeType === "boss") return monster;
  if (nodeType === "elite") {
    const maxHp = Math.max(14, Math.round(monster.maxHp * 0.88));
    return {
      ...monster,
      maxHp,
      hp: maxHp,
      atk: Math.max(4, Math.round(monster.atk * 0.9)),
      def: Math.max(2, Math.round(monster.def * 0.92)),
    };
  }
  const factor = column <= 2 ? 0.72 : column <= 4 ? 0.85 : 1;
  if (factor >= 1) return monster;
  const maxHp = Math.max(12, Math.round(monster.maxHp * factor));
  return {
    ...monster,
    maxHp,
    hp: maxHp,
    atk: Math.max(4, Math.round(monster.atk * factor)),
    def: Math.max(2, Math.round(monster.def * 0.9)),
  };
}

export function buildEncounter(
  nodeType: NodeType,
  column: number,
  seed: number,
  labels: LocaleLabel,
): Monster[] {
  const rng = mulberry32(seed);
  if (nodeType === "boss") {
    const boss = createMonster(
      SPECIES["boss-hydra"],
      4 + Math.floor(column / 5),
      labels,
    );
    // Tuned for a multi-round fight: party should survive hits and chip meaningfully.
    const maxHp = Math.max(80, Math.round(boss.maxHp * 0.9));
    return [
      {
        ...boss,
        maxHp,
        hp: maxHp,
        atk: Math.max(5, Math.round(boss.atk * 0.75)),
        def: Math.max(3, Math.round(boss.def * 0.7)),
      },
    ];
  }

  if (column <= 2 && nodeType === "battle") {
    const species = pickWild(rng, column);
    return [softenEnemy(createMonster(species, 1, labels), column, nodeType)];
  }

  const count =
    nodeType === "elite" ? 2 : 1 + (rng() > 0.65 && column > 4 ? 1 : 0);
  // Elites stay a bit above normal fights, but not a full level spike.
  const levelBase =
    nodeType === "elite"
      ? 1 + Math.max(0, Math.floor(column * 0.3))
      : 1 + Math.max(0, Math.floor((column - 1) * 0.35));

  return Array.from({ length: count }, (_, i) => {
    const species = pickWild(rng, column);
    const level =
      nodeType === "elite" ? levelBase : levelBase + i;
    return softenEnemy(
      createMonster(species, level, labels),
      column,
      nodeType,
    );
  });
}

/** Single wild creature from a habitat pool (slightly weaker than enemy fights). */
export function buildWildEncounter(
  habitat: HabitatId,
  column: number,
  seed: number,
  labels: LocaleLabel,
): Monster[] {
  const rng = mulberry32(seed);
  const pool = HABITAT_POOLS[habitat];
  const filtered = pool.filter((id) => {
    const rarity = SPECIES[id].rarity;
    if (rarity === "rare") return column >= 6 && rng() < 0.35;
    if (rarity === "uncommon") return column >= 3;
    return true;
  });
  const id =
    (filtered.length > 0 ? filtered : pool)[
      Math.floor(rng() * (filtered.length > 0 ? filtered.length : pool.length))
    ] ?? pool[0] ??
    "ember-cub";
  const enemyBase = 1 + Math.max(0, Math.floor((column - 1) * 0.35));
  const level = Math.max(1, enemyBase - 1);
  const monster = createMonster(SPECIES[id], level, labels);
  return [softenEnemy(monster, column, "battle")];
}

function toCombatant(monster: Monster, side: "player" | "enemy"): Combatant {
  return { ...monster, side, tempDefBonus: 0 };
}

function alive(list: Combatant[]) {
  return list.filter((m) => m.hp > 0);
}

export function previewTurnOrder(player: Combatant[], enemies: Combatant[]) {
  return [...alive(player), ...alive(enemies)]
    .sort((a, b) => b.spd - a.spd || a.uid.localeCompare(b.uid))
    .map((m) => m.uid);
}

function pushLog(log: BattleLogEntry[], text: string): BattleLogEntry[] {
  return [...log, { id: nextUid("log"), text }].slice(-12);
}

function clearTempMods(list: Combatant[]): Combatant[] {
  return list.map((m) => ({ ...m, tempDefBonus: 0 }));
}

function rollEnemyPlans(
  player: Combatant[],
  enemies: Combatant[],
  seed: number,
  simpleAi = false,
): Record<string, PlannedAction> {
  const rng = mulberry32(seed);
  const plans: Record<string, PlannedAction> = {};
  for (const enemy of alive(enemies)) {
    plans[enemy.uid] = pickEnemyPlan(enemy, player, enemies, rng, simpleAi);
  }
  return plans;
}

export function startBattle(
  party: Monster[],
  enemies: Monster[],
  goldReward: number,
  labels: LocaleLabel,
  seed = Date.now(),
  options?: { kind?: BattleKind; habitat?: HabitatId | null },
): BattleState {
  const battleKind = options?.kind ?? "enemy";
  const habitat = options?.habitat ?? null;
  const player = clearTempMods(party.map((m) => toCombatant({ ...m }, "player")));
  const foe = clearTempMods(enemies.map((m) => toCombatant({ ...m }, "enemy")));
  return {
    player,
    enemies: foe,
    phase: "planning",
    battleKind,
    habitat,
    plans: {},
    enemyPlans: rollEnemyPlans(player, foe, seed, battleKind === "wild"),
    captureAttempt: false,
    turnOrder: previewTurnOrder(player, foe),
    log: pushLog([], labels.ui.yourTurn),
    goldReward,
    capturedMonster: null,
  };
}

/** Attacks and heals need an explicit target pick; buffs/guard always hit self. */
export function moveRequiresTargetChoice(moveId: MoveId): boolean {
  const move = getMove(moveId);
  if (move.kind === "attack") return true;
  if (move.effect?.type === "heal") return true;
  return false;
}

export function validTargetsForMove(
  state: BattleState,
  actorId: string,
  moveId: MoveId,
): Combatant[] {
  const actor = findCombatant(state, actorId);
  if (!actor || actor.hp <= 0) return [];
  const move = getMove(moveId);
  const allies = actor.side === "player" ? state.player : state.enemies;
  const foes = actor.side === "player" ? state.enemies : state.player;

  if (move.kind === "attack") {
    return alive(foes);
  }
  if (move.effect?.type === "heal") {
    return alive(allies);
  }
  // buff / guard: self only
  return [actor];
}

export type MovePreview =
  | { kind: "damage"; amount: number; text: string }
  | { kind: "heal"; amount: number; text: string }
  | { kind: "buff"; stat: string; amount: number; text: string }
  | { kind: "guard"; amount: number; text: string }
  | { kind: "other"; text: string };

export function previewMoveOnTarget(
  actor: Combatant,
  target: Combatant,
  moveId: MoveId,
  labels: LocaleLabel,
): MovePreview {
  const move = getMove(moveId);
  if (move.kind === "attack") {
    const element = move.element ?? actor.element;
    const power = move.power ?? 1;
    const dmg = estimateMoveDamage(
      actor,
      target,
      power,
      element,
      target.tempDefBonus ?? 0,
    );
    return {
      kind: "damage",
      amount: dmg,
      text: `−${dmg} HP`,
    };
  }
  const effect = move.effect;
  if (!effect) {
    return { kind: "other", text: labels.moves[moveId].description };
  }
  if (effect.type === "heal") {
    const amount = Math.max(1, Math.round(target.maxHp * effect.portion));
    return {
      kind: "heal",
      amount,
      text: `+${amount} HP`,
    };
  }
  if (effect.type === "buffStat") {
    const stat = effect.stat.toUpperCase();
    return {
      kind: "buff",
      stat,
      amount: effect.amount,
      text: `+${effect.amount} ${stat}`,
    };
  }
  if (effect.type === "guard") {
    return {
      kind: "guard",
      amount: effect.defBonus,
      text: `+${effect.defBonus} DEF`,
    };
  }
  return { kind: "other", text: labels.moves[moveId].description };
}

/** Where a plan would actually land right now (accounts for fainted targets). */
function effectivePlanTargetId(
  state: BattleState,
  plan: PlannedAction,
): string | null {
  if (!plan.moveId) return null;
  const actor = findCombatant(state, plan.actorId);
  if (!actor || actor.hp <= 0) return null;

  const move = getMove(plan.moveId);
  if (move.kind === "attack") {
    const foes = actor.side === "player" ? state.enemies : state.player;
    const living = alive(foes);
    return (
      (plan.targetId
        ? living.find((m) => m.uid === plan.targetId)?.uid
        : undefined) ??
      [...living].sort(
        (a, b) => a.hp - b.hp || a.uid.localeCompare(b.uid),
      )[0]?.uid ??
      null
    );
  }

  if (move.effect?.type === "heal") {
    const allies = actor.side === "player" ? state.player : state.enemies;
    const living = alive(allies);
    return (
      (plan.targetId
        ? living.find((m) => m.uid === plan.targetId)?.uid
        : undefined) ??
      [...living].sort(
        (a, b) =>
          a.hp / a.maxHp - b.hp / b.maxHp || a.uid.localeCompare(b.uid),
      )[0]?.uid ??
      null
    );
  }

  // Buff / guard: self (or planned ally if still alive).
  if (plan.targetId) {
    const planned = findCombatant(state, plan.targetId);
    if (planned && planned.hp > 0) return planned.uid;
  }
  return actor.uid;
}

/** Effects from confirmed player plans and previewed enemy plans. */
export function plannedEffectsOn(
  state: BattleState,
  targetId: string,
  labels: LocaleLabel,
  options?: { excludeActorId?: string | null },
): MovePreview[] {
  const target = findCombatant(state, targetId);
  if (!target) return [];
  const out: MovePreview[] = [];
  const allPlans = [
    ...Object.values(state.plans),
    ...Object.values(state.enemyPlans),
  ];
  for (const plan of allPlans) {
    if (!plan.moveId) continue;
    if (options?.excludeActorId && plan.actorId === options.excludeActorId) {
      continue;
    }
    if (effectivePlanTargetId(state, plan) !== targetId) continue;
    const actor = findCombatant(state, plan.actorId);
    if (!actor || actor.hp <= 0) continue;
    out.push(previewMoveOnTarget(actor, target, plan.moveId, labels));
  }
  return out;
}

function dropActorPlan(state: BattleState, actorId: string): BattleState {
  const { [actorId]: _playerPlan, ...plans } = state.plans;
  const { [actorId]: _enemyPlan, ...enemyPlans } = state.enemyPlans;
  return { ...state, plans, enemyPlans };
}

export function clearPlan(state: BattleState, actorId: string): BattleState {
  if (state.phase !== "planning" || !state.plans[actorId]) return state;
  const { [actorId]: _removed, ...plans } = state.plans;
  return {
    ...state,
    plans,
    turnOrder: previewTurnOrder(state.player, state.enemies),
  };
}

export function setPlan(
  state: BattleState,
  actorId: string,
  moveId: MoveId,
  targetId: string | null,
): BattleState {
  if (state.phase !== "planning") return state;
  const actor = state.player.find((m) => m.uid === actorId && m.hp > 0);
  if (!actor || !actor.moves.includes(moveId)) return state;
  if (remainingUses(actor.moveUses, moveId) <= 0) return state;

  const targets = validTargetsForMove(state, actorId, moveId);
  if (targets.length === 0) return state;

  let resolvedTarget: string | null;
  if (!moveRequiresTargetChoice(moveId)) {
    resolvedTarget = actor.uid;
  } else {
    // Never auto-pick: attacks/heals must name an explicit living target.
    if (!targetId || !targets.some((t) => t.uid === targetId)) return state;
    resolvedTarget = targetId;
  }

  return {
    ...state,
    plans: {
      ...state.plans,
      [actorId]: { actorId, moveId, targetId: resolvedTarget },
    },
    captureAttempt: false,
    turnOrder: previewTurnOrder(state.player, state.enemies),
  };
}

export function setSkipPlan(state: BattleState, actorId: string): BattleState {
  if (state.phase !== "planning") return state;
  const actor = state.player.find((m) => m.uid === actorId && m.hp > 0);
  if (!actor) return state;
  return {
    ...state,
    plans: {
      ...state.plans,
      [actorId]: { actorId, moveId: null, targetId: null },
    },
    captureAttempt: false,
    turnOrder: previewTurnOrder(state.player, state.enemies),
  };
}

export function canFight(state: BattleState): boolean {
  if (state.phase !== "planning") return false;
  const living = alive(state.player);
  if (living.length === 0) return false;
  if (state.captureAttempt) {
    return (
      state.battleKind === "wild" && alive(state.enemies).length > 0
    );
  }
  return living.every((m) => {
    const plan = state.plans[m.uid];
    if (!plan) return false;
    if (plan.moveId === null) return true;
    if (remainingUses(m.moveUses, plan.moveId) <= 0) return false;
    return Boolean(plan.targetId);
  });
}

export function setCaptureAttempt(
  state: BattleState,
  enabled: boolean,
): BattleState {
  if (state.phase !== "planning" || state.battleKind !== "wild") return state;
  if (!enabled) {
    return { ...state, captureAttempt: false };
  }
  return {
    ...state,
    captureAttempt: true,
    plans: {},
  };
}

/** Capture chance: 50% at full HP → ~90% near faint. */
export function captureChance(hp: number, maxHp: number) {
  const ratio = Math.max(0, Math.min(1, hp / Math.max(1, maxHp)));
  return Math.max(0.5, Math.min(0.9, 0.5 + 0.4 * (1 - ratio)));
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

function pickEnemyPlan(
  enemy: Combatant,
  players: Combatant[],
  allies: Combatant[],
  rng: () => number,
  simpleAi = false,
): PlannedAction {
  const usable = enemy.moves.filter((id) => remainingUses(enemy.moveUses, id) > 0);
  const pool = usable.length > 0 ? usable : enemy.moves;
  const attackMoves = pool.filter((id) => getMove(id).kind === "attack");
  const supportMoves = pool.filter((id) => getMove(id).kind === "passive");

  const livingPlayers = alive(players);
  const livingAllies = alive(allies);
  const foeTarget = simpleAi
    ? livingPlayers[Math.floor(rng() * livingPlayers.length)] ??
      livingPlayers[0]
    : ([...livingPlayers].sort((a, b) => a.hp - b.hp)[0] ?? livingPlayers[0]);

  // Wild AI: almost always attacks; rare support only when low.
  const supportChance = simpleAi ? 0.1 : 0.35;
  const lowHp = enemy.hp / enemy.maxHp < 0.4;
  if (lowHp && supportMoves.length > 0 && rng() < supportChance) {
    const healOrBuff =
      supportMoves.find((id) => getMove(id).effect?.type === "heal") ??
      supportMoves[Math.floor(rng() * supportMoves.length)];
    const move = getMove(healOrBuff);
    const targetId =
      move.effect?.type === "heal"
        ? ([...livingAllies].sort((a, b) => a.hp - b.hp)[0]?.uid ?? enemy.uid)
        : enemy.uid;
    return { actorId: enemy.uid, moveId: healOrBuff, targetId };
  }

  const moveId =
    attackMoves[Math.floor(rng() * attackMoves.length)] ??
    pool[0] ??
    "scratch";
  const move = getMove(moveId);
  if (move.kind === "attack") {
    return {
      actorId: enemy.uid,
      moveId,
      targetId: foeTarget?.uid ?? null,
    };
  }
  return {
    actorId: enemy.uid,
    moveId,
    targetId:
      move.effect?.type === "heal"
        ? (livingAllies[0]?.uid ?? enemy.uid)
        : enemy.uid,
  };
}

function consumeMoveUse(actor: Combatant, moveId: MoveId): Combatant {
  const current = remainingUses(actor.moveUses, moveId);
  return {
    ...actor,
    moveUses: {
      ...actor.moveUses,
      [moveId]: Math.max(0, current - 1),
    },
  };
}

export type BattleFx =
  | { kind: "act"; actorId: string; moveId: MoveId | null }
  | { kind: "damage"; targetId: string; amount: number }
  | { kind: "heal"; targetId: string; amount: number }
  | { kind: "buff"; targetId: string; text: string }
  | { kind: "guard"; targetId: string; text: string }
  | { kind: "faint"; targetId: string }
  | { kind: "capture"; targetId: string; success: boolean };

export type FightStep = {
  actorId: string;
  /** Snapshot before this action (previews still include this actor). */
  before: BattleState;
  /** Snapshot after this action (plan cleared, HP updated). */
  battle: BattleState;
  fx: BattleFx[];
};

function resolveAction(
  state: BattleState,
  plan: PlannedAction,
  labels: LocaleLabel,
): { state: BattleState; fx: BattleFx[] } {
  let next = state;
  const fx: BattleFx[] = [];
  const actor = findCombatant(next, plan.actorId);
  if (!actor || actor.hp <= 0) return { state: next, fx };

  fx.push({ kind: "act", actorId: actor.uid, moveId: plan.moveId });

  if (plan.moveId === null) {
    next = {
      ...next,
      log: pushLog(next.log, `${actor.name} ${labels.ui.logSkip}`),
    };
    return { state: next, fx };
  }

  if (remainingUses(actor.moveUses, plan.moveId) <= 0) {
    next = {
      ...next,
      log: pushLog(
        next.log,
        `${actor.name}: ${labels.ui.noUses} (${labels.moves[plan.moveId].name})`,
      ),
    };
    return { state: next, fx };
  }

  const spent = consumeMoveUse(actor, plan.moveId);
  next = updateCombatant(next, actor.uid, {
    moveUses: spent.moveUses,
  });
  const freshActor = findCombatant(next, plan.actorId)!;

  const move = getMove(plan.moveId);
  const moveName = labels.moves[plan.moveId].name;
  next = {
    ...next,
    log: pushLog(next.log, `${freshActor.name} ${labels.ui.logUses} ${moveName}`),
  };

  if (move.kind === "attack") {
    const foes = freshActor.side === "player" ? next.enemies : next.player;
    const livingFoes = alive(foes);
    // Retarget if the planned foe already fainted this round.
    const target =
      (plan.targetId
        ? livingFoes.find((m) => m.uid === plan.targetId)
        : undefined) ??
      [...livingFoes].sort(
        (a, b) => a.hp - b.hp || a.uid.localeCompare(b.uid),
      )[0] ??
      null;
    if (!target) return { state: next, fx };

    const element = move.element ?? freshActor.element;
    const power = move.power ?? 1;
    const dmg = calcMoveDamage(
      freshActor,
      target,
      power,
      element,
      target.tempDefBonus ?? 0,
    );
    const hp = Math.max(0, target.hp - dmg);
    next = updateCombatant(next, target.uid, { hp });
    fx.push({ kind: "damage", targetId: target.uid, amount: dmg });
    next = {
      ...next,
      log: pushLog(
        next.log,
        `${freshActor.name} ${labels.ui.logAttack} ${target.name} (−${dmg})`,
      ),
    };
    if (hp <= 0) {
      fx.push({ kind: "faint", targetId: target.uid });
      next = {
        ...next,
        log: pushLog(next.log, `${target.name} ${labels.ui.logFaint}`),
      };
    }
    return { state: next, fx };
  }

  const effect = move.effect;
  if (!effect) return { state: next, fx };

  const sideAllies = freshActor.side === "player" ? next.player : next.enemies;
  const livingAllies = alive(sideAllies);

  if (effect.type === "heal") {
    // Never heal a fainted beast — pick another living ally if needed.
    const target =
      (plan.targetId
        ? livingAllies.find((m) => m.uid === plan.targetId)
        : undefined) ??
      [...livingAllies].sort(
        (a, b) =>
          a.hp / a.maxHp - b.hp / b.maxHp || a.uid.localeCompare(b.uid),
      )[0] ??
      null;
    if (!target) return { state: next, fx };

    const amount = Math.max(1, Math.round(target.maxHp * effect.portion));
    const hp = Math.min(target.maxHp, target.hp + amount);
    next = updateCombatant(next, target.uid, { hp });
    fx.push({ kind: "heal", targetId: target.uid, amount });
    next = {
      ...next,
      log: pushLog(next.log, `${target.name} ${labels.ui.logHeal} ${amount} HP`),
    };
    return { state: next, fx };
  }

  let targetId = plan.targetId;
  if (!targetId || !livingAllies.some((m) => m.uid === targetId)) {
    targetId =
      freshActor.hp > 0 ? freshActor.uid : (livingAllies[0]?.uid ?? null);
  }
  if (!targetId) return { state: next, fx };
  const target = findCombatant(next, targetId);
  if (!target || target.hp <= 0) return { state: next, fx };

  if (effect.type === "buffStat") {
    const text = `+${effect.amount} ${effect.stat.toUpperCase()}`;
    next = updateCombatant(next, target.uid, {
      [effect.stat]: target[effect.stat] + effect.amount,
    });
    fx.push({ kind: "buff", targetId: target.uid, text });
    next = {
      ...next,
      log: pushLog(
        next.log,
        `${target.name} ${labels.ui.logBuff} ${text}`,
      ),
    };
    return { state: next, fx };
  }

  if (effect.type === "guard") {
    const text = `+${effect.defBonus} DEF`;
    next = updateCombatant(next, target.uid, {
      tempDefBonus: (target.tempDefBonus ?? 0) + effect.defBonus,
    });
    fx.push({ kind: "guard", targetId: target.uid, text });
    next = {
      ...next,
      log: pushLog(
        next.log,
        `${target.name} ${labels.ui.logGuard} (${text})`,
      ),
    };
  }

  return { state: next, fx };
}

function toCapturedMonster(foe: Combatant): Monster {
  const { side: _s, tempDefBonus: _t, ...rest } = foe;
  return {
    ...rest,
    uid: nextUid("cap"),
    hp: Math.max(1, rest.hp),
    moveUses: { ...initMoveUses(rest.moves) },
  };
}

function resolveCaptureAttempt(
  state: BattleState,
  labels: LocaleLabel,
  seed: number,
): { state: BattleState; fx: BattleFx[]; actorId: string } {
  const target = alive(state.enemies)[0];
  if (!target) {
    return { state, fx: [], actorId: "capture" };
  }

  const rng = mulberry32(seed);
  const chance = captureChance(target.hp, target.maxHp);
  const success = rng() < chance;
  const fx: BattleFx[] = [
    { kind: "capture", targetId: target.uid, success },
  ];

  if (success) {
    const captured = toCapturedMonster(target);
    const next: BattleState = {
      ...state,
      enemies: state.enemies.map((m) =>
        m.uid === target.uid ? { ...m, hp: 0 } : m,
      ),
      phase: "won",
      plans: {},
      enemyPlans: {},
      captureAttempt: false,
      capturedMonster: captured,
      log: pushLog(
        state.log,
        `${target.name} ${labels.ui.captureSuccess}`,
      ),
    };
    return { state: next, fx, actorId: "capture" };
  }

  const next: BattleState = {
    ...state,
    log: pushLog(state.log, `${target.name} ${labels.ui.captureFail}`),
  };
  return { state: next, fx, actorId: "capture" };
}

function checkOutcome(state: BattleState, labels: LocaleLabel): BattleState {
  const playersAlive = alive(state.player);
  const enemiesAlive = alive(state.enemies);

  if (enemiesAlive.length === 0) {
    return {
      ...state,
      phase: "won",
      plans: {},
      enemyPlans: {},
      captureAttempt: false,
      // KO ends wild fights with no capture — only captureAttempt success sets capturedMonster.
      log: pushLog(state.log, labels.ui.victoryBattle),
    };
  }

  if (playersAlive.length === 0) {
    return {
      ...state,
      phase: "lost",
      plans: {},
      enemyPlans: {},
      captureAttempt: false,
      log: pushLog(state.log, labels.ui.defeatBattle),
    };
  }

  return state;
}

/** Builds per-action snapshots for sequential battle playback. */
export function buildFightTimeline(
  state: BattleState,
  labels: LocaleLabel,
  seed = Date.now(),
): { steps: FightStep[]; final: BattleState } | null {
  if (!canFight(state)) return null;

  let next: BattleState = {
    ...state,
    phase: "resolving",
    player: clearTempMods(state.player),
    enemies: clearTempMods(state.enemies),
    log: pushLog(state.log, labels.ui.resolving),
  };

  const steps: FightStep[] = [];
  const simpleAi = state.battleKind === "wild";

  if (state.captureAttempt) {
    const beforeCapture = next;
    const capture = resolveCaptureAttempt(next, labels, seed + 7);
    next = dropActorPlan(capture.state, capture.actorId);
    steps.push({
      actorId: capture.actorId,
      before: beforeCapture,
      battle: next,
      fx: capture.fx,
    });
    if (next.phase === "won" || next.phase === "lost") {
      return { steps, final: next };
    }

    // On fail, only the wild beast acts (party resigned the round).
    const order = previewTurnOrder(next.player, next.enemies).filter((uid) =>
      next.enemies.some((e) => e.uid === uid),
    );
    next = { ...next, turnOrder: order };
    for (const uid of order) {
      const plan = state.enemyPlans[uid];
      if (!plan) continue;
      const before = next;
      const result = resolveAction(next, plan, labels);
      next = dropActorPlan(checkOutcome(result.state, labels), uid);
      steps.push({ actorId: uid, before, battle: next, fx: result.fx });
      if (next.phase === "won" || next.phase === "lost") {
        return { steps, final: next };
      }
    }

    const final: BattleState = {
      ...next,
      phase: "planning",
      plans: {},
      captureAttempt: false,
      enemyPlans: rollEnemyPlans(
        next.player,
        next.enemies,
        seed + 41,
        simpleAi,
      ),
      turnOrder: previewTurnOrder(next.player, next.enemies),
      log: pushLog(next.log, labels.ui.yourTurn),
    };
    return { steps, final };
  }

  const allPlans: PlannedAction[] = [
    ...Object.values(state.plans),
    ...Object.values(state.enemyPlans),
  ];

  const order = previewTurnOrder(next.player, next.enemies);
  next = { ...next, turnOrder: order };

  for (const uid of order) {
    const plan = allPlans.find((p) => p.actorId === uid);
    if (!plan) continue;
    const before = next;
    const result = resolveAction(next, plan, labels);
    next = dropActorPlan(checkOutcome(result.state, labels), uid);
    steps.push({ actorId: uid, before, battle: next, fx: result.fx });
    if (next.phase === "won" || next.phase === "lost") {
      return { steps, final: next };
    }
  }

  const final: BattleState = {
    ...next,
    phase: "planning",
    plans: {},
    captureAttempt: false,
    enemyPlans: rollEnemyPlans(next.player, next.enemies, seed + 41, simpleAi),
    turnOrder: previewTurnOrder(next.player, next.enemies),
    log: pushLog(next.log, labels.ui.yourTurn),
  };
  return { steps, final };
}

export function executeFightRound(
  state: BattleState,
  labels: LocaleLabel,
  seed = Date.now(),
): BattleState {
  return buildFightTimeline(state, labels, seed)?.final ?? state;
}

/** Short impact line for move buttons (damage / heal / buff). */
export function moveImpactHint(
  state: BattleState,
  actorId: string,
  moveId: MoveId,
  labels: LocaleLabel,
  preferredTargetId?: string | null,
): string | null {
  const actor = findCombatant(state, actorId);
  if (!actor) return null;
  const move = getMove(moveId);
  const targets = validTargetsForMove(state, actorId, moveId);
  if (targets.length === 0) return null;

  const preferred =
    (preferredTargetId &&
      targets.find((t) => t.uid === preferredTargetId)) ||
    null;
  const target =
    preferred ??
    (move.kind === "attack"
      ? targets[0]
      : (targets.find((t) => t.uid === actor.uid) ?? targets[0]));
  if (!target) return null;

  const preview = previewMoveOnTarget(actor, target, moveId, labels);
  if (preview.kind === "damage") return `~${preview.amount}`;
  if (preview.kind === "heal") return `+${preview.amount}`;
  if (preview.kind === "buff" || preview.kind === "guard") return preview.text;
  return null;
}

export function rewardGoldFor(nodeType: NodeType, column: number) {
  if (nodeType === "boss") return 80;
  if (nodeType === "elite") return 35 + column * 3;
  if (nodeType === "habitat") return 10 + column * 2;
  return 14 + column * 2;
}

export function makeShopRecruit(seed: number, column: number, labels: LocaleLabel) {
  const rng = mulberry32(seed);
  const species = pickWild(rng, column + 1);
  return createMonster(species, 1 + Math.floor(column * 0.35), labels);
}

export function randomStarterOptions(labels: LocaleLabel) {
  return [
    createMonsterById("ember-cub", 1, labels),
    createMonsterById("tide-sprite", 1, labels),
    createMonsterById("gale-finch", 1, labels),
  ].map((m) => {
    const maxHp = Math.round(m.maxHp * 1.35);
    return {
      ...m,
      maxHp,
      hp: maxHp,
      atk: m.atk + 2,
      def: m.def + 1,
    };
  });
}
