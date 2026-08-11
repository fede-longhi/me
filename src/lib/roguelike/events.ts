import type { LocaleLabel } from "./content";
import { pickHabitat } from "./habitats";
import { createMonsterById, restParty } from "./monsters";
import type { HabitatId, Monster, RandomEvent, ShopOffer } from "./types";
import { makeShopRecruit } from "./combat";

const EVENT_IDS = [
  "spring",
  "shrine",
  "trader",
  "curse",
  "campfire",
  "release",
  "wilds",
] as const;

export function pickRandomEvent(seed: number): RandomEvent {
  const id = EVENT_IDS[seed % EVENT_IDS.length];

  if (id === "spring") {
    return {
      id,
      titleKey: "spring",
      bodyKey: "spring",
      choices: [
        { id: "heal", labelKey: "heal" },
        { id: "gold", labelKey: "gold" },
      ],
    };
  }
  if (id === "shrine") {
    return {
      id,
      titleKey: "shrine",
      bodyKey: "shrine",
      choices: [
        { id: "atk", labelKey: "atk" },
        { id: "def", labelKey: "def" },
      ],
    };
  }
  if (id === "trader") {
    return {
      id,
      titleKey: "trader",
      bodyKey: "trader",
      choices: [
        { id: "take", labelKey: "take" },
        { id: "gold", labelKey: "gold" },
      ],
    };
  }
  if (id === "campfire") {
    return {
      id,
      titleKey: "campfire",
      bodyKey: "campfire",
      choices: [
        { id: "heal", labelKey: "heal" },
        { id: "train", labelKey: "train" },
      ],
    };
  }
  if (id === "release") {
    return {
      id,
      titleKey: "release",
      bodyKey: "release",
      choices: [{ id: "keep", labelKey: "keep" }],
    };
  }
  if (id === "wilds") {
    return {
      id,
      titleKey: "wilds",
      bodyKey: "wilds",
      choices: [
        { id: "explore", labelKey: "explore" },
        { id: "leave", labelKey: "leave" },
      ],
    };
  }
  return {
    id: "curse",
    titleKey: "curse",
    bodyKey: "curse",
    choices: [
      { id: "pay", labelKey: "pay" },
      { id: "bribe", labelKey: "bribe" },
    ],
  };
}

export function buildShopOffers(
  seed: number,
  column: number,
  labels: LocaleLabel,
): ShopOffer[] {
  const recruit = makeShopRecruit(seed, column, labels);
  return [
    { id: "heal", kind: "heal", labelKey: "heal", cost: 22 },
    { id: "buff-atk", kind: "buff", labelKey: "buffAtk", cost: 28, amount: 2 },
    { id: "buff-def", kind: "buff", labelKey: "buffDef", cost: 28, amount: 2 },
    {
      id: `recruit-${recruit.uid}`,
      kind: "recruit",
      labelKey: "recruit",
      cost: 40 + column * 5,
      monster: recruit,
    },
  ];
}

export type EventResult = {
  party: Monster[];
  gold: number;
  message: string;
  /** If set, start a wild battle in this habitat instead of resolving the event. */
  startWildHabitat?: HabitatId;
};

export function applyEventChoice(
  event: RandomEvent,
  choiceId: string,
  party: Monster[],
  gold: number,
  labels: LocaleLabel,
  partyLimit: number,
  seed = 0,
): EventResult {
  const eventCopy = labels.events[event.id];

  if (event.id === "wilds") {
    if (choiceId === "explore") {
      let t = (seed + 91) >>> 0;
      const rng = () => {
        t += 0x6d2b79f5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
      };
      return {
        party,
        gold,
        message: eventCopy.choices.explore,
        startWildHabitat: pickHabitat(rng),
      };
    }
    return { party, gold: gold + 12, message: eventCopy.choices.leave };
  }

  if (event.id === "spring") {
    if (choiceId === "heal") {
      return {
        party: restParty(party),
        gold,
        message: eventCopy.choices.heal,
      };
    }
    return { party, gold: gold + 18, message: eventCopy.choices.gold };
  }

  if (event.id === "shrine") {
    if (choiceId === "atk") {
      return {
        party: party.map((m) => ({ ...m, atk: m.atk + 2 })),
        gold,
        message: eventCopy.choices.atk,
      };
    }
    return {
      party: party.map((m) => ({ ...m, def: m.def + 2 })),
      gold,
      message: eventCopy.choices.def,
    };
  }

  if (event.id === "trader") {
    if (choiceId === "take") {
      if (party.length >= partyLimit) {
        return { party, gold, message: labels.ui.emptyParty };
      }
      const gift = createMonsterById("shade-pup", 2, labels);
      return {
        party: [...party, gift],
        gold,
        message: `${eventCopy.choices.take}: ${gift.name}`,
      };
    }
    return { party, gold: gold + 25, message: eventCopy.choices.gold };
  }

  if (event.id === "campfire") {
    if (choiceId === "train") {
      return {
        party: restParty(party).map((m) => ({
          ...m,
          atk: m.atk + 1,
        })),
        gold,
        message: eventCopy.choices.train,
      };
    }
    return {
      party: restParty(party),
      gold,
      message: eventCopy.choices.heal,
    };
  }

  if (event.id === "release") {
    if (choiceId === "keep") {
      return { party, gold, message: eventCopy.choices.keep };
    }
    if (choiceId.startsWith("free:")) {
      const uid = choiceId.slice("free:".length);
      if (party.length <= 1) {
        return { party, gold, message: labels.ui.cannotReleaseLast };
      }
      const freed = party.find((m) => m.uid === uid);
      if (!freed) {
        return { party, gold, message: eventCopy.choices.keep };
      }
      return {
        party: party.filter((m) => m.uid !== uid),
        gold,
        message: `${eventCopy.choices.free}: ${freed.name}`,
      };
    }
  }

  // curse
  if (choiceId === "bribe") {
    if (gold < 20) {
      return {
        party: party.map((m) => ({ ...m, hp: Math.max(1, m.hp - 8) })),
        gold,
        message: `${eventCopy.choices.pay} (${labels.ui.notEnoughGold})`,
      };
    }
    return { party, gold: gold - 20, message: eventCopy.choices.bribe };
  }
  return {
    party: party.map((m) => ({ ...m, hp: Math.max(1, m.hp - 8) })),
    gold,
    message: eventCopy.choices.pay,
  };
}
