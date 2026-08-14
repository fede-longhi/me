import type { Locale } from "@/lib/types";
import { copy, pickRegionForLevel } from "./content";
import { xpFromGoldReward } from "./content/rewards/tables";
import { getItem } from "./content/items";
import {
  buildEncounter,
  buildFightTimeline,
  buildWildEncounter,
  canStartFight,
  clearPlan,
  randomStarterOptions,
  rewardGoldFor,
  setCaptureAttempt as setBattleCaptureAttempt,
  setPlan,
  setSkipPlan,
  startBattle,
} from "./combat";
import {
  addItem,
  applyEventChoice,
  buildShopOffers,
  isBagFull,
  pickRandomEvent,
  removeItemAt,
} from "./events";
import { applyItemEffectsToParty } from "./items";
import { generateMap, getNode, mapSeedForLevel } from "./map";
import {
  applyPartyBuff,
  gainXp,
  healParty,
  resetUidCounter,
  restParty,
  restorePartyMoves,
} from "./monsters";
import type {
  BattleState,
  HabitatId,
  Monster,
  MoveId,
  RunLevel,
  RunMap,
  RunState,
  ShopOffer,
} from "./types";
import { MAX_RUN_LEVEL, PARTY_LIMIT } from "./types";

export function getFightSeed(state: RunState): number {
  if (!state.battle) return state.seed;
  return state.seed + state.battle.log.length * 17;
}

function beginWildBattle(
  state: RunState,
  habitat: HabitatId,
  column: number,
  nodeId: string,
  locale: Locale,
  seed: number,
): RunState {
  const labels = copy[locale];
  const enemies = buildWildEncounter(
    habitat,
    column,
    seed,
    labels,
    state.currentLevel,
  );
  const battle = startBattle(
    state.party,
    enemies,
    rewardGoldFor("habitat", column, state.currentLevel, state.relics),
    labels,
    seed,
    { kind: "wild", habitat, relicIds: state.relics },
  );
  return {
    ...state,
    screen: { kind: "battle", nodeId },
    battle,
    event: null,
    eventResolved: false,
    lastMessage: null,
  };
}

const EMPTY_MAP: RunMap = { nodes: [], startId: "", bossId: "" };

/** Idle shell shown on the main menu (no active run). */
export function createMenuState(): RunState {
  return {
    seed: 0,
    currentLevel: 1,
    regionId: "meadow",
    gold: 0,
    party: [],
    reserve: [],
    items: [],
    relics: [],
    map: EMPTY_MAP,
    currentNodeId: "",
    visited: [],
    available: [],
    screen: { kind: "menu" },
    battle: null,
    shopOffers: [],
    shopSoldCreature: false,
    event: null,
    eventResolved: false,
    lastMessage: null,
  };
}

export function createRun(locale: Locale, seed = Date.now()): RunState {
  resetUidCounter();
  const map = generateMap(mapSeedForLevel(seed, 1));
  const regionId = pickRegionForLevel(seed, 1);
  return {
    seed,
    currentLevel: 1,
    regionId,
    gold: 30,
    party: [],
    reserve: [],
    items: [{ itemId: "potion-heal", qty: 1 }],
    relics: [],
    map,
    currentNodeId: map.startId,
    visited: [map.startId],
    available: getNode(map, map.startId)?.next ?? [],
    screen: { kind: "starter" },
    battle: null,
    shopOffers: [],
    shopSoldCreature: false,
    event: null,
    eventResolved: false,
    lastMessage: null,
  };
}

export function getLabels(locale: Locale) {
  return copy[locale];
}

export function getStarters(locale: Locale) {
  return randomStarterOptions(copy[locale]);
}

export function selectStarter(state: RunState, monster: Monster): RunState {
  return {
    ...state,
    party: [monster],
    screen: { kind: "map" },
    lastMessage: null,
  };
}

