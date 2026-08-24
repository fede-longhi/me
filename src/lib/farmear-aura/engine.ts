export const GESTURE_IDS = [
  "ice",
  "flex",
  "walk",
  "point",
  "shrug",
  "sixseven",
  "smirk",
  "sideeye",
  "deadpan",
  "brow",
  "wink",
  "nod",
] as const;

export type GestureId = (typeof GESTURE_IDS)[number];
export type GestureKind = "body" | "face";
export type PoseId = GestureId | "idle";
export type Side = "you" | "rival";
export type Phase = "menu" | "countdown" | "fight" | "result";
export type Winner = "you" | "rival" | "tie";
export type ScoreTag =
  | "onbeat"
  | "spam"
  | "cringe"
  | "mash"
  | "sixseven"
  | "window";

export type GestureDef = {
  id: GestureId;
  kind: GestureKind;
  min: number;
  max: number;
};

/** Ice is the peak. Six seven is a cameo — never the highest roll. */
export const GESTURES: Record<GestureId, GestureDef> = {
  ice: { id: "ice", kind: "body", min: 900, max: 1400 },
  flex: { id: "flex", kind: "body", min: 700, max: 1100 },
  walk: { id: "walk", kind: "body", min: 500, max: 900 },
  point: { id: "point", kind: "body", min: 300, max: 700 },
  shrug: { id: "shrug", kind: "body", min: 400, max: 750 },
  sixseven: { id: "sixseven", kind: "body", min: 67, max: 670 },
  smirk: { id: "smirk", kind: "face", min: 500, max: 850 },
  sideeye: { id: "sideeye", kind: "face", min: 450, max: 800 },
  deadpan: { id: "deadpan", kind: "face", min: 650, max: 1000 },
  brow: { id: "brow", kind: "face", min: 550, max: 900 },
  wink: { id: "wink", kind: "face", min: 350, max: 700 },
  nod: { id: "nod", kind: "face", min: 280, max: 650 },
};

export const BODY_GESTURE_IDS = GESTURE_IDS.filter(
  (id) => GESTURES[id].kind === "body",
);
export const FACE_GESTURE_IDS = GESTURE_IDS.filter(
  (id) => GESTURES[id].kind === "face",
);

export const MIN_LOADOUT = 3;
export const MAX_LOADOUT = 6;
export const DEFAULT_LOADOUT: GestureId[] = [
  "ice",
  "flex",
  "smirk",
  "sideeye",
  "deadpan",
  "sixseven",
];

export const ROUND_MS = 20_000;
export const COUNTDOWN_MS = 3_000;
export const BEAT_MS = 700;
export const BEAT_WINDOW_MS = 150;
export const MASH_GAP_MS = 220;
export const POSE_MS = 720;
export const SIX_SEVEN_WINDOW_MS = 1_800;
export const SIX_SEVEN_WINDOW_BONUS = 67;
export const AI_MIN_GAP_MS = 700;
export const MAX_POPUPS = 6;

export const SLOT_KEYS = ["1", "2", "3", "4", "5", "6"] as const;

export type Popup = {
  id: number;
  side: Side;
  delta: number;
  tags: ScoreTag[];
  gesture: GestureId;
};

export type Fighter = {
  name: string;
  aura: number;
  pose: PoseId;
  poseUntil: number;
  lastGesture: GestureId | null;
  streak: number;
  lastAt: number;
  moves: GestureId[];
};

export type Battle = {
  phase: Phase;
  you: Fighter;
  rival: Fighter;
  countdownAt: number;
  fightAt: number;
  endsAt: number;
  beatOrigin: number;
  sixSevenUntil: number;
  nextSixSevenAt: number;
  aiBeatTried: number;
  popups: Popup[];
  nextPopupId: number;
  winner: Winner | null;
};

export type Rng = () => number;

function clampAura(value: number) {
  return Math.max(-9999, Math.min(99999, Math.round(value)));
}

function rollInt(min: number, max: number, rng: Rng) {
  return min + Math.floor(rng() * (max - min + 1));
}

export function beatDistance(now: number, origin: number) {
  const elapsed = now - origin;
  const phase = ((elapsed % BEAT_MS) + BEAT_MS) % BEAT_MS;
  return Math.min(phase, BEAT_MS - phase);
}

export function isOnBeat(now: number, origin: number) {
  return beatDistance(now, origin) <= BEAT_WINDOW_MS;
}

export function beatPhase(now: number, origin: number) {
  const elapsed = now - origin;
  return (((elapsed % BEAT_MS) + BEAT_MS) % BEAT_MS) / BEAT_MS;
}

export function sixSevenCeiling() {
  return GESTURES.sixseven.max + SIX_SEVEN_WINDOW_BONUS;
}

export function isValidLoadout(moves: GestureId[]) {
  if (moves.length < MIN_LOADOUT || moves.length > MAX_LOADOUT) return false;
  const seen = new Set<GestureId>();
  for (const id of moves) {
    if (!GESTURES[id] || seen.has(id)) return false;
    seen.add(id);
  }
  return true;
}

