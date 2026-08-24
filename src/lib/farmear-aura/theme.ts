export const THEME_STEPS_PER_BEAT = 4;
export const THEME_BEATS_PER_BAR = 4;
export const THEME_BARS = 4;
export const THEME_STEPS =
  THEME_STEPS_PER_BEAT * THEME_BEATS_PER_BAR * THEME_BARS;

export function themeStepMs(beatMs: number) {
  return beatMs / THEME_STEPS_PER_BEAT;
}

export function themeLoopMs(beatMs: number) {
  return themeStepMs(beatMs) * THEME_STEPS;
}

/** D# minor — dark phonk color, original hook (not a licensed track). */
export const THEME_SCALE_PC = [1, 3, 5, 6, 8, 10, 11] as const;

export type ThemeVoice =
  | "kick"
  | "clap"
  | "hat"
  | "cowbell"
  | "bass"
  | "lead";

export type ThemeMode = "intro" | "full";

export type ThemeHit = {
  step: number;
  voice: ThemeVoice;
  midi?: number;
  slideTo?: number;
  gain: number;
};

const INTRO_VOICES = new Set<ThemeVoice>(["kick", "clap", "hat"]);

function hit(
  step: number,
  voice: ThemeVoice,
  gain: number,
  midi?: number,
  slideTo?: number,
): ThemeHit {
  return { step, voice, gain, midi, slideTo };
}

function eachBar(barStep: number, write: (step: number) => ThemeHit[]) {
  const hits: ThemeHit[] = [];
  for (let bar = 0; bar < THEME_BARS; bar += 1) {
    hits.push(...write(bar * 16 + barStep));
  }
  return hits;
}

/** 4-bar loop locked to the game pulse. */
export const THEME_HITS: ThemeHit[] = [
  ...eachBar(0, (step) => [hit(step, "kick", 0.86)]),
  ...eachBar(8, (step) => [hit(step, "kick", 0.78)]),
  hit(14, "kick", 0.42),
  hit(30, "kick", 0.38),
  hit(46, "kick", 0.42),
  hit(62, "kick", 0.5),

  ...eachBar(4, (step) => [hit(step, "clap", 0.34)]),
  ...eachBar(12, (step) => [hit(step, "clap", 0.38)]),

  ...Array.from({ length: THEME_STEPS }, (_, step) =>
    hit(step, "hat", step % 2 === 0 ? 0.07 : 0.12),
  ),

  hit(6, "cowbell", 0.16),
  hit(22, "cowbell", 0.2),
  hit(38, "cowbell", 0.16),
  hit(54, "cowbell", 0.22),
  hit(60, "cowbell", 0.14),

  hit(0, "bass", 0.42, 27, 22),
  hit(8, "bass", 0.34, 27),
  hit(10, "bass", 0.28, 30),
  hit(12, "bass", 0.3, 27),
  hit(16, "bass", 0.4, 22, 20),
  hit(24, "bass", 0.32, 25, 20),
  hit(32, "bass", 0.42, 27),
  hit(40, "bass", 0.3, 32),
  hit(42, "bass", 0.26, 30),
  hit(44, "bass", 0.28, 27),
  hit(48, "bass", 0.44, 20, 15),
  hit(56, "bass", 0.36, 27, 22),

  hit(0, "lead", 0.12, 63),
  hit(4, "lead", 0.1, 61),
  hit(8, "lead", 0.11, 58),
  hit(12, "lead", 0.1, 56),
  hit(16, "lead", 0.11, 54),
  hit(22, "lead", 0.1, 56),
  hit(24, "lead", 0.12, 58),
  hit(28, "lead", 0.14, 51),
  hit(32, "lead", 0.13, 63),
  hit(34, "lead", 0.1, 61),
  hit(36, "lead", 0.1, 58),
  hit(40, "lead", 0.11, 56),
  hit(44, "lead", 0.1, 54),
  hit(48, "lead", 0.14, 51),
  hit(60, "lead", 0.12, 63),
  hit(62, "lead", 0.1, 58),
];

export function midiToHz(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function pitchClass(midi: number) {
  return ((midi % 12) + 12) % 12;
}

export function isThemeScaleNote(midi: number) {
  return (THEME_SCALE_PC as readonly number[]).includes(pitchClass(midi));
}

export function hitsAtStep(step: number, mode: ThemeMode = "full") {
  const index = ((step % THEME_STEPS) + THEME_STEPS) % THEME_STEPS;
  return THEME_HITS.filter((hit) => {
    if (hit.step !== index) return false;
    if (mode === "intro" && !INTRO_VOICES.has(hit.voice)) return false;
    return true;
  });
}

export function themeVoices(mode: ThemeMode): ThemeVoice[] {
  const voices = new Set<ThemeVoice>();
  for (const hit of THEME_HITS) {
    if (mode === "intro" && !INTRO_VOICES.has(hit.voice)) continue;
    voices.add(hit.voice);
  }
  return [...voices];
}