export function enterNode(state: RunState, nodeId: string, locale: Locale): RunState {
  if (!state.available.includes(nodeId)) return state;
  const node = getNode(state.map, nodeId);
  if (!node) return state;
  const labels = copy[locale];

  const base: RunState = {
    ...state,
    currentNodeId: nodeId,
    visited: [...state.visited, nodeId],
    available: [],
    lastMessage: null,
    eventResolved: false,
  };

  if (node.type === "shop") {
    return {
      ...base,
      screen: { kind: "shop", nodeId },
      shopOffers: buildShopOffers(
        state.seed + node.column * 17,
        node.column,
        labels,
        state.relics,
        state.regionId,
      ),
      shopSoldCreature: false,
    };
  }

  if (node.type === "rest") {
    return {
      ...base,
      screen: { kind: "rest", nodeId },
    };
  }

  if (node.type === "event") {
    return {
      ...base,
      screen: { kind: "event", nodeId },
      event: pickRandomEvent(
        state.seed + node.column * 31 + node.row * 7,
        node.column,
        state.regionId,
      ),
    };
  }

  if (node.type === "habitat") {
    const habitat = node.habitat ?? "forest";
    return beginWildBattle(
      base,
      habitat,
      node.column,
      nodeId,
      locale,
      state.seed +
        state.currentLevel * 7919 +
        node.column * 97 +
        node.row * 13,
    );
  }

  const fightSeed =
    state.seed + state.currentLevel * 7919 + node.column * 97 + node.row * 13;
  const enemies = buildEncounter(
    node.type,
    node.column,
    fightSeed,
    labels,
    state.currentLevel,
    state.regionId,
  );
  const battle = startBattle(
    state.party,
    enemies,
    rewardGoldFor(node.type, node.column, state.currentLevel, state.relics),
    labels,
    fightSeed,
    { kind: "enemy", habitat: null, relicIds: state.relics },
  );

  return {
    ...base,
    screen: { kind: "battle", nodeId },
    battle,
  };
}

/** Full heal + revive + refill moves between paths. */
function refreshRoster(party: Monster[]) {
  return restorePartyMoves(party.map((m) => ({ ...m, hp: m.maxHp })));
}

function beginNextPath(state: RunState, locale: Locale): RunState {
  const nextLevel = (state.currentLevel + 1) as RunLevel;
  const map = generateMap(mapSeedForLevel(state.seed, nextLevel));
  const regionId = pickRegionForLevel(state.seed, nextLevel);
  const labels = copy[locale];
  const advanceMsg = labels.ui.pathAdvance
    .replace("{from}", String(state.currentLevel))
    .replace("{to}", String(nextLevel));

  return {
    ...state,
    currentLevel: nextLevel,
    regionId,
    map,
    currentNodeId: map.startId,
    visited: [map.startId],
    available: getNode(map, map.startId)?.next ?? [],
    screen: { kind: "map" },
    battle: null,
    shopOffers: [],
    shopSoldCreature: false,
    event: null,
    eventResolved: false,
    party: refreshRoster(state.party),
    reserve: refreshRoster(state.reserve),
    lastMessage: state.lastMessage
      ? `${state.lastMessage} · ${advanceMsg}`
      : advanceMsg,
  };
}

export function advanceAfterNode(
  state: RunState,
  locale: Locale = "en",
): RunState {
  const node = getNode(state.map, state.currentNodeId);
  if (!node) return state;

  if (node.type === "boss") {
    if (state.currentLevel < MAX_RUN_LEVEL) {
      return beginNextPath(state, locale);
    }
    return {
      ...state,
      screen: { kind: "victory" },
      available: [],
      battle: null,
    };
  }

  return {
    ...state,
    screen: { kind: "map" },
    available: node.next.filter((id) => !state.visited.includes(id)),
    battle: null,
    shopOffers: [],
    event: null,
    eventResolved: false,
  };
}

export function planMove(
  state: RunState,
  actorId: string,
  moveId: MoveId,
  targetId: string | null,
): RunState {
  if (!state.battle || state.screen.kind !== "battle") return state;
  return {
    ...state,
    battle: setPlan(state.battle, actorId, moveId, targetId),
  };
}

export function clearMovePlan(state: RunState, actorId: string): RunState {
  if (!state.battle || state.screen.kind !== "battle") return state;
  return {
    ...state,
    battle: clearPlan(state.battle, actorId),
  };
}