export function toggleLoadout(moves: GestureId[], gesture: GestureId): GestureId[] {
  if (!GESTURES[gesture]) return moves;
  if (moves.includes(gesture)) return moves.filter((id) => id !== gesture);
  if (moves.length >= MAX_LOADOUT) return moves;
  return [...moves, gesture];
}

export function pickRivalLoadout(playerMoves: GestureId[], rng: Rng): GestureId[] {
  const size = Math.min(
    MAX_LOADOUT,
    Math.max(MIN_LOADOUT, playerMoves.length || DEFAULT_LOADOUT.length),
  );
  const pool = [...GESTURE_IDS];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picked = pool.slice(0, size);
  if (!picked.includes("sixseven") && rng() < 0.55 && size > 0) {
    picked[size - 1] = "sixseven";
  }
  return picked;
}

export function slotKeyMap(moves: GestureId[]): Record<string, GestureId> {
  const map: Record<string, GestureId> = {};
  moves.forEach((id, index) => {
    const key = SLOT_KEYS[index];
    if (key) map[key] = id;
  });
  return map;
}

export function createFighter(
  name: string,
  now: number,
  moves: GestureId[] = DEFAULT_LOADOUT,
): Fighter {
  return {
    name,
    aura: 0,
    pose: "idle",
    poseUntil: now,
    lastGesture: null,
    streak: 0,
    lastAt: now - 1_000,
    moves: [...moves],
  };
}

export function createMenuBattle(
  youName: string,
  rivalName: string,
  now = 0,
  youMoves: GestureId[] = DEFAULT_LOADOUT,
): Battle {
  return {
    phase: "menu",
    you: createFighter(youName, now, youMoves),
    rival: createFighter(rivalName, now, DEFAULT_LOADOUT),
    countdownAt: 0,
    fightAt: 0,
    endsAt: 0,
    beatOrigin: now,
    sixSevenUntil: 0,
    nextSixSevenAt: 0,
    aiBeatTried: -1,
    popups: [],
    nextPopupId: 1,
    winner: null,
  };
}

export function startCountdown(
  battle: Battle,
  youName: string,
  rivalName: string,
  now: number,
  rng: Rng,
  youMoves: GestureId[] = battle.you.moves,
): Battle {
  const moves = isValidLoadout(youMoves) ? youMoves : DEFAULT_LOADOUT;
  const rivalMoves = pickRivalLoadout(moves, rng);
  const fightAt = now + COUNTDOWN_MS;
  return {
    ...createMenuBattle(youName, rivalName, now, moves),
    phase: "countdown",
    you: createFighter(youName, now, moves),
    rival: createFighter(rivalName, now, rivalMoves),
    countdownAt: now,
    fightAt,
    endsAt: fightAt + ROUND_MS,
    beatOrigin: fightAt,
    nextSixSevenAt: fightAt + 4_200 + Math.floor(rng() * 1_800),
  };
}

function withPopup(battle: Battle, popup: Omit<Popup, "id">): Battle {
  const next: Popup = { ...popup, id: battle.nextPopupId };
  return {
    ...battle,
    nextPopupId: battle.nextPopupId + 1,
    popups: [next, ...battle.popups].slice(0, MAX_POPUPS),
  };
}

export function scoreGesture(args: {
  gesture: GestureId;
  now: number;
  fighter: Fighter;
  beatOrigin: number;
  sixSevenUntil: number;
  rng: Rng;
}) {
  const { gesture, now, fighter, beatOrigin, sixSevenUntil, rng } = args;
  const tags: ScoreTag[] = [];
  const def = GESTURES[gesture];
  const same = fighter.lastGesture === gesture;
  const streak = same ? fighter.streak + 1 : 1;
  const mashed = now - fighter.lastAt < MASH_GAP_MS;

  if (gesture === "sixseven") tags.push("sixseven");

  if (streak >= 3 || (streak >= 2 && mashed)) {
    tags.push("cringe", "spam");
    const cringe = -(180 + streak * 90 + (mashed ? 80 : 0));
    return { delta: cringe, tags, streak };
  }

  let delta = rollInt(def.min, def.max, rng);

  if (streak === 2) {
    tags.push("spam");
    delta = Math.round(delta * 0.28);
  }

  if (mashed) {
    tags.push("mash", "cringe");
    delta -= 160;
  }

  if (isOnBeat(now, beatOrigin) && delta > 0) {
    tags.push("onbeat");
    delta = Math.round(delta * 1.35);
  }

  if (gesture === "sixseven" && now <= sixSevenUntil) {
    tags.push("window");
    delta += SIX_SEVEN_WINDOW_BONUS;
  }

  return { delta, tags, streak };
}

