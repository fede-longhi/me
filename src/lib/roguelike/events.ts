import type { LocaleLabel } from "./content";
import {
  EVENT_BY_ID,
  EVENT_IDS,
  getItem,
  getRegion,
  ITEMS,
  RELICS,
} from "./content";
import type { EventEffect } from "./content/events/_types";
import { relicShopDiscount } from "./content/relics/compute";
import { pickHabitat } from "./habitats";
import { createMonsterById, healParty } from "./monsters";
import type {
  HabitatId,
  InventoryStack,
  Monster,
  RandomEvent,
  RegionId,
  ShopOffer,
} from "./types";
import { BAG_LIMIT } from "./types";
import { makeShopRecruit } from "./combat";

export function pickRandomEvent(
  seed: number,
  column = 0,
  regionId?: RegionId,
): RandomEvent {
  const region = regionId ? getRegion(regionId) : undefined;
  const regionEvents = new Set(region?.events ?? []);
  const pool = EVENT_IDS.filter((id) => {
    const def = EVENT_BY_ID[id];
    if (!def) return false;
    if (def.minColumn != null && column < def.minColumn) return false;
    const isGlobal = def.global !== false;
    if (isGlobal) return true;
    return regionEvents.has(id);
  });
  const list = pool.length > 0 ? pool : EVENT_IDS.filter((id) => EVENT_BY_ID[id]?.global !== false);
  const safe = list.length > 0 ? list : EVENT_IDS;
  const id = safe[seed % safe.length] ?? "spring";
  const def = EVENT_BY_ID[id]!;
  return {
    id: def.id,
    titleKey: def.id,
    bodyKey: def.id,
    choices: def.choices.map((c) => ({ id: c.id, labelKey: c.labelKey })),
  };
}

export function buildShopOffers(
  seed: number,
  column: number,
  labels: LocaleLabel,
  relicIds: string[] = [],
  regionId?: RegionId,
): ShopOffer[] {
  const recruit = makeShopRecruit(seed, column, labels, regionId);
  const discount = 1 - relicShopDiscount(relicIds, RELICS);
  const cost = (n: number) => Math.max(1, Math.round(n * discount));

  const itemIds = Object.keys(ITEMS);
  const itemId = itemIds[seed % itemIds.length] ?? "potion-heal";
  const item = ITEMS[itemId]!;
  const relicId =
    Object.keys(RELICS)[(seed + 3) % Object.keys(RELICS).length] ??
    "copper-charm";
  const relic = RELICS[relicId]!;

  return [
    { id: "heal", kind: "heal", labelKey: "heal", cost: cost(22) },
    {
      id: "buff-atk",
      kind: "buff",
      labelKey: "buffAtk",
      cost: cost(28),
      amount: 2,
    },
    {
      id: "buff-def",
      kind: "buff",
      labelKey: "buffDef",
      cost: cost(28),
      amount: 2,
    },
    {
      id: `recruit-${recruit.uid}`,
      kind: "recruit",
      labelKey: "recruit",
      cost: cost(40 + column * 5),
      monster: recruit,
    },
    {
      id: `item-${itemId}`,
      kind: "item",
      labelKey: "item",
      cost: cost(item.shopCost ?? 20),
      itemId,
    },
    {
      id: `relic-${relicId}`,
      kind: "relic",
      labelKey: "relic",
      cost: cost(55 + column * 4),
      relicId: relic.id,
    },
  ];
}

export type EventResult = {
  party: Monster[];
  gold: number;
  items: InventoryStack[];
  relics: string[];
  message: string;
  /** If set, start a wild battle in this habitat instead of resolving the event. */
  startWildHabitat?: HabitatId;
};

