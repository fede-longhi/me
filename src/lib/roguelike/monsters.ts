import type { LocaleLabel } from "./content";
import { SPECIES } from "./content";
import {
  initMoveUses,
  learnMovesForLevelUp,
  movesKnownAtLevel,
  restoreAllMoveUses,
  trimMoves,
} from "./moves";
import type { Element, Monster, MoveId, Species } from "./types";
import { MAX_MOVES } from "./types";

let uidCounter = 0;

export function nextUid(prefix = "m") {
  uidCounter += 1;
  return `${prefix}-${uidCounter}-${Math.floor(Math.random() * 1e6)}`;
}

export function resetUidCounter() {
  uidCounter = 0;
}

export function xpToNext(level: number) {
  return 12 + level * 8;
}

export function scaledStat(base: number, level: number) {
  return Math.max(1, Math.round(base + (level - 1) * (base * 0.22)));
}

export function createMonster(
  species: Species,
  level: number,
  labels: LocaleLabel,
): Monster {
  const maxHp = scaledStat(species.baseHp, level);
  const known = trimMoves(movesKnownAtLevel(species.learnset, level), MAX_MOVES);
  return {
    uid: nextUid(species.id),
    speciesId: species.id,
    name: labels.species[species.id],
    element: species.element,
    level,
    xp: 0,
    maxHp,
    hp: maxHp,
    atk: scaledStat(species.baseAtk, level),
    def: scaledStat(species.baseDef, level),
    spd: scaledStat(species.baseSpd, level),
    moves: known,
    moveUses: initMoveUses(known),
  };
}

export function createMonsterById(
  speciesId: keyof typeof SPECIES,
  level: number,
  labels: LocaleLabel,
) {
  return createMonster(SPECIES[speciesId], level, labels);
}

export function healParty(party: Monster[], amount: number | "full" | "half") {
  return party.map((m) => {
    if (amount === "full") return { ...m, hp: m.maxHp };
    if (amount === "half") {
      const heal = Math.max(1, Math.round(m.maxHp * 0.5));
      return { ...m, hp: Math.min(m.maxHp, m.hp + heal) };
    }
    return { ...m, hp: Math.min(m.maxHp, m.hp + amount) };
  });
}

export function restorePartyMoves(party: Monster[]) {
  return party.map((m) => ({
    ...m,
    moveUses: restoreAllMoveUses(m.moves),
  }));
}

/** Rest / healing spots: recover 50% max HP and refill move uses. */
export function restParty(party: Monster[]) {
  return restorePartyMoves(healParty(party, "half"));
}

export function applyPartyBuff(
  party: Monster[],
  stat: "atk" | "def",
  amount: number,
) {
  return party.map((m) => ({
    ...m,
    [stat]: m[stat] + amount,
  }));
}

export type LevelUpNote = {
  uid: string;
  name: string;
  learned: MoveId | null;
  forgot: MoveId | null;
};

export function gainXp(
  monster: Monster,
  amount: number,
): { monster: Monster; notes: LevelUpNote[] } {
  let next = {
    ...monster,
    xp: monster.xp + amount,
    moves: [...monster.moves],
    moveUses: { ...monster.moveUses },
  };
  const notes: LevelUpNote[] = [];
  const species = SPECIES[monster.speciesId];

  while (next.xp >= xpToNext(next.level)) {
    next.xp -= xpToNext(next.level);
    next.level += 1;
    next.maxHp = Math.round(next.maxHp * 1.12);
    next.hp = next.maxHp;
    next.atk = Math.round(next.atk * 1.1);
    next.def = Math.round(next.def * 1.08);
    next.spd = Math.round(next.spd * 1.05);

    const learned = learnMovesForLevelUp(
      next.moves,
      next.moveUses,
      species.learnset,
      next.level,
      MAX_MOVES,
    );
    next.moves = learned.moves;
    next.moveUses = learned.moveUses;
    if (learned.learned) {
      notes.push({
        uid: next.uid,
        name: next.name,
        learned: learned.learned,
        forgot: learned.forgot,
      });
    }
  }

  return { monster: next, notes };
}

export function typeMultiplier(attacker: Element, defender: Element): number {
  const advantages: Partial<Record<Element, Element>> = {
    ember: "moss",
    tide: "ember",
    gale: "tide",
    moss: "gale",
    spark: "shade",
    shade: "spark",
  };
  if (advantages[attacker] === defender) return 1.4;
  if (advantages[defender] === attacker) return 0.7;
  return 1;
}

export function calcMoveDamage(
  attacker: Monster,
  defender: Monster,
  power: number,
  moveElement: Element,
  defenderTempDef = 0,
) {
  const mult = typeMultiplier(moveElement, defender.element);
  const def = defender.def + defenderTempDef;
  const raw = attacker.atk * power * mult - def * 0.55;
  return Math.max(1, Math.round(raw + Math.random() * 1.5));
}

/** Deterministic damage preview (no RNG). */
export function estimateMoveDamage(
  attacker: Monster,
  defender: Monster,
  power: number,
  moveElement: Element,
  defenderTempDef = 0,
) {
  const mult = typeMultiplier(moveElement, defender.element);
  const def = defender.def + defenderTempDef;
  const raw = attacker.atk * power * mult - def * 0.55;
  return Math.max(1, Math.round(raw + 0.75));
}