export function skipMove(state: RunState, actorId: string): RunState {
  if (!state.battle || state.screen.kind !== "battle") return state;
  return {
    ...state,
    battle: setSkipPlan(state.battle, actorId),
  };
}

export function armCapture(state: RunState, enabled: boolean): RunState {
  if (!state.battle || state.screen.kind !== "battle") return state;
  return {
    ...state,
    battle: setBattleCaptureAttempt(state.battle, enabled),
  };
}

/** Commit a resolved battle snapshot (after animated playback or instant resolve). */
export function applyFightBattle(
  state: RunState,
  battle: BattleState,
  locale: Locale = "en",
  consumedItemSlot?: number,
): RunState {
  if (!state.battle || state.screen.kind !== "battle") return state;
  const labels = copy[locale];
  const items =
    consumedItemSlot != null
      ? removeItemAt(state.items, consumedItemSlot)
      : state.items;
  const cleanedBattle: BattleState = {
    ...battle,
    pendingItemId: null,
    pendingItemSlot: null,
  };

  if (cleanedBattle.phase === "lost") {
    return {
      ...state,
      battle: cleanedBattle,
      items,
      party: cleanedBattle.player.map(
        ({ side: _s, tempDefBonus: _t, ...m }) => m,
      ),
      screen: { kind: "defeat" },
      lastMessage: null,
    };
  }

  if (cleanedBattle.phase === "won") {
    let party = cleanedBattle.player.map(
      ({ side: _s, tempDefBonus: _t, ...m }) => m,
    );
    let reserve = [...state.reserve];
    let lastMessage: string | null = null;

    if (cleanedBattle.capturedMonster) {
      const caught = cleanedBattle.capturedMonster;
      if (party.length < PARTY_LIMIT) {
        party = [...party, caught];
        lastMessage = caught.name;
      } else {
        reserve = [...reserve, caught];
        lastMessage = `${caught.name} · ${labels.ui.sentToReserve}`;
      }
    }

    return {
      ...state,
      battle: cleanedBattle,
      items,
      party,
      reserve,
      lastMessage,
    };
  }

  return {
    ...state,
    battle: cleanedBattle,
    items,
    party: cleanedBattle.player.map(
      ({ side: _s, tempDefBonus: _t, ...m }) => m,
    ),
    lastMessage: null,
  };
}

export function fightRound(state: RunState, locale: Locale): RunState {
  if (!state.battle || state.screen.kind !== "battle") return state;
  if (!canStartFight(state.battle)) {
    return { ...state, lastMessage: copy[locale].ui.needPlans };
  }

  const labels = copy[locale];
  const timeline = buildFightTimeline(
    state.battle,
    labels,
    getFightSeed(state),
  );
  if (!timeline) return state;
  return applyFightBattle(
    state,
    timeline.final,
    locale,
    timeline.consumedItemSlot,
  );
}

export function claimBattleRewards(
  state: RunState,
  locale: Locale,
): RunState {
  if (!state.battle || state.battle.phase !== "won") return state;
  const labels = copy[locale];
  const xpEach = xpFromGoldReward(
    state.battle.goldReward,
    state.relics,
  );
  const battleById = new Map(
    state.battle.player.map((m) => [m.uid, m] as const),
  );

  const notes: string[] = [];
  const party = state.party.map((member) => {
    const battler = battleById.get(member.uid);
    if (!battler) {
      // Captured mid-fight (not in the original combatant list).
      return member;
    }
    if (battler.hp > 0) {
      const synced = {
        ...member,
        hp: battler.hp,
        atk: battler.atk,
        def: battler.def,
        spd: battler.spd,
        moves: [...battler.moves],
        moveUses: { ...battler.moveUses },
      };
      const result = gainXp(synced, xpEach);
      for (const note of result.notes) {
        if (note.learned) {
          const learnedName = labels.moves[note.learned].name;
          let text = `${note.name} ${labels.ui.logLearned} ${learnedName}`;
          if (note.forgot) {
            text += ` (${labels.ui.logForgot} ${labels.moves[note.forgot].name})`;
          }
          notes.push(text);
        }
      }
      return result.monster;
    }
    return {
      ...member,
      hp: 0,
      atk: battler.atk,
      def: battler.def,
      spd: battler.spd,
      moves: [...battler.moves],
      moveUses: { ...battler.moveUses },
    };
  });

  let message = `${labels.ui.rewardGold}: +${state.battle.goldReward} · ${labels.ui.rewardXp}: +${xpEach}`;
  if (notes.length) {
    message = `${message} · ${notes.join(" · ")}`;
  }
  if (state.lastMessage) {
    message = `${message} · ${state.lastMessage}`;
  }

  const next: RunState = {
    ...state,
    gold: state.gold + state.battle.goldReward,
    party,
    battle: null,
    lastMessage: message,
  };

  return advanceAfterNode(next, locale);
}

