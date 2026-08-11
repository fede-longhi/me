export type Element =
  | "ember"
  | "tide"
  | "gale"
  | "moss"
  | "spark"
  | "shade";

export type SpeciesId =
  | "ember-cub"
  | "tide-sprite"
  | "gale-finch"
  | "moss-brute"
  | "spark-mite"
  | "shade-pup"
  | "cinder-fox"
  | "reef-guard"
  | "storm-owl"
  | "root-titan"
  | "volt-drake"
  | "night-wraith"
  | "boss-hydra";

export type MoveId =
  | "scratch"
  | "ember-lash"
  | "tide-bolt"
  | "gale-cut"
  | "moss-slam"
  | "spark-jolt"
  | "shade-bite"
  | "heal-lick"
  | "focus"
  | "harden"
  | "quicken"
  | "guard"
  | "inferno"
  | "tidal-crush"
  | "abyss-fang";

export type MoveKind = "attack" | "passive";

export type PassiveEffect =
  | { type: "heal"; portion: number }
  | { type: "buffStat"; stat: "atk" | "def" | "spd"; amount: number }
  | { type: "guard"; defBonus: number };

export type MoveDef = {
  id: MoveId;
  kind: MoveKind;
  /** Attack power multiplier on atk. */
  power?: number;
  element?: Element;
  effect?: PassiveEffect;
  /** Max uses per run (restored at rest sites). */
  maxUses: number;
};

export type LearnEntry = {
  level: number;
  moveId: MoveId;
};

export type Species = {
  id: SpeciesId;
  element: Element;
  baseHp: number;
  baseAtk: number;
  baseDef: number;
  baseSpd: number;
  rarity: "common" | "uncommon" | "rare" | "boss";
  learnset: LearnEntry[];
};

export type Monster = {
  uid: string;
  speciesId: SpeciesId;
  name: string;
  element: Element;
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
  turnOrder: string[];
  log: BattleLogEntry[];
  goldReward: number;
  /** Set when a wild capture succeeds. */
  capturedMonster: Monster | null;
};

export type ShopOffer =
  | { id: string; kind: "heal"; labelKey: "heal"; cost: number }
  | { id: string; kind: "buff"; labelKey: "buffAtk" | "buffDef"; cost: number; amount: number }
  | { id: string; kind: "recruit"; labelKey: "recruit"; cost: number; monster: Monster };

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
  gold: number;
  party: Monster[];
  /** Beasts not in the active party (no cap). */
  reserve: Monster[];
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
/** Camp + 10 path columns + boss. */
export const MAP_COLUMNS = 12;
export const MAX_MOVES = 4;