function applyEffects(
  effects: EventEffect[],
  party: Monster[],
  gold: number,
  items: InventoryStack[],
  relics: string[],
  labels: LocaleLabel,
  partyLimit: number,
  seed: number,
  choiceLabel: string,
): EventResult {
  let nextParty = party;
  let nextGold = gold;
  let nextItems = items;
  let nextRelics = relics;
  let startWildHabitat: HabitatId | undefined;
  const messages: string[] = [choiceLabel];

  for (const effect of effects) {
    switch (effect.type) {
      case "healParty":
        nextParty = healParty(nextParty, effect.amount);
        break;
      case "gold": {
        if (effect.delta < 0 && nextGold < -effect.delta) {
          // Not enough gold: fall back to light damage (curse bribe pattern).
          nextParty = nextParty.map((m) =>
            m.hp <= 0 ? m : { ...m, hp: Math.max(1, m.hp - 8) },
          );
          messages.push(`(${labels.ui.notEnoughGold})`);
        } else {
          nextGold += effect.delta;
        }
        break;
      }
      case "buffParty":
        nextParty = nextParty.map((m) => {
          if (m.hp <= 0) return m;
          if (effect.stat === "atk") return { ...m, atk: m.atk + effect.amount };
          return { ...m, def: m.def + effect.amount };
        });
        break;
      case "giveMonster": {
        if (nextParty.length >= partyLimit) {
          messages.push(labels.ui.emptyParty);
          break;
        }
        const gift = createMonsterById(
          effect.speciesId,
          effect.level,
          labels,
        );
        nextParty = [...nextParty, gift];
        messages.push(gift.name);
        break;
      }
      case "damageParty":
        nextParty = nextParty.map((m) =>
          m.hp <= 0
            ? m
            : { ...m, hp: Math.max(1, m.hp - effect.amount) },
        );
        break;
      case "startWildBattle": {
        if (effect.habitat === "random" || !effect.habitat) {
          let t = (seed + 91) >>> 0;
          const rng = () => {
            t += 0x6d2b79f5;
            let r = Math.imul(t ^ (t >>> 15), 1 | t);
            r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
            return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
          };
          startWildHabitat = pickHabitat(rng);
        } else {
          startWildHabitat = effect.habitat;
        }
        break;
      }
      case "giveItem":
        nextItems = addItem(nextItems, effect.itemId, effect.qty ?? 1);
        break;
      case "giveRelic":
        if (!nextRelics.includes(effect.relicId)) {
          nextRelics = [...nextRelics, effect.relicId];
        }
        break;
      case "releaseChoice":
      case "noop":
        break;
      default:
        break;
    }
  }

  return {
    party: nextParty,
    gold: nextGold,
    items: nextItems,
    relics: nextRelics,
    message: messages.filter(Boolean).join(" · "),
    startWildHabitat,
  };
}

/** Add non-stackable bag slots (qty always 1). No-op if bag is full. */
export function addItem(
  items: InventoryStack[],
  itemId: string,
  qty = 1,
): InventoryStack[] {
  const def = getItem(itemId);
  if (!def || qty <= 0) return items;
  let next = items;
  for (let i = 0; i < qty; i += 1) {
    if (next.length >= BAG_LIMIT) break;
    next = [...next, { itemId, qty: 1 }];
  }
  return next;
}

export function removeItem(
  items: InventoryStack[],
  itemId: string,
  qty = 1,
): InventoryStack[] {
  let remaining = qty;
  const next: InventoryStack[] = [];
  for (const slot of items) {
    if (remaining > 0 && slot.itemId === itemId) {
      remaining -= 1;
      continue;
    }
    next.push({ itemId: slot.itemId, qty: 1 });
  }
  return next;
}

export function removeItemAt(
  items: InventoryStack[],
  slotIndex: number,
): InventoryStack[] {
  if (slotIndex < 0 || slotIndex >= items.length) return items;
  return items.filter((_, i) => i !== slotIndex);
}

/** Expand legacy stacked qty into individual slots, capped at BAG_LIMIT. */
export function normalizeBagSlots(items: InventoryStack[]): InventoryStack[] {
  const slots: InventoryStack[] = [];
  for (const stack of items) {
    if (!stack?.itemId || !(stack.qty > 0)) continue;
    const count = Math.max(1, Math.floor(stack.qty));
    for (let i = 0; i < count; i += 1) {
      if (slots.length >= BAG_LIMIT) return slots;
      slots.push({ itemId: stack.itemId, qty: 1 });
    }
  }
  return slots;
}

export function isBagFull(items: InventoryStack[]) {
  return items.length >= BAG_LIMIT;
}

export function applyEventChoice(
  event: RandomEvent,
  choiceId: string,
  party: Monster[],
  gold: number,
  labels: LocaleLabel,
  partyLimit: number,
  seed = 0,
  items: InventoryStack[] = [],
  relics: string[] = [],
): EventResult {
  const def = EVENT_BY_ID[event.id];
  const eventCopy = labels.events[event.id];

  if (def?.special === "release") {
    if (choiceId === "keep") {
      return {
        party,
        gold,
        items,
        relics,
        message: eventCopy?.choices.keep ?? "",
      };
    }
    if (choiceId.startsWith("free:")) {
      const uid = choiceId.slice("free:".length);
      if (party.length <= 1) {
        return {
          party,
          gold,
          items,
          relics,
          message: labels.ui.cannotReleaseLast,
        };
      }
      const freed = party.find((m) => m.uid === uid);
      if (!freed) {
        return {
          party,
          gold,
          items,
          relics,
          message: eventCopy?.choices.keep ?? "",
        };
      }
      return {
        party: party.filter((m) => m.uid !== uid),
        gold,
        items,
        relics,
        message: `${eventCopy?.choices.free ?? ""}: ${freed.name}`,
      };
    }
  }

  const choice = def?.choices.find((c) => c.id === choiceId);
  if (!choice) {
    return { party, gold, items, relics, message: "" };
  }

  const label = eventCopy?.choices[choice.labelKey] ?? choice.labelKey;
  return applyEffects(
    choice.effects,
    party,
    gold,
    items,
    relics,
    labels,
    partyLimit,
    seed,
    label,
  );
}
