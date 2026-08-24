import type { Locale } from "@/lib/types";
import type { GestureId, ScoreTag, Winner } from "./engine";
import { FACE_GESTURE_IDS, BODY_GESTURE_IDS, MAX_LOADOUT, MIN_LOADOUT } from "./engine";

export type GestureCopy = {
  name: string;
  hint: string;
};

export type GameCopy = {
  eyebrow: string;
  title: string;
  lead: string;
  youDefault: string;
  start: string;
  rematch: string;
  how: string;
  pickTitle: string;
  pickHint: string;
  pickCount: string;
  bodyGroup: string;
  faceGroup: string;
  vs: string;
  live: string;
  aura: string;
  time: string;
  mute: string;
  unmute: string;
  go: string;
  sixBanner: string;
  sixHint: string;
  youWin: string;
  rivalWin: string;
  tie: string;
  gestures: Record<GestureId, GestureCopy>;
  rivals: string[];
  tagLabel: Record<ScoreTag, string>;
};

const ES: GameCopy = {
  eyebrow: "Batalla de aura",
  title: "Farmear Aura",
  lead: "Elegí hasta seis gestos. El que más aura junta gana. Repetir es cringe. Six seven aparece, suma, y no es lo más aura.",
  youDefault: "Vos",
  start: "Farmeá",
  rematch: "Otra ronda",
  how: "Tocá un gesto cuando el pulso está lleno. Variá. Si spameás, perdés aura.",
  pickTitle: "Armá tu kit",
  pickHint: `Elegí de ${MIN_LOADOUT} a ${MAX_LOADOUT} gestos. Cara y cuerpo suman.`,
  pickCount: "elegidos",
  bodyGroup: "Cuerpo",
  faceGroup: "Cara",
  vs: "VS",
  live: "AURA LIVE",
  aura: "aura",
  time: "tiempo",
  mute: "Silencio",
  unmute: "Sonido",
  go: "FARMEA",
  sixBanner: "SIX SEVEN",
  sixHint: "Ahora. No es el máximo. Es el momento.",
  youWin: "Más aura. Ganaste.",
  rivalWin: "Te farmeó. Perdiste.",
  tie: "Empate de aura. Incómodo.",
  gestures: {
    ice: { name: "Hielo", hint: "Mirar a otro lado" },
    flex: { name: "Flex", hint: "Pecho inflado" },
    walk: { name: "Caminata", hint: "Paso lento" },
    point: { name: "Señalá", hint: "Al rival" },
    shrug: { name: "Shrug", hint: "No me importa" },
    sixseven: { name: "Six Seven", hint: "El gesto" },
    smirk: { name: "Smirk", hint: "Media sonrisa" },
    sideeye: { name: "Side-eye", hint: "Mirada de costado" },
    deadpan: { name: "Deadpan", hint: "Cara de piedra" },
    brow: { name: "Cejas", hint: "Una sube" },
    wink: { name: "Guiño", hint: "Un ojo" },
    nod: { name: "Cabeza", hint: "Asentir lento" },
  },
  rivals: [
    "El Primo",
    "NPC del gym",
    "Mirada al horizonte",
    "Facu Aura",
    "el del 67",
    "Main Character",
  ],
  tagLabel: {
    onbeat: "al ritmo",
    spam: "repetiste",
    cringe: "cringe",
    mash: "mash",
    sixseven: "6 7",
    window: "ventana",
  },
};

const EN: GameCopy = {
  eyebrow: "Aura battle",
  title: "Farmear Aura",
  lead: "Pick up to six gestures. Highest aura wins. Repeating is cringe. Six seven shows up, scores, and is never the peak.",
  youDefault: "You",
  start: "Farm it",
  rematch: "Again",
  how: "Tap a gesture when the pulse is full. Mix it up. Spam and you lose aura.",
  pickTitle: "Build your kit",
  pickHint: `Pick ${MIN_LOADOUT} to ${MAX_LOADOUT} moves. Face and body both farm.`,
  pickCount: "picked",
  bodyGroup: "Body",
  faceGroup: "Face",
  vs: "VS",
  live: "AURA LIVE",
  aura: "aura",
  time: "time",
  mute: "Mute",
  unmute: "Sound",
  go: "FARM",
  sixBanner: "SIX SEVEN",
  sixHint: "Now. Not the max. Just the moment.",
  youWin: "More aura. You win.",
  rivalWin: "They farmed you.",
  tie: "Aura tie. Awkward.",
  gestures: {
    ice: { name: "Ice", hint: "Look away" },
    flex: { name: "Flex", hint: "Chest out" },
    walk: { name: "Walk", hint: "Slow step" },
    point: { name: "Point", hint: "At them" },
    shrug: { name: "Shrug", hint: "Whatever" },
    sixseven: { name: "Six Seven", hint: "The move" },
    smirk: { name: "Smirk", hint: "Half smile" },
    sideeye: { name: "Side-eye", hint: "Look aside" },
    deadpan: { name: "Deadpan", hint: "Stone face" },
    brow: { name: "Brow", hint: "One up" },
    wink: { name: "Wink", hint: "One eye" },
    nod: { name: "Nod", hint: "Slow yes" },
  },
  rivals: [
    "Gym NPC",
    "Horizon Stare",
    "67 Kid",
    "Main Character",
    "Cousin Flex",
    "Facu Aura",
  ],
  tagLabel: {
    onbeat: "on beat",
    spam: "repeat",
    cringe: "cringe",
    mash: "mash",
    sixseven: "6 7",
    window: "window",
  },
};

export function gameCopy(locale: Locale): GameCopy {
  return locale === "es" ? ES : EN;
}

export function resultCopy(copy: GameCopy, winner: Winner | null) {
  if (winner === "you") return copy.youWin;
  if (winner === "rival") return copy.rivalWin;
  return copy.tie;
}

export function pickRivalName(copy: GameCopy, rng: () => number) {
  return copy.rivals[Math.floor(rng() * copy.rivals.length)] ?? copy.rivals[0];
}

export function gestureGroups() {
  return {
    body: BODY_GESTURE_IDS,
    face: FACE_GESTURE_IDS,
  };
}
