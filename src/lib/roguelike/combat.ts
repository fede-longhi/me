import type { LocaleLabel } from "./content";
import {
  EARLY_POOL,
  getRegion,
  RELICS,
  SPECIES,
  SPECIES_IDS,
  STARTER_IDS,
  WILD_POOL,
} from "./content";
import { getItem } from "./content/items";
import {
  relicBattleStartHeal,
  relicStatBonus,
} from "./content/relics/compute";
import {
  captureChance as tableCaptureChance,
  rewardGoldFor as tableRewardGoldFor,
} from "./content/rewards/tables";
import {
  combatSpd,
  resolveMoveEffects,
  type BattleFx,
} from "./combatEffects";
import { HABITAT_POOLS } from "./habitats";
import { applyItemEffectsToParty } from "./items";
import {
  getMove,
  initMoveUses,
  moveIsOffensive,
  moveNeedsTargetChoice,
  remainingUses,
} from "./moves";
import {
  createMonster,
  createMonsterById,
  nextUid,
} from "./monsters";
import {
  hasStatus,
  paralysisSkipChance,
  tickStatusesAfterAction,
} from "./status";
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
  RegionId,
} from "./types";
import { estimateEffectDamage } from "./combatEffects";

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function fallbackSpecies() {
  const id =
    STARTER_IDS.find((candidate) => SPECIES[candidate]) ??
    SPECIES_IDS.find((candidate) => SPECIES[candidate]) ??
    Object.keys(SPECIES)[0];
  return SPECIES[id!];
}

