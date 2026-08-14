import type { EventDef } from "./_types";

export const EVENTS: EventDef[] = [
  {
    id: "spring",
    choices: [
      { id: "heal", labelKey: "heal", effects: [{ type: "healParty", amount: "half" }] },
      { id: "gold", labelKey: "gold", effects: [{ type: "gold", delta: 18 }] },
    ],
  },
  {
    id: "shrine",
    choices: [
      {
        id: "atk",
        labelKey: "atk",
        effects: [{ type: "buffParty", stat: "atk", amount: 2 }],
      },
      {
        id: "def",
        labelKey: "def",
        effects: [{ type: "buffParty", stat: "def", amount: 2 }],
      },
    ],
  },
  {
    id: "trader",
    choices: [
      {
        id: "take",
        labelKey: "take",
        effects: [{ type: "giveMonster", speciesId: "shade-pup", level: 2 }],
      },
      { id: "gold", labelKey: "gold", effects: [{ type: "gold", delta: 25 }] },
    ],
  },
  {
    id: "curse",
    choices: [
      {
        id: "pay",
        labelKey: "pay",
        effects: [{ type: "damageParty", amount: 8 }],
      },
      {
        id: "bribe",
        labelKey: "bribe",
        effects: [{ type: "gold", delta: -20 }],
      },
    ],
  },
  {
    id: "campfire",
    choices: [
      { id: "heal", labelKey: "heal", effects: [{ type: "healParty", amount: "half" }] },
      {
        id: "train",
        labelKey: "train",
        effects: [
          { type: "healParty", amount: "half" },
          { type: "buffParty", stat: "atk", amount: 1 },
        ],
      },
    ],
  },
  {
    id: "release",
    special: "release",
    choices: [{ id: "keep", labelKey: "keep", effects: [{ type: "noop" }] }],
  },
  {
    id: "wilds",
    choices: [
      {
        id: "explore",
        labelKey: "explore",
        effects: [{ type: "startWildBattle", habitat: "random" }],
      },
      { id: "leave", labelKey: "leave", effects: [{ type: "gold", delta: 12 }] },
    ],
  },
  {
    id: "meadow-festival",
    global: false,
    choices: [
      {
        id: "dance",
        labelKey: "dance",
        effects: [
          { type: "healParty", amount: "half" },
          { type: "buffParty", stat: "atk", amount: 1 },
        ],
      },
      { id: "gift", labelKey: "gift", effects: [{ type: "gold", delta: 22 }] },
    ],
  },
  {
    id: "cavern-echo",
    global: false,
    choices: [
      {
        id: "listen",
        labelKey: "listen",
        effects: [{ type: "buffParty", stat: "def", amount: 2 }],
      },
      {
        id: "shout",
        labelKey: "shout",
        effects: [
          { type: "damageParty", amount: 5 },
          { type: "buffParty", stat: "atk", amount: 2 },
        ],
      },
    ],
  },
  {
    id: "abyss-whisper",
    global: false,
    choices: [
      {
        id: "accept",
        labelKey: "accept",
        effects: [
          { type: "giveRelic", relicId: "copper-charm" },
          { type: "damageParty", amount: 10 },
        ],
      },
      { id: "refuse", labelKey: "refuse", effects: [{ type: "noop" }] },
    ],
  },
];

export const EVENT_BY_ID = Object.fromEntries(
  EVENTS.map((e) => [e.id, e]),
) as Record<string, EventDef>;

export const EVENT_IDS = EVENTS.map((e) => e.id);
