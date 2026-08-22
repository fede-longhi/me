import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BEAT_MS } from "./engine.ts";
import {
  THEME_BARS,
  THEME_BEATS_PER_BAR,
  THEME_HITS,
  THEME_STEPS,
  hitsAtStep,
  isThemeScaleNote,
  themeLoopMs,
  themeVoices,
} from "./theme.ts";

describe("Farmear Aura theme", () => {
  it("locks the loop to sixteen game beats", () => {
    assert.equal(THEME_STEPS, 64);
    assert.equal(themeLoopMs(BEAT_MS), BEAT_MS * THEME_BEATS_PER_BAR * THEME_BARS);
  });

  it("keeps a half-time kick and clap grid", () => {
    for (let step = 0; step < THEME_STEPS; step += 8) {
      assert.ok(
        hitsAtStep(step).some((hit) => hit.voice === "kick"),
        `missing kick on step ${step}`,
      );
    }
    for (let step = 4; step < THEME_STEPS; step += 8) {
      assert.ok(
        hitsAtStep(step).some((hit) => hit.voice === "clap"),
        `missing clap on step ${step}`,
      );
    }
  });

  it("keeps pitched voices in D sharp minor", () => {
    for (const hit of THEME_HITS) {
      if (hit.midi !== undefined) assert.equal(isThemeScaleNote(hit.midi), true);
      if (hit.slideTo !== undefined) assert.equal(isThemeScaleNote(hit.slideTo), true);
    }
  });

  it("holds the lead back during countdown", () => {
    const intro = themeVoices("intro");
    const full = themeVoices("full");
    assert.deepEqual(intro.sort(), ["clap", "hat", "kick"]);
    assert.ok(full.includes("lead"));
    assert.ok(full.includes("bass"));
    assert.equal(
      hitsAtStep(0, "intro").some((hit) => hit.voice === "lead"),
      false,
    );
    assert.equal(
      hitsAtStep(0, "full").some((hit) => hit.voice === "lead"),
      true,
    );
  });

  it("wraps steps around the loop", () => {
    assert.deepEqual(hitsAtStep(0).map((hit) => hit.voice).sort(), hitsAtStep(64).map((hit) => hit.voice).sort());
  });
});