function pickWild(rng: () => number, column: number, regionId?: RegionId) {
  const region = regionId ? getRegion(regionId) : undefined;
  const earlySource =
    region?.earlyCreatures && region.earlyCreatures.length > 0
      ? region.earlyCreatures
      : region?.creatures && region.creatures.length > 0
        ? region.creatures
        : EARLY_POOL;
  const wildSource =
    region?.creatures && region.creatures.length > 0
      ? region.creatures
      : WILD_POOL;

  if (column <= 2) {
    const early = earlySource.filter((id) => SPECIES[id]);
    const id = early[Math.floor(rng() * early.length)];
    return (id ? SPECIES[id] : null) ?? fallbackSpecies();
  }

  const tier = column >= 8 ? 0.45 : column >= 5 ? 0.25 : 0.08;
  const pool = wildSource.filter((id) => SPECIES[id]).filter((id) => {
    const rarity = SPECIES[id].rarity;
    if (rarity === "boss") return false;
    if (rarity === "rare") return rng() < tier;
    if (rarity === "uncommon") return column >= 3 && rng() < 0.4 + tier;
    return true;
  });
  const id = pool[Math.floor(rng() * pool.length)] ?? wildSource[0] ?? "ember-cub";
  return SPECIES[id] ?? fallbackSpecies();
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
  runLevel = 1,
  regionId?: RegionId,
): Monster[] {
  const rng = mulberry32(seed);
  const boost = Math.max(0, runLevel - 1);

  if (nodeType === "boss") {
    const region = regionId ? getRegion(regionId) : undefined;
    const bossPool = (region?.bosses ?? []).filter((id) => SPECIES[id]);
    const bossId =
      bossPool[Math.floor(rng() * bossPool.length)] ??
      SPECIES_IDS.find((id) => SPECIES[id]?.rarity === "boss");
    const boss = createMonster(
      (bossId ? SPECIES[bossId] : null) ?? fallbackSpecies(),
      4 + Math.floor(column / 5) + boost * 2,
      labels,
    );
    // Tuned for a multi-round fight; later paths hit harder.
    const hpMult = 0.9 + boost * 0.28;
    const atkMult = 0.75 + boost * 0.14;
    const defMult = 0.7 + boost * 0.12;
    const maxHp = Math.max(80, Math.round(boss.maxHp * hpMult));
    return [
      {
        ...boss,
        maxHp,
        hp: maxHp,
        atk: Math.max(5, Math.round(boss.atk * atkMult)),
        def: Math.max(3, Math.round(boss.def * defMult)),
      },
    ];
  }

  if (column <= 2 && nodeType === "battle") {
    const species = pickWild(rng, column, regionId);
    return [
      softenEnemy(
        createMonster(species, 1 + boost, labels),
        column,
        nodeType,
      ),
    ];
  }

  const count =
    nodeType === "elite"
      ? 2 + (boost > 0 && rng() > 0.55 ? 1 : 0)
      : 1 + (rng() > 0.65 && column > 4 ? 1 : 0);
  // Elites stay a bit above normal fights, but not a full level spike.
  const levelBase =
    (nodeType === "elite"
      ? 1 + Math.max(0, Math.floor(column * 0.3))
      : 1 + Math.max(0, Math.floor((column - 1) * 0.35))) + boost;

  return Array.from({ length: count }, (_, i) => {
    const species = pickWild(rng, column, regionId);
    const level = nodeType === "elite" ? levelBase : levelBase + i;
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
  runLevel = 1,
): Monster[] {
  const rng = mulberry32(seed);
  const pool = (HABITAT_POOLS[habitat] ?? []).filter((id) => SPECIES[id]);
  const filtered = pool.filter((id) => {
    const rarity = SPECIES[id].rarity;
    if (rarity === "rare") return column >= 6 && rng() < 0.35;
    if (rarity === "uncommon") return column >= 3;
    return true;
  });
  const id =
    (filtered.length > 0 ? filtered : pool)[
      Math.floor(rng() * (filtered.length > 0 ? filtered.length : pool.length))
    ];
  const enemyBase = 1 + Math.max(0, Math.floor((column - 1) * 0.35));
  const boost = Math.max(0, runLevel - 1);
  const level = Math.max(1, enemyBase - 1 + boost);
  const monster = createMonster(
    (id ? SPECIES[id] : null) ?? fallbackSpecies(),
    level,
    labels,
  );
  return [softenEnemy(monster, column, "battle")];
}

function toCombatant(monster: Monster, side: "player" | "enemy"): Combatant {
  return { ...monster, side, tempDefBonus: 0, statuses: [] };
}

function alive(list: Combatant[]) {
  return list.filter((m) => m.hp > 0);
}

export function previewTurnOrder(
  player: Combatant[],
  enemies: Combatant[],
  relicIds: string[] = [],
) {
  return [...alive(player), ...alive(enemies)]
    .sort(
      (a, b) =>
        combatSpd(b, relicIds) - combatSpd(a, relicIds) ||
        a.uid.localeCompare(b.uid),
    )
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
  options?: {
    kind?: BattleKind;
    habitat?: HabitatId | null;
    relicIds?: string[];
  },
): BattleState {
  const battleKind = options?.kind ?? "enemy";
  const habitat = options?.habitat ?? null;
  const relicIds = options?.relicIds ?? [];
  let player = clearTempMods(party.map((m) => toCombatant({ ...m }, "player")));
  let foe = clearTempMods(enemies.map((m) => toCombatant({ ...m }, "enemy")));
  const maxHpBonus = relicStatBonus(relicIds, RELICS, "maxHp");
  if (maxHpBonus !== 0) {
    player = player.map((m) => {
      const maxHp = Math.max(1, m.maxHp + maxHpBonus);
      return {
        ...m,
        maxHp,
        hp: Math.min(maxHp, m.hp + Math.max(0, maxHpBonus)),
      };
    });
  }
  const healPortion = relicBattleStartHeal(relicIds, RELICS);
  if (healPortion > 0) {
    player = player.map((m) => {
      const amount = Math.max(1, Math.round(m.maxHp * healPortion));
      return { ...m, hp: Math.min(m.maxHp, m.hp + amount) };
    });
  }
  return {
    player,
    enemies: foe,
    phase: "planning",
    battleKind,
    habitat,
    plans: {},
    enemyPlans: rollEnemyPlans(player, foe, seed, battleKind === "wild"),
    captureAttempt: false,
    pendingItemId: null,
    pendingItemSlot: null,
    turnOrder: previewTurnOrder(player, foe, relicIds),
    log: pushLog([], labels.ui.yourTurn),
    goldReward,
    capturedMonster: null,
    relicIds,
  };
}

/** Moves that need an explicit living ally/foe pick. */
export function moveRequiresTargetChoice(moveId: MoveId): boolean {
  return moveNeedsTargetChoice(getMove(moveId));
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

  if (!moveNeedsTargetChoice(move)) return [actor];

  const needsFoe = move.effects.some(
    (e) =>
      e.type === "chain" ||
      (e.type === "damage" && e.target === "foe") ||
      (e.type === "applyStatus" && e.target === "foe"),
  );
  const needsAlly = move.effects.some(
    (e) =>
      (e.type === "heal" && e.target === "ally") ||
      (e.type === "buffStat" && e.target === "ally") ||
      (e.type === "restoreUses" && e.target === "ally") ||
      (e.type === "applyStatus" && e.target === "ally") ||
      (e.type === "clearStatus" && e.target === "ally"),
  );
  if (needsFoe) return alive(foes);
  if (needsAlly) return alive(allies);
  return [actor];
}

export type MovePreview =
  | { kind: "damage"; amount: number; text: string }
  | { kind: "heal"; amount: number; text: string }
  | { kind: "buff"; stat: string; amount: number; text: string }
  | { kind: "guard"; amount: number; text: string }
  | { kind: "status"; text: string }
  | { kind: "other"; text: string };

export function previewMoveOnTarget(
  actor: Combatant,
  target: Combatant,
  moveId: MoveId,
  labels: LocaleLabel,
  relicIds: string[] = [],
): MovePreview {
  const move = getMove(moveId);
  const extras: string[] = [];
  let primary: MovePreview | null = null;

  for (const effect of move.effects) {
    if (effect.type === "damage" || effect.type === "chain") {
      const power = effect.power;
      const element = effect.element ?? move.element ?? actor.element;
      const dmg = estimateEffectDamage(
        actor,
        target,
        power,
        element,
        relicIds,
      );
      const hops =
        effect.type === "chain" && effect.jumps > 1
          ? ` ×${effect.jumps}`
          : "";
      const preview: MovePreview = {
        kind: "damage",
        amount: dmg,
        text: `−${dmg} HP${hops}`,
      };
      if (!primary) primary = preview;
      else extras.push(preview.text);
      continue;
    }
    if (effect.type === "heal") {
      const amount = Math.max(1, Math.round(target.maxHp * effect.portion));
      const preview: MovePreview = {
        kind: "heal",
        amount,
        text: `+${amount} HP`,
      };
      if (!primary) primary = preview;
      else extras.push(preview.text);
      continue;
    }
    if (effect.type === "buffStat") {
      const stat = effect.stat.toUpperCase();
      const preview: MovePreview = {
        kind: "buff",
        stat,
        amount: effect.amount,
        text: `+${effect.amount} ${stat}`,
      };
      if (!primary) primary = preview;
      else extras.push(preview.text);
      continue;
    }
    if (effect.type === "guard") {
      const preview: MovePreview = {
        kind: "guard",
        amount: effect.defBonus,
        text: `+${effect.defBonus} DEF`,
      };
      if (!primary) primary = preview;
      else extras.push(preview.text);
      continue;
    }
    if (effect.type === "applyStatus") {
      const preview: MovePreview = {
        kind: "status",
        text: effect.status,
      };
      if (!primary) primary = preview;
      else extras.push(preview.text);
      continue;
    }
    if (effect.type === "drain") {
      extras.push(`drain ${Math.round(effect.portion * 100)}%`);
    }
  }

  if (!primary) {
    return {
      kind: "other",
      text: labels.moves[moveId]?.description ?? moveId,
    };
  }
  if (extras.length === 0) return primary;
  return {
    ...primary,
    text: [primary.text, ...extras].join(" · "),
  };
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
  if (!moveNeedsTargetChoice(move)) return actor.uid;

  const needsFoe = move.effects.some(
    (e) =>
      e.type === "chain" ||
      (e.type === "damage" && e.target === "foe") ||
      (e.type === "applyStatus" && e.target === "foe"),
  );
  if (needsFoe) {
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
    actor.uid
  );
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
    turnOrder: previewTurnOrder(state.player, state.enemies, state.relicIds ?? []),
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
    turnOrder: previewTurnOrder(state.player, state.enemies, state.relicIds ?? []),
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
    turnOrder: previewTurnOrder(state.player, state.enemies, state.relicIds ?? []),
  };
}

/** True when every living party beast has a move or an explicit skip. */
export function allPlansReady(state: BattleState): boolean {
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

/** Fight can start even if some beasts have no plan (they will skip). */
export function canStartFight(state: BattleState): boolean {
  if (state.phase !== "planning") return false;
  if (alive(state.player).length === 0) return false;
  if (state.captureAttempt) {
    return (
      state.battleKind === "wild" && alive(state.enemies).length > 0
    );
  }
  return true;
}

/** @deprecated Prefer canStartFight / allPlansReady. */
export function canFight(state: BattleState): boolean {
  return allPlansReady(state);
}

/** Fill missing / incomplete party plans with skip so the round can resolve. */
export function ensureFightPlans(state: BattleState): BattleState {
  if (state.captureAttempt) return state;
  let changed = false;
  const plans = { ...state.plans };
  for (const m of alive(state.player)) {
    const plan = plans[m.uid];
    if (!plan) {
      plans[m.uid] = { actorId: m.uid, moveId: null, targetId: null };
      changed = true;
      continue;
    }
    if (plan.moveId === null) continue;
    const invalid =
      remainingUses(m.moveUses, plan.moveId) <= 0 || !plan.targetId;
    if (invalid) {
      plans[m.uid] = { actorId: m.uid, moveId: null, targetId: null };
      changed = true;
    }
  }
  if (!changed) return state;
  return {
    ...state,
    plans,
    turnOrder: previewTurnOrder(state.player, state.enemies, state.relicIds ?? []),
  };
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
    pendingItemId: null,
    pendingItemSlot: null,
  };
}

/** Arm or clear a bag item for the next fight resolve (exclusive with capture). */
export function setPendingItem(
  state: BattleState,
  slotIndex: number | null,
  itemId: string | null,
): BattleState {
  if (state.phase !== "planning") return state;
  if (slotIndex === null || itemId === null) {
    return { ...state, pendingItemId: null, pendingItemSlot: null };
  }
  return {
    ...state,
    pendingItemId: itemId,
    pendingItemSlot: slotIndex,
    captureAttempt: false,
  };
}

function resolvePendingItem(
  state: BattleState,
  labels: LocaleLabel,
  itemId: string,
): { state: BattleState; fx: BattleFx[]; actorId: string } {
  const def = getItem(itemId);
  const name = labels.items[itemId]?.name ?? itemId;
  const actorId =
    alive(state.player)[0]?.uid ?? state.player[0]?.uid ?? "item";
  if (!def) {
    return {
      state: {
        ...state,
        pendingItemId: null,
        pendingItemSlot: null,
        log: pushLog(state.log, name),
      },
      fx: [],
      actorId,
    };
  }

  const before = state.player;
  const after = applyItemEffectsToParty(before, def.effects);
  const fx: BattleFx[] = [{ kind: "act", actorId, moveId: null }];
  for (let i = 0; i < before.length; i += 1) {
    const prev = before[i]!;
    const next = after[i]!;
    if (next.hp > prev.hp) {
      fx.push({ kind: "heal", targetId: next.uid, amount: next.hp - prev.hp });
    } else if (next.hp < prev.hp) {
      fx.push({
        kind: "damage",
        targetId: next.uid,
        amount: prev.hp - next.hp,
      });
    }
    if (next.atk !== prev.atk) {
      const d = next.atk - prev.atk;
      fx.push({
        kind: "buff",
        targetId: next.uid,
        text: `ATK ${d > 0 ? "+" : ""}${d}`,
      });
    }
    if (next.def !== prev.def) {
      const d = next.def - prev.def;
      fx.push({
        kind: "buff",
        targetId: next.uid,
        text: `DEF ${d > 0 ? "+" : ""}${d}`,
      });
    }
    if (next.spd !== prev.spd) {
      const d = next.spd - prev.spd;
      fx.push({
        kind: "buff",
        targetId: next.uid,
        text: `SPD ${d > 0 ? "+" : ""}${d}`,
      });
    }
  }

  const used = labels.ui.itemUsed.replace("{item}", name);

  return {
    state: {
      ...state,
      player: after,
      pendingItemId: null,
      pendingItemSlot: null,
      log: pushLog(state.log, used),
    },
    fx,
    actorId,
  };
}

/** Capture chance: 50% at full HP → ~90% near faint. */
export function captureChance(
  hp: number,
  maxHp: number,
  relicIds: string[] = [],
) {
  return tableCaptureChance(hp, maxHp, relicIds);
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
  const attackMoves = pool.filter((id) => moveIsOffensive(getMove(id)));
  const supportMoves = pool.filter((id) => !moveIsOffensive(getMove(id)));

  const livingPlayers = alive(players);
  const livingAllies = alive(allies);
  const foeTarget = simpleAi
    ? livingPlayers[Math.floor(rng() * livingPlayers.length)] ??
      livingPlayers[0]
    : ([...livingPlayers].sort((a, b) => a.hp - b.hp)[0] ?? livingPlayers[0]);

  const supportChance = simpleAi ? 0.1 : 0.35;
  const lowHp = enemy.hp / enemy.maxHp < 0.4;
  if (lowHp && supportMoves.length > 0 && rng() < supportChance) {
    const healOrBuff =
      supportMoves.find((id) =>
        getMove(id).effects.some((e) => e.type === "heal"),
      ) ?? supportMoves[Math.floor(rng() * supportMoves.length)];
    const move = getMove(healOrBuff);
    const healsAlly = move.effects.some(
      (e) => e.type === "heal" && e.target === "ally",
    );
    const targetId = healsAlly
      ? ([...livingAllies].sort((a, b) => a.hp - b.hp)[0]?.uid ?? enemy.uid)
      : enemy.uid;
    return { actorId: enemy.uid, moveId: healOrBuff, targetId };
  }

  const moveId =
    attackMoves[Math.floor(rng() * attackMoves.length)] ??
    pool[0] ??
    "scratch";
  const move = getMove(moveId);
  if (moveIsOffensive(move)) {
    return {
      actorId: enemy.uid,
      moveId,
      targetId: foeTarget?.uid ?? null,
    };
  }
  const healsAlly = move.effects.some(
    (e) => e.type === "heal" && e.target === "ally",
  );
  return {
    actorId: enemy.uid,
    moveId,
    targetId: healsAlly
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

export type { BattleFx } from "./combatEffects";

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
  rng: () => number = Math.random,
): { state: BattleState; fx: BattleFx[] } {
  let next = state;
  const fx: BattleFx[] = [];
  const actor = findCombatant(next, plan.actorId);
  if (!actor || actor.hp <= 0) return { state: next, fx };

  if (hasStatus(actor, "freeze")) {
    next = {
      ...next,
      log: pushLog(next.log, `${actor.name} is frozen`),
    };
    const tick = tickStatusesAfterAction(findCombatant(next, actor.uid)!);
    next = updateCombatant(next, actor.uid, tick.combatant);
    return { state: next, fx };
  }
  if (rng() < paralysisSkipChance(actor)) {
    next = {
      ...next,
      log: pushLog(next.log, `${actor.name} is paralyzed`),
    };
    const tick = tickStatusesAfterAction(findCombatant(next, actor.uid)!);
    next = updateCombatant(next, actor.uid, tick.combatant);
    return { state: next, fx };
  }

  fx.push({ kind: "act", actorId: actor.uid, moveId: plan.moveId });

  if (plan.moveId === null) {
    next = {
      ...next,
      log: pushLog(next.log, `${actor.name} ${labels.ui.logSkip}`),
    };
    const tick = tickStatusesAfterAction(findCombatant(next, actor.uid)!);
    next = updateCombatant(next, actor.uid, tick.combatant);
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
  const moveName = labels.moves[plan.moveId].name;
  next = {
    ...next,
    log: pushLog(
      next.log,
      `${freshActor.name} ${labels.ui.logUses} ${moveName}`,
    ),
  };

  const resolved = resolveMoveEffects(next, plan, labels);
  next = resolved.state;
  fx.push(...resolved.fx);

  const after = findCombatant(next, plan.actorId);
  if (after && after.hp > 0) {
    const tick = tickStatusesAfterAction(after);
    next = updateCombatant(next, after.uid, tick.combatant);
    if (tick.dotDamage > 0) {
      fx.push({
        kind: "damage",
        targetId: after.uid,
        amount: tick.dotDamage,
      });
      next = {
        ...next,
        log: pushLog(next.log, `${after.name}: ${tick.logs.join(", ")}`),
      };
      if (tick.combatant.hp <= 0) {
        fx.push({ kind: "faint", targetId: after.uid });
      }
    }
  }

  return { state: next, fx };
}

function toCapturedMonster(foe: Combatant): Monster {
  const { side: _s, tempDefBonus: _t, statuses: _st, ...rest } = foe;
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
  const chance = captureChance(
    target.hp,
    target.maxHp,
    state.relicIds ?? [],
  );
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
): {
  steps: FightStep[];
  final: BattleState;
  consumedItemSlot?: number;
} | null {
  if (!canStartFight(state)) return null;
  state = ensureFightPlans(state);

  let next: BattleState = {
    ...state,
    phase: "resolving",
    player: clearTempMods(state.player),
    enemies: clearTempMods(state.enemies),
    log: pushLog(state.log, labels.ui.resolving),
  };

  const steps: FightStep[] = [];
  const simpleAi = state.battleKind === "wild";
  let consumedItemSlot: number | undefined;

  if (
    state.pendingItemSlot != null &&
    state.pendingItemId &&
    !state.captureAttempt
  ) {
    const beforeItem = next;
    const itemResult = resolvePendingItem(next, labels, state.pendingItemId);
    next = checkOutcome(itemResult.state, labels);
    steps.push({
      actorId: itemResult.actorId,
      before: beforeItem,
      battle: next,
      fx: itemResult.fx,
    });
    consumedItemSlot = state.pendingItemSlot;
    if (next.phase === "won" || next.phase === "lost") {
      return { steps, final: next, consumedItemSlot };
    }
  } else {
    next = { ...next, pendingItemId: null, pendingItemSlot: null };
  }

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
      return { steps, final: next, consumedItemSlot };
    }

    // On fail, only the wild beast acts (party resigned the round).
    const order = previewTurnOrder(next.player, next.enemies, next.relicIds ?? []).filter((uid) =>
      next.enemies.some((e) => e.uid === uid),
    );
    next = { ...next, turnOrder: order };
    for (let i = 0; i < order.length; i++) {
      const uid = order[i]!;
      const plan = state.enemyPlans[uid];
      if (!plan) continue;
      const before = next;
      const result = resolveAction(next, plan, labels, mulberry32(seed + i));
      next = dropActorPlan(checkOutcome(result.state, labels), uid);
      steps.push({ actorId: uid, before, battle: next, fx: result.fx });
      if (next.phase === "won" || next.phase === "lost") {
        return { steps, final: next, consumedItemSlot };
      }
    }

    const final: BattleState = {
      ...next,
      phase: "planning",
      plans: {},
      captureAttempt: false,
      pendingItemId: null,
      pendingItemSlot: null,
      enemyPlans: rollEnemyPlans(
        next.player,
        next.enemies,
        seed + 41,
        simpleAi,
      ),
      turnOrder: previewTurnOrder(next.player, next.enemies, next.relicIds ?? []),
      log: pushLog(next.log, labels.ui.yourTurn),
    };
    return { steps, final, consumedItemSlot };
  }

  const allPlans: PlannedAction[] = [
    ...Object.values(state.plans),
    ...Object.values(state.enemyPlans),
  ];

  const order = previewTurnOrder(next.player, next.enemies, next.relicIds ?? []);
  next = { ...next, turnOrder: order };

  for (let i = 0; i < order.length; i++) {
    const uid = order[i]!;
    const plan = allPlans.find((p) => p.actorId === uid);
    if (!plan) continue;
    const before = next;
    const result = resolveAction(next, plan, labels, mulberry32(seed + i));
    next = dropActorPlan(checkOutcome(result.state, labels), uid);
    steps.push({ actorId: uid, before, battle: next, fx: result.fx });
    if (next.phase === "won" || next.phase === "lost") {
      return { steps, final: next, consumedItemSlot };
    }
  }

  const final: BattleState = {
    ...next,
    phase: "planning",
    plans: {},
    captureAttempt: false,
    pendingItemId: null,
    pendingItemSlot: null,
    enemyPlans: rollEnemyPlans(next.player, next.enemies, seed + 41, simpleAi),
    turnOrder: previewTurnOrder(next.player, next.enemies, next.relicIds ?? []),
    log: pushLog(next.log, labels.ui.yourTurn),
  };
  return { steps, final, consumedItemSlot };
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
    (moveIsOffensive(move)
      ? targets[0]
      : (targets.find((t) => t.uid === actor.uid) ?? targets[0]));
  if (!target) return null;

  const preview = previewMoveOnTarget(
    actor,
    target,
    moveId,
    labels,
    state.relicIds ?? [],
  );
  if (preview.kind === "damage") {
    return preview.text.replace("−", "~").replace(/ HP/g, "");
  }
  if (preview.kind === "heal") return `+${preview.amount}`;
  if (
    preview.kind === "buff" ||
    preview.kind === "guard" ||
    preview.kind === "status"
  ) {
    return preview.text;
  }
  return null;
}

export function rewardGoldFor(
  nodeType: NodeType,
  column: number,
  runLevel = 1,
  relicIds: string[] = [],
) {
  return tableRewardGoldFor(nodeType, column, runLevel, relicIds);
}

export function makeShopRecruit(
  seed: number,
  column: number,
  labels: LocaleLabel,
  regionId?: RegionId,
) {
  const rng = mulberry32(seed);
  const species = pickWild(rng, column + 1, regionId);
  return createMonster(species, 1 + Math.floor(column * 0.35), labels);
}

export function randomStarterOptions(labels: LocaleLabel) {
  const ids = (STARTER_IDS.length ? STARTER_IDS : SPECIES_IDS).filter(
    (id) => SPECIES[id],
  );
  return ids.map((id) => createMonsterById(id, 1, labels)).map((m) => {
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