export function buyOffer(state: RunState, offer: ShopOffer, locale: Locale): RunState {
  const labels = copy[locale];
  if (state.gold < offer.cost) {
    return { ...state, lastMessage: labels.ui.notEnoughGold };
  }

  let party = state.party;
  let items = state.items;
  let relics = state.relics;
  let message: string = labels.shop[offer.labelKey];

  if (offer.kind === "heal") {
    party = restorePartyMoves(healParty(party, "half"));
  } else if (offer.kind === "buff") {
    party = applyPartyBuff(
      party,
      offer.labelKey === "buffAtk" ? "atk" : "def",
      offer.amount,
    );
  } else if (offer.kind === "recruit") {
    if (party.length >= PARTY_LIMIT) {
      return { ...state, lastMessage: labels.ui.emptyParty };
    }
    party = [...party, offer.monster];
  } else if (offer.kind === "item") {
    if (isBagFull(items)) {
      return { ...state, lastMessage: labels.ui.bagFull };
    }
    const nextItems = addItem(items, offer.itemId, 1);
    if (nextItems.length === items.length) {
      return { ...state, lastMessage: labels.ui.bagFull };
    }
    items = nextItems;
    message = labels.items[offer.itemId]?.name ?? offer.itemId;
  } else if (offer.kind === "relic") {
    if (relics.includes(offer.relicId)) {
      return { ...state, lastMessage: labels.relics[offer.relicId]?.name ?? offer.relicId };
    }
    relics = [...relics, offer.relicId];
    message = labels.relics[offer.relicId]?.name ?? offer.relicId;
  }

  return {
    ...state,
    gold: state.gold - offer.cost,
    party,
    items,
    relics,
    shopOffers: state.shopOffers.filter((o) => o.id !== offer.id),
    lastMessage: message,
  };
}

export function sellPriceFor(monster: Monster) {
  return 12 + monster.level * 8;
}

/** Sell at most one creature per shop visit. Keeps at least one in the party. */
export function sellCreature(
  state: RunState,
  monsterUid: string,
  locale: Locale,
): RunState {
  const labels = copy[locale];
  if (state.screen.kind !== "shop" || state.shopSoldCreature) {
    return { ...state, lastMessage: labels.ui.shopSellOnce };
  }
  if (state.party.length <= 1) {
    return { ...state, lastMessage: labels.ui.cannotSellLast };
  }
  const monster = state.party.find((m) => m.uid === monsterUid);
  if (!monster) return state;
  const price = sellPriceFor(monster);
  return {
    ...state,
    party: state.party.filter((m) => m.uid !== monsterUid),
    gold: state.gold + price,
    shopSoldCreature: true,
    lastMessage: `${labels.ui.shopSold}: ${monster.name} (+${price} ${labels.ui.gold})`,
  };
}

export function leaveShop(state: RunState): RunState {
  return advanceAfterNode(state);
}

export function takeRest(state: RunState, locale: Locale): RunState {
  const labels = copy[locale];
  return advanceAfterNode(
    {
      ...state,
      party: restParty(state.party),
      lastMessage: labels.ui.restAction,
    },
    locale,
  );
}

