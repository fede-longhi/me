export type ItemEffect =
  | { type: "healParty"; amount: "half" | "full" | number }
  | { type: "buffParty"; stat: "atk" | "def" | "spd"; amount: number }
  | { type: "damageParty"; amount: number }
  | {
      type: "permStat";
      stat: "maxHp" | "atk" | "def" | "spd";
      amount: number;
    }
  | {
      type: "applyStatus";
      status:
        | "burn"
        | "poison"
        | "paralysis"
        | "freeze"
        | "slow"
        | "weak"
        | "ward";
      turns: number;
      potency?: number;
    }
  | {
      type: "clearStatus";
      status?:
        | "burn"
        | "poison"
        | "paralysis"
        | "freeze"
        | "slow"
        | "weak"
        | "ward";
    };

export type ItemDef = {
  id: string;
  /** Max stack in inventory; omit = unlimited. */
  maxStack?: number;
  /** Shop cost when offered. */
  shopCost?: number;
  effects: ItemEffect[];
  art?: string;
};

export const ITEMS: Record<string, ItemDef> = {
  "potion-heal": {
    id: "potion-heal",
    maxStack: 1,
    shopCost: 18,
    art: "/beast-path/items/potion-heal.png",
    effects: [{ type: "healParty", amount: "half" }],
  },
  "potion-full": {
    id: "potion-full",
    maxStack: 1,
    shopCost: 40,
    art: "/beast-path/items/potion-full.png",
    effects: [{ type: "healParty", amount: "full" }],
  },
  "tonic-atk": {
    id: "tonic-atk",
    maxStack: 1,
    shopCost: 26,
    art: "/beast-path/items/tonic-atk.png",
    effects: [{ type: "buffParty", stat: "atk", amount: 1 }],
  },
  "tonic-def": {
    id: "tonic-def",
    maxStack: 1,
    shopCost: 26,
    art: "/beast-path/items/tonic-def.png",
    effects: [{ type: "buffParty", stat: "def", amount: 1 }],
  },
  "bile-vial": {
    id: "bile-vial",
    maxStack: 1,
    shopCost: 12,
    art: "/beast-path/items/bile-vial.png",
    effects: [{ type: "damageParty", amount: 5 }],
  },
};

export const ITEM_IDS = Object.keys(ITEMS);

export function getItem(id: string): ItemDef | undefined {
  return ITEMS[id];
}