export function performGesture(
  battle: Battle,
  side: Side,
  gesture: GestureId,
  now: number,
  rng: Rng,
): Battle {
  if (battle.phase !== "fight") return battle;

  const fighter = battle[side];
  if (!fighter.moves.includes(gesture)) return battle;

  const scored = scoreGesture({
    gesture,
    now,
    fighter,
    beatOrigin: battle.beatOrigin,
    sixSevenUntil: battle.sixSevenUntil,
    rng,
  });

  const nextFighter: Fighter = {
    ...fighter,
    aura: clampAura(fighter.aura + scored.delta),
    pose: gesture,
    poseUntil: now + POSE_MS,
    lastGesture: gesture,
    streak: scored.streak,
    lastAt: now,
  };

  return withPopup(
    {
      ...battle,
      [side]: nextFighter,
    },
    {
      side,
      delta: scored.delta,
      tags: scored.tags,
      gesture,
    },
  );
}

function pickAiGesture(battle: Battle, rng: Rng): GestureId {
  const moves = battle.rival.moves;
  if (moves.length === 0) return "flex";

  if (
    battle.sixSevenUntil > 0 &&
    moves.includes("sixseven") &&
    rng() < 0.42
  ) {
    return "sixseven";
  }

  const pool = moves.filter((id) => id !== battle.rival.lastGesture);
  const choices = pool.length > 0 && rng() < 0.82 ? pool : [...moves];
  const weights = choices.map((id) =>
    id === "ice" ? 1.15 : id === "sixseven" ? 0.7 : id === "deadpan" ? 1.08 : 1,
  );
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = rng() * total;
  for (let i = 0; i < choices.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) return choices[i];
  }
  return choices[choices.length - 1];
}

function maybeAiAct(battle: Battle, now: number, rng: Rng): Battle {
  if (battle.phase !== "fight") return battle;

  const beatIndex = Math.floor((now - battle.beatOrigin) / BEAT_MS);
  if (beatIndex < 0 || beatIndex === battle.aiBeatTried) return battle;
  if (beatDistance(now, battle.beatOrigin) > BEAT_WINDOW_MS) return battle;

  const marked: Battle = { ...battle, aiBeatTried: beatIndex };
  if (now - marked.rival.lastAt < AI_MIN_GAP_MS) return marked;
  if (rng() > 0.52) return marked;

  const gesture =
    marked.rival.lastGesture &&
    marked.rival.moves.includes(marked.rival.lastGesture) &&
    rng() < 0.16
      ? marked.rival.lastGesture
      : pickAiGesture(marked, rng);

  return performGesture(marked, "rival", gesture, now, rng);
}

function settlePoses(fighter: Fighter, now: number): Fighter {
  if (fighter.pose === "idle" || now < fighter.poseUntil) return fighter;
  return { ...fighter, pose: "idle" };
}

function decideWinner(you: number, rival: number): Winner {
  if (you === rival) return "tie";
  return you > rival ? "you" : "rival";
}

export function tickBattle(battle: Battle, now: number, rng: Rng): Battle {
  if (battle.phase === "menu" || battle.phase === "result") {
    const you = settlePoses(battle.you, now);
    const rival = settlePoses(battle.rival, now);
    if (you === battle.you && rival === battle.rival) return battle;
    return { ...battle, you, rival };
  }

  let next = battle;

  if (next.phase === "countdown" && now >= next.fightAt) {
    next = { ...next, phase: "fight" };
  }

  if (next.phase === "fight") {
    if (now >= next.endsAt) {
      const you = settlePoses(next.you, now);
      const rival = settlePoses(next.rival, now);
      return {
        ...next,
        phase: "result",
        you,
        rival,
        winner: decideWinner(you.aura, rival.aura),
        sixSevenUntil: 0,
      };
    }

    if (now >= next.nextSixSevenAt) {
      next = {
        ...next,
        sixSevenUntil: now + SIX_SEVEN_WINDOW_MS,
        nextSixSevenAt:
          now + SIX_SEVEN_WINDOW_MS + 5_500 + Math.floor(rng() * 3_200),
      };
    }

    next = maybeAiAct(next, now, rng);
  }

  const you = settlePoses(next.you, now);
  const rival = settlePoses(next.rival, now);
  if (next === battle && you === battle.you && rival === battle.rival) {
    return battle;
  }

  return { ...next, you, rival };
}

export function remainingMs(battle: Battle, now: number) {
  if (battle.phase === "countdown") return Math.max(0, battle.fightAt - now);
  if (battle.phase === "fight") return Math.max(0, battle.endsAt - now);
  return 0;
}

export function countdownDigit(battle: Battle, now: number) {
  if (battle.phase !== "countdown") return null;
  const left = battle.fightAt - now;
  if (left <= 280) return "go";
  return String(Math.max(1, Math.ceil(left / 1_000)));
}

export function isSixSevenLive(battle: Battle, now: number) {
  return battle.phase === "fight" && now <= battle.sixSevenUntil;
}