export function resolveEvent(
  state: RunState,
  choiceId: string,
  locale: Locale,
): RunState {
  if (!state.event || state.eventResolved) return state;
  const labels = copy[locale];
  const node = getNode(state.map, state.currentNodeId);
  const result = applyEventChoice(
    state.event,
    choiceId,
    state.party,
    state.gold,
    labels,
    PARTY_LIMIT,
    state.seed + (node?.column ?? 0) * 31,
    state.items,
    state.relics,
  );

  if (result.startWildHabitat && node) {
    return beginWildBattle(
      {
        ...state,
        party: result.party,
        gold: result.gold,
        items: result.items,
        relics: result.relics,
        event: null,
        eventResolved: false,
        lastMessage: result.message,
      },
      result.startWildHabitat,
      node.column,
      node.id,
      locale,
      state.seed + node.column * 97 + node.row * 13 + 3,
    );
  }

  return {
    ...state,
    party: result.party,
    gold: result.gold,
    items: result.items,
    relics: result.relics,
    eventResolved: true,
    lastMessage: result.message,
  };
}

/** Use a consumable from the bag. Map or battle planning: apply immediately. */
export function useItem(
  state: RunState,
  itemIdOrSlot: string | number,
  locale: Locale,
): RunState {
  const labels = copy[locale];

  let slotIndex: number;
  let itemId: string;
  if (typeof itemIdOrSlot === "number") {
    slotIndex = itemIdOrSlot;
    const stack = state.items[slotIndex];
    if (!stack) return state;
    itemId = stack.itemId;
  } else {
    itemId = itemIdOrSlot;
    slotIndex = state.items.findIndex((s) => s.itemId === itemId);
    if (slotIndex < 0) return state;
  }

  const def = getItem(itemId);
  if (!def) return state;
  const itemName = labels.items[itemId]?.name ?? itemId;
  const items = removeItemAt(state.items, slotIndex);

  if (state.screen.kind === "battle") {
    if (!state.battle || state.battle.phase !== "planning") return state;
    const player = applyItemEffectsToParty(state.battle.player, def.effects);
    const used = labels.ui.itemUsed.replace("{item}", itemName);
    return {
      ...state,
      items,
      party: player.map(({ side: _s, tempDefBonus: _t, ...m }) => m),
      battle: {
        ...state.battle,
        player,
        pendingItemId: null,
        pendingItemSlot: null,
        log: [
          ...state.battle.log,
          {
            id: `item-${state.battle.log.length}-${slotIndex}`,
            text: used,
          },
        ].slice(-12),
      },
      lastMessage: itemName,
    };
  }

  return {
    ...state,
    party: applyItemEffectsToParty(state.party, def.effects),
    items,
    lastMessage: itemName,
  };
}

export function continueFromEvent(state: RunState): RunState {
  if (!state.eventResolved) return state;
  return advanceAfterNode(state);
}

/** Swap a reserve beast into the party (1-for-1). Party must stay ≥ 1. */
export function swapReserveIntoParty(
  state: RunState,
  reserveUid: string,
  partyUid: string,
): RunState {
  const fromReserve = state.reserve.find((m) => m.uid === reserveUid);
  const fromParty = state.party.find((m) => m.uid === partyUid);
  if (!fromReserve || !fromParty) return state;
  return {
    ...state,
    party: state.party.map((m) => (m.uid === partyUid ? fromReserve : m)),
    reserve: state.reserve.map((m) => (m.uid === reserveUid ? fromParty : m)),
  };
}

/** Move a party beast to reserve (keeps at least one in party). */
export function movePartyToReserve(state: RunState, partyUid: string): RunState {
  if (state.party.length <= 1) return state;
  const monster = state.party.find((m) => m.uid === partyUid);
  if (!monster) return state;
  return {
    ...state,
    party: state.party.filter((m) => m.uid !== partyUid),
    reserve: [...state.reserve, monster],
  };
}

/** Move a reserve beast into party if there is room. */
export function moveReserveToParty(state: RunState, reserveUid: string): RunState {
  if (state.party.length >= PARTY_LIMIT) return state;
  const monster = state.reserve.find((m) => m.uid === reserveUid);
  if (!monster) return state;
  return {
    ...state,
    party: [...state.party, monster],
    reserve: state.reserve.filter((m) => m.uid !== reserveUid),
  };
}

export { allPlansReady, canFight, canStartFight } from "./combat";
