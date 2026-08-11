import type { Locale } from "@/lib/types";
import {
  buildEncounter,
  buildWildEncounter,
  canFight,
  clearPlan,
  executeFightRound,
  randomStarterOptions,
  rewardGoldFor,
  setCaptureAttempt as setBattleCaptureAttempt,
  setPlan,
  setSkipPlan,
  startBattle,
} from "./combat";
import { copy } from "./content";
import {
  applyEventChoice,
  buildShopOffers,
  pickRandomEvent,
} from "./events";
import { generateMap, getNode } from "./map";
import {
  applyPartyBuff,
  gainXp,
  resetUidCounter,
  restParty,
} from "./monsters";
import type {
  BattleState,
  HabitatId,
  Monster,
  MoveId,
  RunState,
  ShopOffer,
} from "./types";
import { PARTY_LIMIT } from "./types";

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
  const enemies = buildWildEncounter(habitat, column, seed, labels);
  const battle = startBattle(
    state.party,
    enemies,
    rewardGoldFor("habitat", column),
    labels,
    seed,
    { kind: "wild", habitat },
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

export function createRun(locale: Locale, seed = Date.now()): RunState {
  resetUidCounter();
  const map = generateMap(seed);
  return {
    seed,
    gold: 30,
    party: [],
    reserve: [],
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
      shopOffers: buildShopOffers(state.seed + node.column * 17, node.column, labels),
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
      event: pickRandomEvent(state.seed + node.column * 31 + node.row * 7),
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
      state.seed + node.column * 97 + node.row * 13,
    );
  }

  const enemies = buildEncounter(
    node.type,
    node.column,
    state.seed + node.column * 97 + node.row * 13,
    labels,
  );
  const battle = startBattle(
    state.party,
    enemies,
    rewardGoldFor(node.type, node.column),
    labels,
    state.seed + node.column * 97 + node.row * 13,
    { kind: "enemy", habitat: null },
  );

  return {
    ...base,
    screen: { kind: "battle", nodeId },
    battle,
  };
}

export function advanceAfterNode(state: RunState): RunState {
  const node = getNode(state.map, state.currentNodeId);
  if (!node) return state;

  if (node.type === "boss") {
    return { ...state, screen: { kind: "victory" }, available: [], battle: null };
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
): RunState {
  if (!state.battle || state.screen.kind !== "battle") return state;
  const labels = copy[locale];

  if (battle.phase === "lost") {
    return {
      ...state,
      battle,
      party: battle.player.map(({ side: _s, tempDefBonus: _t, ...m }) => m),
      screen: { kind: "defeat" },
      lastMessage: null,
    };
  }

  if (battle.phase === "won") {
    let party = battle.player.map(({ side: _s, tempDefBonus: _t, ...m }) => m);
    let reserve = [...state.reserve];
    let lastMessage: string | null = null;

    if (battle.capturedMonster) {
      const caught = battle.capturedMonster;
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
      battle: { ...battle, capturedMonster: null },
      party,
      reserve,
      lastMessage,
    };
  }

  return {
    ...state,
    battle,
    party: battle.player.map(({ side: _s, tempDefBonus: _t, ...m }) => m),
    lastMessage: null,
  };
}

export function fightRound(state: RunState, locale: Locale): RunState {
  if (!state.battle || state.screen.kind !== "battle") return state;
  if (!canFight(state.battle)) {
    return { ...state, lastMessage: copy[locale].ui.needPlans };
  }

  const labels = copy[locale];
  const battle = executeFightRound(state.battle, labels, getFightSeed(state));
  return applyFightBattle(state, battle, locale);
}

export function claimBattleRewards(
  state: RunState,
  locale: Locale,
): RunState {
  if (!state.battle || state.battle.phase !== "won") return state;
  const labels = copy[locale];
  const xpEach = Math.max(4, Math.round(10 + state.battle.goldReward / 4));
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
      hp: Math.max(1, Math.floor(member.maxHp * 0.25)),
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

  return advanceAfterNode(next);
}

export function buyOffer(state: RunState, offer: ShopOffer, locale: Locale): RunState {
  const labels = copy[locale];
  if (state.gold < offer.cost) {
    return { ...state, lastMessage: labels.ui.notEnoughGold };
  }

  let party = state.party;
  if (offer.kind === "heal") {
    party = restParty(party);
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
  }

  return {
    ...state,
    gold: state.gold - offer.cost,
    party,
    shopOffers: state.shopOffers.filter((o) => o.id !== offer.id),
    lastMessage: labels.shop[offer.labelKey],
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
  return advanceAfterNode({
    ...state,
    party: restParty(state.party),
    lastMessage: labels.ui.restAction,
  });
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
  );

  if (result.startWildHabitat && node) {
    return beginWildBattle(
      {
        ...state,
        party: result.party,
        gold: result.gold,
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
    eventResolved: true,
    lastMessage: result.message,
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

export { canFight };
