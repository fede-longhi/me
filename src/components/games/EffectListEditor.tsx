"use client";

import type { ItemEffect } from "@/lib/roguelike/content/items";
import type { LocaleLabel } from "@/lib/roguelike/content";
import type { RelicHook } from "@/lib/roguelike/content/relics/types";
import type {
  Element,
  MoveEffect,
  MoveEffectTarget,
  StatusId,
} from "@/lib/roguelike/types";

type Mode = "move" | "item" | "relic";

type AnyEffect = MoveEffect | ItemEffect | RelicHook;

const ELEMENTS: Element[] = [
  "ember",
  "tide",
  "gale",
  "moss",
  "spark",
  "shade",
];

const STATUS_IDS: StatusId[] = [
  "burn",
  "poison",
  "paralysis",
  "freeze",
  "slow",
  "weak",
  "ward",
];

const MOVE_TYPES: MoveEffect["type"][] = [
  "damage",
  "heal",
  "buffStat",
  "guard",
  "drain",
  "restoreUses",
  "applyStatus",
  "clearStatus",
  "chain",
];

const ITEM_TYPES: ItemEffect["type"][] = [
  "healParty",
  "buffParty",
  "damageParty",
  "permStat",
  "applyStatus",
  "clearStatus",
];

const RELIC_TYPES: RelicHook["type"][] = [
  "goldMult",
  "xpMult",
  "captureBonus",
  "battleStartHeal",
  "shopDiscount",
  "statBonus",
];

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="mt-1 block text-[10px]">
      <span className="text-[var(--bp-muted)]">{label}</span>
      <div className="mt-0.5">{children}</div>
    </label>
  );
}

function NumInput({
  value,
  onChange,
  step = 1,
}: {
  value: number;
  onChange: (n: number) => void;
  step?: number;
}) {
  return (
    <input
      type="number"
      step={step}
      className="beast-path__field-control w-full px-2 py-1"
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

function SelectInput<T extends string>({
  value,
  options,
  onChange,
  labelOf,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  labelOf?: (v: T) => string;
}) {
  return (
    <select
      className="beast-path__field-control w-full px-2 py-1"
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {labelOf ? labelOf(opt) : opt}
        </option>
      ))}
    </select>
  );
}

function defaultMoveEffect(type: MoveEffect["type"]): MoveEffect {
  switch (type) {
    case "damage":
      return { type: "damage", power: 1.1, target: "foe" };
    case "heal":
      return { type: "heal", portion: 0.35, target: "self" };
    case "buffStat":
      return { type: "buffStat", stat: "atk", amount: 1, target: "self" };
    case "guard":
      return { type: "guard", defBonus: 2, target: "self" };
    case "drain":
      return { type: "drain", portion: 0.35 };
    case "restoreUses":
      return { type: "restoreUses", target: "self" };
    case "applyStatus":
      return {
        type: "applyStatus",
        status: "burn",
        turns: 2,
        potency: 0.08,
        target: "foe",
      };
    case "clearStatus":
      return { type: "clearStatus", target: "self" };
    case "chain":
      return { type: "chain", power: 1, jumps: 3, falloff: 0.7 };
  }
}

function defaultItemEffect(type: ItemEffect["type"]): ItemEffect {
  switch (type) {
    case "healParty":
      return { type: "healParty", amount: "half" };
    case "buffParty":
      return { type: "buffParty", stat: "atk", amount: 1 };
    case "damageParty":
      return { type: "damageParty", amount: 5 };
    case "permStat":
      return { type: "permStat", stat: "atk", amount: 1 };
    case "applyStatus":
      return { type: "applyStatus", status: "ward", turns: 1 };
    case "clearStatus":
      return { type: "clearStatus" };
  }
}

function defaultRelicHook(type: RelicHook["type"]): RelicHook {
  switch (type) {
    case "goldMult":
      return { type: "goldMult", mult: 1.15 };
    case "xpMult":
      return { type: "xpMult", mult: 1.15 };
    case "captureBonus":
      return { type: "captureBonus", amount: 0.1 };
    case "battleStartHeal":
      return { type: "battleStartHeal", portion: 0.1 };
    case "shopDiscount":
      return { type: "shopDiscount", portion: 0.1 };
    case "statBonus":
      return { type: "statBonus", stat: "atk", amount: 1 };
  }
}

