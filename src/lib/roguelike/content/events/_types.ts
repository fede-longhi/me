import type { HabitatId, SpeciesId } from "../../types";

export type EventEffect =
  | { type: "healParty"; amount: "half" | "full" | number }
  | { type: "gold"; delta: number }
  | { type: "buffParty"; stat: "atk" | "def"; amount: number }
  | { type: "giveMonster"; speciesId: SpeciesId; level: number }
  | { type: "damageParty"; amount: number }
  | { type: "releaseChoice" }
  | { type: "startWildBattle"; habitat?: "random" | HabitatId }
  | { type: "giveItem"; itemId: string; qty?: number }
  | { type: "giveRelic"; relicId: string }
  | { type: "noop" };

export type EventChoiceDef = {
  id: string;
  /** Label key under labels.events[eventId].choices */
  labelKey: string;
  effects: EventEffect[];
};

export type EventDef = {
  id: string;
  weight?: number;
  minColumn?: number;
  choices: EventChoiceDef[];
  /**
   * When true/undefined, appears on every region path.
   * When false, only appears if listed on the current region's `events`.
   */
  global?: boolean;
  /** Special UI: party-member free buttons instead of static choices. */
  special?: "release";
};
