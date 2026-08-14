export type RelicHook =
  | { type: "goldMult"; mult: number }
  | { type: "xpMult"; mult: number }
  | { type: "captureBonus"; amount: number }
  | { type: "battleStartHeal"; portion: number }
  | { type: "shopDiscount"; portion: number }
  | {
      type: "statBonus";
      stat: "atk" | "def" | "spd" | "maxHp";
      amount: number;
    };

export type RelicDef = {
  id: string;
  hooks: RelicHook[];
  art?: string;
};
