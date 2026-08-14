import type { RelicDef } from "./types";

export type { RelicDef, RelicHook } from "./types";

export const RELICS: Record<string, RelicDef> = {
  "copper-charm": {
    id: "copper-charm",
    art: "/beast-path/relics/copper-charm.png",
    hooks: [{ type: "goldMult", mult: 1.15 }],
  },
  "scholar-tooth": {
    id: "scholar-tooth",
    art: "/beast-path/relics/scholar-tooth.png",
    hooks: [{ type: "xpMult", mult: 1.2 }],
  },
  "silk-snare": {
    id: "silk-snare",
    art: "/beast-path/relics/silk-snare.png",
    hooks: [{ type: "captureBonus", amount: 0.1 }],
  },
};

export const RELIC_IDS = Object.keys(RELICS);

export {
  relicGoldMult,
  relicXpMult,
  relicCaptureBonus,
  relicShopDiscount,
  relicBattleStartHeal,
  relicStatBonus,
} from "./compute";
