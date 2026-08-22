import type { Locale } from "@/lib/types";
import type { GestureId, ScoreTag, Winner } from "./engine";

export type GameCopy = {
  eyebrow: string;
  title: string;
  lead: string;
  youDefault: string;
  start: string;
  rematch: string;
  how: string;
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
  gestures: Record<GestureId, { name: string; hint: string; key: string }>;
  rivals: string[];
  tagLabel: Record<ScoreTag, string>;
};

const ES: GameCopy = {
  eyebrow: "Batalla de aura",
  title: "Farmear Aura",
  lead: "Un round. Gestos a ritmo. El que más aura junta gana. Repetir es cringe. Six seven aparece, suma, y no es lo más aura.",
  youDefault: "Vos",
  start: "Farmeá",
  rematch: "Otra ronda",
  how: "Tocá un gesto cuando el pulso está lleno. Variá. Si spameás, perdés aura.",
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
    ice: { name: "Hielo", hint: "Mirar a otro lado", key: "1" },
    flex: { name: "Flex", hint: "Pecho inflado", key: "2" },
    walk: { name: "Caminata", hint: "Paso lento", key: "3" },
    point: { name: "Señalá", hint: "Al rival", key: "4" },
    sixseven: { name: "Six Seven", hint: "El gesto", key: "5" },
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
  lead: "One round. Hit gestures on the pulse. Highest aura wins. Repeating is cringe. Six seven shows up, scores, and is never the peak.",
  youDefault: "You",
  start: "Farm it",
  rematch: "Again",
  how: "Tap a gesture when the pulse is full. Mix it up. Spam and you lose aura.",
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
    ice: { name: "Ice", hint: "Look away", key: "1" },
    flex: { name: "Flex", hint: "Chest out", key: "2" },
    walk: { name: "Walk", hint: "Slow step", key: "3" },
    point: { name: "Point", hint: "At them", key: "4" },
    sixseven: { name: "Six Seven", hint: "The move", key: "5" },
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
