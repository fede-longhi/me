import type {
  MoveDef,
  MoveEffect,
  MoveId,
  PassiveEffect,
} from "../../types";

/** Convert legacy kind/power/effect into effects[]. */
export function normalizeMoveDef(raw: MoveDef): MoveDef {
  if (Array.isArray(raw.effects) && raw.effects.length > 0) {
    return {
      id: raw.id,
      effects: raw.effects,
      ...(raw.element ? { element: raw.element } : {}),
      maxUses: raw.maxUses,
    };
  }

  const effects: MoveEffect[] = [];
  if (raw.kind === "attack" || (raw.power != null && !raw.effect)) {
    effects.push({
      type: "damage",
      power: raw.power ?? 1,
      target: "foe",
      ...(raw.element ? { element: raw.element } : {}),
    });
  } else if (raw.effect) {
    effects.push(legacyPassiveToEffect(raw.effect));
  } else if (raw.kind === "passive") {
    effects.push({ type: "heal", portion: 0.35, target: "ally" });
  }

  return {
    id: raw.id,
    effects,
    ...(raw.element ? { element: raw.element } : {}),
    maxUses: raw.maxUses,
  };
}

function legacyPassiveToEffect(effect: PassiveEffect): MoveEffect {
  if (effect.type === "heal") {
    return { type: "heal", portion: effect.portion, target: "ally" };
  }
  if (effect.type === "buffStat") {
    return {
      type: "buffStat",
      stat: effect.stat,
      amount: effect.amount,
      target: "self",
    };
  }
  return { type: "guard", defBonus: effect.defBonus, target: "self" };
}

export function normalizeMoveCatalog(
  catalog: Record<MoveId, MoveDef>,
): Record<MoveId, MoveDef> {
  const next: Record<MoveId, MoveDef> = {};
  for (const [id, def] of Object.entries(catalog)) {
    next[id] = normalizeMoveDef(def);
  }
  return next;
}

export function moveIsOffensive(move: MoveDef): boolean {
  return move.effects.some(
    (e) => e.type === "damage" || e.type === "chain",
  );
}

export function moveNeedsTargetChoice(move: MoveDef): boolean {
  return move.effects.some((e) => {
    if (e.type === "damage") return e.target === "foe";
    if (e.type === "heal") return e.target === "ally";
    if (e.type === "buffStat") return e.target === "ally";
    if (e.type === "restoreUses") return e.target === "ally";
    if (e.type === "applyStatus") {
      return e.target === "ally" || e.target === "foe";
    }
    if (e.type === "clearStatus") return e.target === "ally";
    if (e.type === "chain") return true;
    return false;
  });
}
