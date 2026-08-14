export type Element =
  | "ember"
  | "tide"
  | "gale"
  | "moss"
  | "spark"
  | "shade";

/** Open string id — new creatures/moves can be added from the author pack. */
export type SpeciesId = string;

export type MoveId = string;

/** @deprecated Prefer deriving from effects (has damage/chain → offensive). */
export type MoveKind = "attack" | "passive";

export type StatusId =
  | "burn"
  | "poison"
  | "paralysis"
  | "freeze"
  | "slow"
  | "weak"
  | "ward";

export type StatusInstance = {
  id: StatusId;
  /** Rounds remaining; decremented after the combatant's action. */
  turns: number;
  /** Status-specific strength (DoT portion, debuff amount, etc.). */
  potency?: number;
};

export type MoveEffectTarget =
  | "self"
  | "ally"
  | "foe"
  | "allAllies"
  | "allFoes";

export type MoveEffect =
  | {
      type: "damage";
      power: number;
      target: "foe" | "allFoes";
      element?: Element;
    }
  | {
      type: "heal";
      portion: number;
      target: "self" | "ally" | "allAllies";
    }
  | {
      type: "buffStat";
      stat: "atk" | "def" | "spd";
      amount: number;
      target: "self" | "ally" | "allAllies";
    }
  | { type: "guard"; defBonus: number; target: "self" }
  | { type: "drain"; portion: number }
  | {
      type: "restoreUses";
      target: "self" | "ally" | "allAllies";
    }
  | {
      type: "applyStatus";
      status: StatusId;
      turns: number;
      potency?: number;
      target: MoveEffectTarget;
    }
  | {
      type: "clearStatus";
      status?: StatusId;
      target: "self" | "ally" | "allAllies";
    }
  | {
      type: "chain";
      power: number;
      jumps: number;
      falloff: number;
      element?: Element;
    };

/** @deprecated Legacy single passive; normalized into effects[]. */
export type PassiveEffect =
  | { type: "heal"; portion: number }
  | { type: "buffStat"; stat: "atk" | "def" | "spd"; amount: number }
  | { type: "guard"; defBonus: number };

export type MoveDef = {
  id: MoveId;
  /** Ordered effect list resolved in combat. */
  effects: MoveEffect[];
  element?: Element;
  /** Max uses per run (restored at rest sites). */
  maxUses: number;
  /** @deprecated Migrated into effects[]. */
  kind?: MoveKind;
  /** @deprecated Migrated into damage effect. */
  power?: number;
  /** @deprecated Migrated into effects[]. */
  effect?: PassiveEffect;
};

export type LearnEntry = {
  level: number;
  moveId: MoveId;
};

export type Species = {
  id: SpeciesId;
  /** Optional — typeless creatures deal/take neutral damage. */
  element?: Element;
  baseHp: number;
  baseAtk: number;
  baseDef: number;
  baseSpd: number;
  rarity: "common" | "uncommon" | "rare" | "boss";
  learnset: LearnEntry[];
  /** Thumbnail under /beast-path/… (party, combat). */
  art?: string;
  /** Full-body art for starter, stats, and capture. */
  artFull?: string;
};

export type InventoryStack = {
  itemId: string;
  /** Always 1 — bag slots are non-stackable. */
  qty: number;
};

export type Monster = {
  uid: string;
  speciesId: SpeciesId;
  name: string;
  /** Copied from species; may be absent for typeless beasts. */
  element?: Element;
  level: number;
  xp: number;
  maxHp: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  /** Up to 4 learned move ids. */
  moves: MoveId[];
  /** Remaining uses per learned move. */
  moveUses: Partial<Record<MoveId, number>>;
};

export type HabitatId =
  | "cave"
  | "grassland"
  | "forest"
  | "river"
  | "sea"
  | "beach"
  | "desert"
  | "swamp";

/** Open string id — regions can be authored in the content pack. */
export type RegionId = string;

export type RunLevel = 1 | 2 | 3;

export type RegionDef = {
  id: RegionId;
  /** Path levels (1–3) where this region can be rolled. */
  levels: RunLevel[];
  /** Encounter pool for battle/elite on this path. */
  creatures: SpeciesId[];
  /** Optional early-column subset; if empty, use `creatures`. */
  earlyCreatures?: SpeciesId[];
  /** Boss pool for this path (pick one). */
  bosses: SpeciesId[];
  /** Region-unique event ids (mixed with globals). */
  events: string[];
};