function effectTypeLabel(labels: LocaleLabel, type: string) {
  return labels.ui[`contentEffect_${type}`] ?? type;
}

function statusLabel(labels: LocaleLabel, id: StatusId) {
  return labels.ui[`contentStatus_${id}`] ?? id;
}

function MoveEffectFields({
  effect,
  onChange,
  labels,
}: {
  effect: MoveEffect;
  onChange: (next: MoveEffect) => void;
  labels: LocaleLabel;
}) {
  const foeTargets = ["foe", "allFoes"] as const;
  const allyTargets = ["self", "ally", "allAllies"] as const;
  const statusTargets: MoveEffectTarget[] = [
    "self",
    "ally",
    "foe",
    "allAllies",
    "allFoes",
  ];

  if (effect.type === "damage") {
    return (
      <div className="grid grid-cols-2 gap-1">
        <Field label={labels.ui.contentEffectPower}>
          <NumInput
            value={effect.power}
            onChange={(power) => onChange({ ...effect, power })}
            step={0.05}
          />
        </Field>
        <Field label={labels.ui.contentEffectTarget}>
          <SelectInput
            value={effect.target}
            options={foeTargets}
            onChange={(target) => onChange({ ...effect, target })}
          />
        </Field>
        <Field label={labels.ui.contentEffectElement}>
          <select
            className="beast-path__field-control w-full px-2 py-1"
            value={effect.element ?? ""}
            onChange={(e) =>
              onChange({
                ...effect,
                element: (e.target.value || undefined) as Element | undefined,
              })
            }
          >
            <option value="">{labels.ui.elementNone}</option>
            {ELEMENTS.map((el) => (
              <option key={el} value={el}>
                {el}
              </option>
            ))}
          </select>
        </Field>
      </div>
    );
  }

  if (effect.type === "heal") {
    return (
      <div className="grid grid-cols-2 gap-1">
        <Field label={labels.ui.contentEffectPortion}>
          <NumInput
            value={effect.portion}
            onChange={(portion) => onChange({ ...effect, portion })}
            step={0.05}
          />
        </Field>
        <Field label={labels.ui.contentEffectTarget}>
          <SelectInput
            value={effect.target}
            options={allyTargets}
            onChange={(target) => onChange({ ...effect, target })}
          />
        </Field>
      </div>
    );
  }

  if (effect.type === "buffStat") {
    return (
      <div className="grid grid-cols-2 gap-1">
        <Field label={labels.ui.contentEffectStat}>
          <SelectInput
            value={effect.stat}
            options={["atk", "def", "spd"] as const}
            onChange={(stat) => onChange({ ...effect, stat })}
          />
        </Field>
        <Field label={labels.ui.contentEffectAmount}>
          <NumInput
            value={effect.amount}
            onChange={(amount) => onChange({ ...effect, amount })}
          />
        </Field>
        <Field label={labels.ui.contentEffectTarget}>
          <SelectInput
            value={effect.target}
            options={allyTargets}
            onChange={(target) => onChange({ ...effect, target })}
          />
        </Field>
      </div>
    );
  }

  if (effect.type === "guard") {
    return (
      <Field label={labels.ui.contentEffectDefBonus}>
        <NumInput
          value={effect.defBonus}
          onChange={(defBonus) => onChange({ ...effect, defBonus })}
        />
      </Field>
    );
  }

  if (effect.type === "drain") {
    return (
      <Field label={labels.ui.contentEffectPortion}>
        <NumInput
          value={effect.portion}
          onChange={(portion) => onChange({ ...effect, portion })}
          step={0.05}
        />
      </Field>
    );
  }

  if (effect.type === "restoreUses") {
    return (
      <Field label={labels.ui.contentEffectTarget}>
        <SelectInput
          value={effect.target}
          options={allyTargets}
          onChange={(target) => onChange({ ...effect, target })}
        />
      </Field>
    );
  }

  if (effect.type === "applyStatus") {
    return (
      <div className="grid grid-cols-2 gap-1">
        <Field label={labels.ui.contentEffectStatus}>
          <SelectInput
            value={effect.status}
            options={STATUS_IDS}
            onChange={(status) => onChange({ ...effect, status })}
            labelOf={(id) => statusLabel(labels, id)}
          />
        </Field>
        <Field label={labels.ui.contentEffectTurns}>
          <NumInput
            value={effect.turns}
            onChange={(turns) => onChange({ ...effect, turns })}
          />
        </Field>
        <Field label={labels.ui.contentEffectPotency}>
          <NumInput
            value={effect.potency ?? 0}
            onChange={(potency) =>
              onChange({
                ...effect,
                potency: potency > 0 ? potency : undefined,
              })
            }
            step={0.01}
          />
        </Field>
        <Field label={labels.ui.contentEffectTarget}>
          <SelectInput
            value={effect.target}
            options={statusTargets}
            onChange={(target) => onChange({ ...effect, target })}
          />
        </Field>
      </div>
    );
  }

  if (effect.type === "clearStatus") {
    return (
      <div className="grid grid-cols-2 gap-1">
        <Field label={labels.ui.contentEffectStatus}>
          <select
            className="beast-path__field-control w-full px-2 py-1"
            value={effect.status ?? ""}
            onChange={(e) =>
              onChange({
                ...effect,
                status: (e.target.value || undefined) as StatusId | undefined,
              })
            }
          >
            <option value="">{labels.ui.contentEffectStatusAll}</option>
            {STATUS_IDS.map((id) => (
              <option key={id} value={id}>
                {statusLabel(labels, id)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={labels.ui.contentEffectTarget}>
          <SelectInput
            value={effect.target}
            options={allyTargets}
            onChange={(target) => onChange({ ...effect, target })}
          />
        </Field>
      </div>
    );
  }

  // chain
  return (
    <div className="grid grid-cols-2 gap-1">
      <Field label={labels.ui.contentEffectPower}>
        <NumInput
          value={effect.power}
          onChange={(power) => onChange({ ...effect, power })}
          step={0.05}
        />
      </Field>
      <Field label={labels.ui.contentEffectJumps}>
        <NumInput
          value={effect.jumps}
          onChange={(jumps) => onChange({ ...effect, jumps })}
        />
      </Field>
      <Field label={labels.ui.contentEffectFalloff}>
        <NumInput
          value={effect.falloff}
          onChange={(falloff) => onChange({ ...effect, falloff })}
          step={0.05}
        />
      </Field>
      <Field label={labels.ui.contentEffectElement}>
        <select
          className="beast-path__field-control w-full px-2 py-1"
          value={effect.element ?? ""}
          onChange={(e) =>
            onChange({
              ...effect,
              element: (e.target.value || undefined) as Element | undefined,
            })
          }
        >
          <option value="">{labels.ui.elementNone}</option>
          {ELEMENTS.map((el) => (
            <option key={el} value={el}>
              {el}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

function ItemEffectFields({
  effect,
  onChange,
  labels,
}: {
  effect: ItemEffect;
  onChange: (next: ItemEffect) => void;
  labels: LocaleLabel;
}) {
  if (effect.type === "healParty") {
    return (
      <Field label={labels.ui.contentEffectAmount}>
        <select
          className="beast-path__field-control w-full px-2 py-1"
          value={
            typeof effect.amount === "number" ? "number" : String(effect.amount)
          }
          onChange={(e) => {
            const v = e.target.value;
            if (v === "half" || v === "full") {
              onChange({ type: "healParty", amount: v });
            } else {
              onChange({
                type: "healParty",
                amount: typeof effect.amount === "number" ? effect.amount : 10,
              });
            }
          }}
        >
          <option value="half">half</option>
          <option value="full">full</option>
          <option value="number">flat</option>
        </select>
        {typeof effect.amount === "number" ? (
          <div className="mt-1">
            <NumInput
              value={effect.amount}
              onChange={(amount) => onChange({ type: "healParty", amount })}
            />
          </div>
        ) : null}
      </Field>
    );
  }

  if (effect.type === "buffParty") {
    return (
      <div className="grid grid-cols-2 gap-1">
        <Field label={labels.ui.contentEffectStat}>
          <SelectInput
            value={effect.stat}
            options={["atk", "def", "spd"] as const}
            onChange={(stat) => onChange({ ...effect, stat })}
          />
        </Field>
        <Field label={labels.ui.contentEffectAmount}>
          <NumInput
            value={effect.amount}
            onChange={(amount) => onChange({ ...effect, amount })}
          />
        </Field>
      </div>
    );
  }

  if (effect.type === "damageParty") {
    return (
      <Field label={labels.ui.contentEffectAmount}>
        <NumInput
          value={effect.amount}
          onChange={(amount) => onChange({ ...effect, amount })}
        />
      </Field>
    );
  }

  if (effect.type === "permStat") {
    return (
      <div className="grid grid-cols-2 gap-1">
        <Field label={labels.ui.contentEffectStat}>
          <SelectInput
            value={effect.stat}
            options={["maxHp", "atk", "def", "spd"] as const}
            onChange={(stat) => onChange({ ...effect, stat })}
          />
        </Field>
        <Field label={labels.ui.contentEffectAmount}>
          <NumInput
            value={effect.amount}
            onChange={(amount) => onChange({ ...effect, amount })}
          />
        </Field>
      </div>
    );
  }

  if (effect.type === "applyStatus") {
    return (
      <div className="grid grid-cols-2 gap-1">
        <Field label={labels.ui.contentEffectStatus}>
          <SelectInput
            value={effect.status}
            options={STATUS_IDS}
            onChange={(status) => onChange({ ...effect, status })}
            labelOf={(id) => statusLabel(labels, id)}
          />
        </Field>
        <Field label={labels.ui.contentEffectTurns}>
          <NumInput
            value={effect.turns}
            onChange={(turns) => onChange({ ...effect, turns })}
          />
        </Field>
        <Field label={labels.ui.contentEffectPotency}>
          <NumInput
            value={effect.potency ?? 0}
            onChange={(potency) =>
              onChange({
                ...effect,
                potency: potency > 0 ? potency : undefined,
              })
            }
            step={0.01}
          />
        </Field>
      </div>
    );
  }

  return (
    <Field label={labels.ui.contentEffectStatus}>
      <select
        className="beast-path__field-control w-full px-2 py-1"
        value={effect.status ?? ""}
        onChange={(e) =>
          onChange({
            type: "clearStatus",
            status: (e.target.value || undefined) as StatusId | undefined,
          })
        }
      >
        <option value="">{labels.ui.contentEffectStatusAll}</option>
        {STATUS_IDS.map((id) => (
          <option key={id} value={id}>
            {statusLabel(labels, id)}
          </option>
        ))}
      </select>
    </Field>
  );
}

function RelicHookFields({
  effect,
  onChange,
  labels,
}: {
  effect: RelicHook;
  onChange: (next: RelicHook) => void;
  labels: LocaleLabel;
}) {
  if (effect.type === "goldMult" || effect.type === "xpMult") {
    return (
      <Field label={labels.ui.contentEffectMult}>
        <NumInput
          value={effect.mult}
          onChange={(mult) => onChange({ ...effect, mult })}
          step={0.05}
        />
      </Field>
    );
  }
  if (effect.type === "captureBonus") {
    return (
      <Field label={labels.ui.contentEffectAmount}>
        <NumInput
          value={effect.amount}
          onChange={(amount) => onChange({ ...effect, amount })}
          step={0.05}
        />
      </Field>
    );
  }
  if (
    effect.type === "battleStartHeal" ||
    effect.type === "shopDiscount"
  ) {
    return (
      <Field label={labels.ui.contentEffectPortion}>
        <NumInput
          value={effect.portion}
          onChange={(portion) => onChange({ ...effect, portion })}
          step={0.05}
        />
      </Field>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-1">
      <Field label={labels.ui.contentEffectStat}>
        <SelectInput
          value={effect.stat}
          options={["atk", "def", "spd", "maxHp"] as const}
          onChange={(stat) => onChange({ ...effect, stat })}
        />
      </Field>
      <Field label={labels.ui.contentEffectAmount}>
        <NumInput
          value={effect.amount}
          onChange={(amount) => onChange({ ...effect, amount })}
        />
      </Field>
    </div>
  );
}

export function EffectListEditor({
  mode,
  value,
  onChange,
  labels,
}: {
  mode: Mode;
  value: AnyEffect[];
  onChange: (next: AnyEffect[]) => void;
  labels: LocaleLabel;
}) {
  const types =
    mode === "move" ? MOVE_TYPES : mode === "item" ? ITEM_TYPES : RELIC_TYPES;

  const addDefault = () => {
    if (mode === "move") {
      onChange([...value, defaultMoveEffect("damage")]);
    } else if (mode === "item") {
      onChange([...value, defaultItemEffect("healParty")]);
    } else {
      onChange([...value, defaultRelicHook("goldMult")]);
    }
  };

  const updateAt = (index: number, next: AnyEffect) => {
    onChange(value.map((e, i) => (i === index ? next : e)));
  };

  const removeAt = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const moveAt = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    const tmp = next[index]!;
    next[index] = next[j]!;
    next[j] = tmp;
    onChange(next);
  };

  const changeType = (index: number, type: string) => {
    if (mode === "move") {
      updateAt(index, defaultMoveEffect(type as MoveEffect["type"]));
    } else if (mode === "item") {
      updateAt(index, defaultItemEffect(type as ItemEffect["type"]));
    } else {
      updateAt(index, defaultRelicHook(type as RelicHook["type"]));
    }
  };

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-[var(--bp-muted)]">
          {mode === "relic"
            ? labels.ui.contentEffectHooks
            : labels.ui.contentEffectList}
        </p>
        <button
          type="button"
          className="beast-path__btn-ghost px-2 py-0.5 text-[10px]"
          onClick={addDefault}
        >
          {labels.ui.contentEffectAdd}
        </button>
      </div>
      {value.length === 0 ? (
        <p className="mt-1 text-[10px] text-[var(--bp-muted)]">
          {labels.ui.contentEffectEmpty}
        </p>
      ) : null}
      <ul className="mt-1 space-y-2">
        {value.map((effect, index) => (
          <li
            key={`${effect.type}-${index}`}
            className="border border-[var(--bp-line)] bg-black/20 p-2"
          >
            <div className="flex flex-wrap items-center gap-1">
              <select
                className="beast-path__field-control min-w-[8rem] flex-1 px-2 py-1 text-[11px]"
                value={effect.type}
                onChange={(e) => changeType(index, e.target.value)}
              >
                {types.map((t) => (
                  <option key={t} value={t}>
                    {effectTypeLabel(labels, t)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="beast-path__btn-ghost px-1.5 py-0.5 text-[10px]"
                disabled={index === 0}
                onClick={() => moveAt(index, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="beast-path__btn-ghost px-1.5 py-0.5 text-[10px]"
                disabled={index >= value.length - 1}
                onClick={() => moveAt(index, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="beast-path__btn-ghost px-1.5 py-0.5 text-[10px] text-[var(--bp-danger)]"
                onClick={() => removeAt(index)}
              >
                {labels.ui.contentEffectRemove}
              </button>
            </div>
            <div className="mt-1">
              {mode === "move" ? (
                <MoveEffectFields
                  effect={effect as MoveEffect}
                  onChange={(next) => updateAt(index, next)}
                  labels={labels}
                />
              ) : mode === "item" ? (
                <ItemEffectFields
                  effect={effect as ItemEffect}
                  onChange={(next) => updateAt(index, next)}
                  labels={labels}
                />
              ) : (
                <RelicHookFields
                  effect={effect as RelicHook}
                  onChange={(next) => updateAt(index, next)}
                  labels={labels}
                />
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
