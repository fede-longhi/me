import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BEAT_MS,
  GESTURES,
  createMenuBattle,
  isOnBeat,
  performGesture,
  scoreGesture,
  sixSevenCeiling,
  startCountdown,
  tickBattle,
  type Fighter,
} from "./engine.ts";

const frozen = () => 0.5;

function fighter(partial: Partial<Fighter> = {}): Fighter {
  return {
    name: "Vos",
    aura: 0,
    pose: "idle",
    poseUntil: 0,
    lastGesture: null,
    streak: 0,
    lastAt: 0,
    ...partial,
  };
}

describe("Farmear Aura scoring", () => {
  it("gives ice more aura than the six seven ceiling", () => {
    const ice = scoreGesture({
      gesture: "ice",
      now: 10_000,
      fighter: fighter(),
      beatOrigin: 0,
      sixSevenUntil: 0,
      rng: frozen,
    });
    const six = scoreGesture({
      gesture: "sixseven",
      now: 10_000,
      fighter: fighter(),
      beatOrigin: 0,
      sixSevenUntil: 10_000,
      rng: frozen,
    });

    assert.ok(ice.delta >= GESTURES.ice.min);
    assert.ok(six.delta <= sixSevenCeiling());
    assert.ok(sixSevenCeiling() < GESTURES.ice.min);
    assert.ok(ice.delta > six.delta);
    assert.ok(six.tags.includes("sixseven"));
    assert.ok(six.tags.includes("window"));
  });

  it("subtracts aura when the same gesture is spammed", () => {
    const first = scoreGesture({
      gesture: "flex",
      now: 5_000,
      fighter: fighter(),
      beatOrigin: 0,
      sixSevenUntil: 0,
      rng: frozen,
    });
    const second = scoreGesture({
      gesture: "flex",
      now: 5_500,
      fighter: fighter({ lastGesture: "flex", streak: 1, lastAt: 5_000 }),
      beatOrigin: 0,
      sixSevenUntil: 0,
      rng: frozen,
    });
    const third = scoreGesture({
      gesture: "flex",
      now: 6_000,
      fighter: fighter({ lastGesture: "flex", streak: 2, lastAt: 5_500 }),
      beatOrigin: 0,
      sixSevenUntil: 0,
      rng: frozen,
    });

    assert.ok(first.delta > 0);
    assert.ok(second.delta > 0);
    assert.ok(second.delta < first.delta);
    assert.ok(second.tags.includes("spam"));
    assert.ok(third.delta < 0);
    assert.ok(third.tags.includes("cringe"));
  });

  it("penalizes mashing faster than the gap", () => {
    const mashed = scoreGesture({
      gesture: "walk",
      now: 1_050,
      fighter: fighter({ lastGesture: "ice", streak: 1, lastAt: 1_000 }),
      beatOrigin: 0,
      sixSevenUntil: 0,
      rng: frozen,
    });
    assert.ok(mashed.tags.includes("mash"));
    assert.ok(mashed.tags.includes("cringe"));
  });

  it("pays more on the beat than off the beat", () => {
    const on = scoreGesture({
      gesture: "point",
      now: BEAT_MS * 4,
      fighter: fighter(),
      beatOrigin: 0,
      sixSevenUntil: 0,
      rng: frozen,
    });
    const off = scoreGesture({
      gesture: "point",
      now: BEAT_MS * 4 + BEAT_MS / 2,
      fighter: fighter(),
      beatOrigin: 0,
      sixSevenUntil: 0,
      rng: frozen,
    });
    assert.equal(isOnBeat(BEAT_MS * 4, 0), true);
    assert.equal(isOnBeat(BEAT_MS * 4 + BEAT_MS / 2, 0), false);
    assert.ok(on.delta > off.delta);
    assert.ok(on.tags.includes("onbeat"));
    assert.ok(!off.tags.includes("onbeat"));
  });

  it("ignores gestures before the fight starts", () => {
    const menu = createMenuBattle("Vos", "NPC", 0);
    const after = performGesture(menu, "you", "ice", 100, frozen);
    assert.equal(after.you.aura, 0);
    assert.equal(after, menu);
  });

  it("ends the round with the higher aura as winner", () => {
    let battle = startCountdown(
      createMenuBattle("Vos", "NPC", 0),
      "Vos",
      "NPC",
      1_000,
      frozen,
    );
    battle = tickBattle(battle, battle.fightAt, frozen);
    assert.equal(battle.phase, "fight");
    battle = {
      ...battle,
      you: { ...battle.you, aura: 2000 },
      rival: { ...battle.rival, aura: 670 },
    };
    battle = tickBattle(battle, battle.endsAt, frozen);
    assert.equal(battle.phase, "result");
    assert.equal(battle.winner, "you");
  });
});