export type NodeType =
  | "battle"
  | "elite"
  | "shop"
  | "event"
  | "rest"
  | "boss"
  | "start"
  | "habitat";

export type BattleKind = "wild" | "enemy";

export type MapNode = {
  id: string;
  column: number;
  row: number;
  type: NodeType;
  /** Set when type is `habitat`. */
  habitat?: HabitatId;
  next: string[];
};

export type RunMap = {
  nodes: MapNode[];
  startId: string;
  bossId: string;
};

export type Combatant = Monster & {
  side: "player" | "enemy";
  /** Temporary DEF bonus from Guard this round. */
  tempDefBonus?: number;
  /** Battle-only status effects. */
  statuses?: StatusInstance[];
};

export type BattleLogEntry = {
  id: string;
  text: string;
};

export type PlannedAction = {
  actorId: string;
  /** `null` means the combatant skips this round. */
  moveId: MoveId | null;
  targetId: string | null;
};

export type BattleState = {
  player: Combatant[];
  enemies: Combatant[];
  phase: "planning" | "resolving" | "won" | "lost";
  battleKind: BattleKind;
  habitat: HabitatId | null;
  /** Player plans for the current round. */
  plans: Record<string, PlannedAction>;
  /** Enemy plans locked in at the start of the planning phase (shown as preview). */
  enemyPlans: Record<string, PlannedAction>;
  /** When true, this round is a capture attempt (no party moves). */
  captureAttempt: boolean;
  /**
   * Item armed for this round (resolved first in the fight timeline).
   * Slot index points into RunState.items at arm time.
   */
  pendingItemId: string | null;
  pendingItemSlot: number | null;
  turnOrder: string[];
  log: BattleLogEntry[];
  goldReward: number;
  /** Set when a wild capture succeeds. */
  capturedMonster: Monster | null;
  /** Relic ids active for this battle (capture/hooks). */
  relicIds?: string[];
};

export type ShopOffer =
  | { id: string; kind: "heal"; labelKey: "heal"; cost: number }
  | { id: string; kind: "buff"; labelKey: "buffAtk" | "buffDef"; cost: number; amount: number }
  | { id: string; kind: "recruit"; labelKey: "recruit"; cost: number; monster: Monster }
  | { id: string; kind: "item"; labelKey: "item"; cost: number; itemId: string }
  | { id: string; kind: "relic"; labelKey: "relic"; cost: number; relicId: string };

export type EventChoice = {
  id: string;
  labelKey: string;
};

export type RandomEvent = {
  id: string;
  titleKey: string;
  bodyKey: string;
  choices: EventChoice[];
};

export type Screen =
  | { kind: "menu" }
  | { kind: "starter" }
  | { kind: "map" }
  | { kind: "battle"; nodeId: string }
  | { kind: "shop"; nodeId: string }
  | { kind: "event"; nodeId: string }
  | { kind: "rest"; nodeId: string }
  | { kind: "victory" }
  | { kind: "defeat" };

export type RunState = {
  seed: number;
  /** Path / act within the run (1–3). */
  currentLevel: RunLevel;
  /** Region theming the current path (battles, events, boss). */
  regionId: RegionId;
  gold: number;
  party: Monster[];
  /** Beasts not in the active party (no cap). */
  reserve: Monster[];
  /** Consumable bag slots (non-stackable, max BAG_LIMIT). */
  items: InventoryStack[];
  /** Passive relic ids for this run. */
  relics: string[];
  map: RunMap;
  currentNodeId: string;
  visited: string[];
  available: string[];
  screen: Screen;
  battle: BattleState | null;
  shopOffers: ShopOffer[];
  /** Whether a creature was already sold during the current shop visit. */
  shopSoldCreature: boolean;
  event: RandomEvent | null;
  eventResolved: boolean;
  lastMessage: string | null;
};

export const PARTY_LIMIT = 6;
/** Non-stackable bag capacity. */
export const BAG_LIMIT = 6;
/** Camp + 10 path columns + boss. */
export const MAP_COLUMNS = 15;
export const MAX_MOVES = 4;
/** Number of path acts in a full run. */
export const MAX_RUN_LEVEL = 3;
