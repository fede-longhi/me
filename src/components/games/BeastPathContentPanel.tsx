"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addEvent,
  addItem,
  addMove,
  addRegion,
  addRelic,
  addSpecies,
  applyContentOverrides,
  captureLiveAsOverrides,
  clearAndResetContentOverrides,
  collectContentWarnings,
  copy,
  EARLY_POOL,
  ensureOverridesHydrated,
  EVENT_IDS,
  EVENTS,
  HABITAT_IDS,
  habitatsForSpecies,
  ITEM_IDS,
  ITEMS,
  listBossIds,
  MOVES,
  MOVE_IDS,
  overridesToJson,
  parseOverridesJson,
  patchEvent,
  patchEventLabels,
  patchItem,
  patchItemLabels,
  patchMove,
  patchMoveLabels,
  patchRegion,
  patchRegionLabels,
  patchRelic,
  patchRelicLabels,
  patchRewardTuning,
  patchSpecies,
  patchSpeciesLabels,
  REGIONS,
  REGION_IDS,
  RELIC_IDS,
  RELICS,
  removeEvent,
  removeItem,
  removeMove,
  removeRegion,
  removeRelic,
  removeSpecies,
  REWARD_TUNING,
  RUN_LEVELS,
  saveLiveOverridesToStorage,
  setSpeciesPools,
  SPECIES,
  SPECIES_IDS,
  STARTER_IDS,
  WILD_POOL,
  writeStoredOverrides,
  publishLiveContent,
  type EventDef,
  type ItemDef,
  type LocaleLabel,
  type RegionDef,
  type RelicDef,
  type RewardTuning,
} from "@/lib/roguelike/content";
import {
  baseGoldFor,
  captureChance,
  runLevelGoldMult,
  xpFromGoldReward,
  xpToNext,
} from "@/lib/roguelike/content/rewards/tables";
import { BeastPathArtPicker } from "@/components/games/BeastPathArtPicker";
import { EffectListEditor } from "@/components/games/EffectListEditor";
import type {
  Element,
  HabitatId,
  LearnEntry,
  MoveEffect,
  MoveId,
  RegionId,
  RunLevel,
  Species,
  SpeciesId,
} from "@/lib/roguelike/types";
import { moveIsOffensive, normalizeMoveDef } from "@/lib/roguelike/moves";

type Tab =
  | "species"
  | "moves"
  | "bosses"
  | "regions"
  | "events"
  | "items"
  | "relics"
  | "rewards"
  | "warnings";

const TABS: Tab[] = [
  "species",
  "moves",
  "bosses",
  "regions",
  "events",
  "items",
  "relics",
  "rewards",
  "warnings",
];

const ELEMENTS: Element[] = [
  "ember",
  "tide",
  "gale",
  "moss",
  "spark",
  "shade",
];

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="mt-2 block text-[11px]">
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

function TextInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="text"
      className="beast-path__field-control w-full px-2 py-1"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function downloadJson(filename: string, json: string) {
  const url = URL.createObjectURL(
    new Blob([json], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function BeastPathContentPanel({
  labels,
  onClose,
  onContentChange,
  layout = "overlay",
}: {
  labels: LocaleLabel;
  onClose: () => void;
  onContentChange?: () => void;
  /** `page` fills the game stage (menu). `overlay` is a centered modal. */
  layout?: "overlay" | "page";
}) {
  const [tab, setTab] = useState<Tab>("species");
  const [selected, setSelected] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [newId, setNewId] = useState("");
  const [newNameEn, setNewNameEn] = useState("");
  const [newNameEs, setNewNameEs] = useState("");
  const [newElement, setNewElement] = useState<Element | "">("moss");
  const [newMoveOffensive, setNewMoveOffensive] = useState(true);
  const fileRef = useRef<HTMLInputElement | null>(null);
  /** Flushes the open editor draft into live registries before save/close. */
  const flushEditorRef = useRef<(() => boolean) | null>(null);
  const refresh = () => setTick((n) => n + 1);

  const warnings = useMemo(() => collectContentWarnings(), [tick]);
  const bossIds = useMemo(() => listBossIds(), [tick]);

  useEffect(() => {
    void ensureOverridesHydrated().then(() => refresh());
  }, []);

  function persist(message: string) {
    try {
      const flush = flushEditorRef.current;
      if (flush && !flush()) {
        setStatus(labels.ui.contentApplyFirst);
        return;
      }
      saveLiveOverridesToStorage();
      setStatus(message);
      refresh();
      onContentChange?.();
    } catch {
      setStatus(labels.ui.contentSaveError);
    }
  }

  function closePanel() {
    try {
      const flush = flushEditorRef.current;
      if (flush) flush();
      saveLiveOverridesToStorage();
      onContentChange?.();
    } catch {
      // Still close; user can export if storage is blocked.
    }
    onClose();
  }

  function exportPack() {
    try {
      flushEditorRef.current?.();
      downloadJson(
        `beast-path-content-${Date.now()}.json`,
        overridesToJson(captureLiveAsOverrides()),
      );
      setStatus(labels.ui.contentExported);
    } catch {
      setStatus(labels.ui.contentSaveError);
    }
  }

  function downloadShipped() {
    try {
      flushEditorRef.current?.();
      downloadJson("shipped.json", overridesToJson(captureLiveAsOverrides()));
      setStatus(labels.ui.contentShippedSaved);
    } catch {
      setStatus(labels.ui.contentSaveError);
    }
  }

  async function publishPack() {
    try {
      const flush = flushEditorRef.current;
      if (flush && !flush()) {
        setStatus(labels.ui.contentApplyFirst);
        return;
      }
      saveLiveOverridesToStorage();
      let secret =
        process.env.NEXT_PUBLIC_BEAST_PATH_CONTENT_SECRET?.trim() || "";
      if (!secret) {
        secret =
          window.prompt(labels.ui.contentPublishSecretPrompt)?.trim() || "";
      }
      if (!secret) {
        setStatus(labels.ui.contentPublishCancelled);
        return;
      }
      setStatus(labels.ui.contentPublishing);
      const meta = await publishLiveContent(secret);
      setStatus(
        labels.ui.contentPublished.replace("{hash}", meta.hash.slice(0, 8)),
      );
      refresh();
      onContentChange?.();
    } catch (err) {
      setStatus(
        err instanceof Error ? err.message : labels.ui.contentPublishError,
      );
    }
  }

  function onImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const pack = parseOverridesJson(String(reader.result ?? ""));
        writeStoredOverrides(pack);
        applyContentOverrides(pack);
        setStatus(labels.ui.contentImported);
        refresh();
        onContentChange?.();
      } catch {
        setStatus(labels.ui.contentImportError);
      }
    };
    reader.readAsText(file);
  }

  useEffect(() => {
    if (
      tab === "warnings" ||
      tab === "rewards" ||
      selected == null
    ) {
      // rewards still registers its own flush; clear only when nothing editable
      if (tab === "warnings" || (tab !== "rewards" && selected == null)) {
        flushEditorRef.current = null;
      }
    }
  }, [tab, selected]);

  const listIds: string[] =
    tab === "species"
      ? [...SPECIES_IDS]
      : tab === "bosses"
        ? bossIds
        : tab === "moves"
          ? [...MOVE_IDS]
          : tab === "regions"
            ? [...REGION_IDS]
            : tab === "events"
              ? [...EVENT_IDS]
              : tab === "items"
                ? [...ITEM_IDS]
                : tab === "relics"
                  ? [...RELIC_IDS]
                  : tab === "warnings"
                    ? warnings.map((_, i) => String(i))
                    : [];

  const panel = (
      <div
        className={
          layout === "page"
            ? "beast-path__content-page"
            : "beast-path__modal beast-path__content-panel"
        }
        role="dialog"
        aria-modal="true"
        aria-label={labels.ui.contentDev}
        onClick={layout === "overlay" ? (e) => e.stopPropagation() : undefined}
      >
        <div className="beast-path__content-chrome">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{labels.ui.contentDev}</p>
              <p className="text-[10px] text-[var(--bp-muted)]">
                {labels.ui.contentDevHint}
              </p>
            </div>
            <button
              type="button"
              className="beast-path__btn-ghost px-2 py-1 text-[10px]"
              onClick={closePanel}
            >
              {labels.ui.contentDevClose}
            </button>
          </div>

          <div className="mt-2 flex flex-wrap gap-1">
          <button
            type="button"
            className="beast-path__btn px-2 py-1 text-[10px]"
            onClick={() => persist(labels.ui.contentSaved)}
          >
            {labels.ui.contentSave}
          </button>
          <button
            type="button"
            className="beast-path__btn px-2 py-1 text-[10px]"
            onClick={() => void publishPack()}
          >
            {labels.ui.contentPublish}
          </button>
          <button
            type="button"
            className="beast-path__btn-ghost px-2 py-1 text-[10px]"
            onClick={exportPack}
          >
            {labels.ui.contentExport}
          </button>
          <button
            type="button"
            className="beast-path__btn-ghost px-2 py-1 text-[10px]"
            onClick={downloadShipped}
          >
            {labels.ui.contentShipped}
          </button>
          <button
            type="button"
            className="beast-path__btn-ghost px-2 py-1 text-[10px]"
            onClick={() => fileRef.current?.click()}
          >
            {labels.ui.contentImport}
          </button>
          <button
            type="button"
            className="beast-path__btn-ghost px-2 py-1 text-[10px]"
            onClick={() => {
              if (!window.confirm(labels.ui.contentResetConfirm)) return;
              clearAndResetContentOverrides();
              setStatus(labels.ui.contentReset);
              refresh();
              onContentChange?.();
            }}
          >
            {labels.ui.contentReset}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImportFile(file);
              e.target.value = "";
            }}
          />
        </div>
        <p className="mt-1 text-[10px] text-[var(--bp-muted)]">
          {labels.ui.contentShippedHint}
        </p>
        {status ? (
          <p className="mt-1 text-[10px] text-[var(--bp-gold)]">{status}</p>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-1">
          {TABS.map((id) => (
            <button
              key={id}
              type="button"
              className={[
                "px-2 py-1 text-[10px] uppercase tracking-wide border",
                tab === id
                  ? "border-[var(--bp-gold)] text-[var(--bp-gold)]"
                  : "border-[var(--bp-line)] text-[var(--bp-muted)]",
              ].join(" ")}
              onClick={() => {
                setTab(id);
                setSelected(null);
              }}
            >
              {id}
              {id === "warnings" && warnings.length > 0
                ? ` (${warnings.length})`
                : ""}
            </button>
          ))}
        </div>

        {tab === "species" ? (
          <div className="mt-2 flex flex-wrap items-end gap-1 border border-[var(--bp-line)] p-2">
            <label className="min-w-[7rem] flex-1 text-[10px]">
              <span className="text-[var(--bp-muted)]">
                {labels.ui.contentNewId}
              </span>
              <TextInput value={newId} onChange={setNewId} />
            </label>
            <label className="min-w-[7rem] flex-1 text-[10px]">
              <span className="text-[var(--bp-muted)]">
                {labels.ui.contentNameEn}
              </span>
              <TextInput value={newNameEn} onChange={setNewNameEn} />
            </label>
            <label className="min-w-[7rem] flex-1 text-[10px]">
              <span className="text-[var(--bp-muted)]">
                {labels.ui.contentNameEs}
              </span>
              <TextInput value={newNameEs} onChange={setNewNameEs} />
            </label>
            <label className="text-[10px]">
              <span className="text-[var(--bp-muted)]">element</span>
              <select
                className="beast-path__field-control mt-0.5 block px-2 py-1"
                value={newElement}
                onChange={(e) =>
                  setNewElement(e.target.value as Element | "")
                }
              >
                <option value="">{labels.ui.elementNone}</option>
                {ELEMENTS.map((el) => (
                  <option key={el} value={el}>
                    {el}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="beast-path__btn px-2 py-1 text-[10px]"
              onClick={() => {
                if (!newId.trim()) return;
                const id = addSpecies({
                  id: newId,
                  element: newElement || undefined,
                  nameEn: newNameEn,
                  nameEs: newNameEs,
                });
                setNewId("");
                setNewNameEn("");
                setNewNameEs("");
                setSelected(id);
                persist(labels.ui.contentSpeciesAdded);
              }}
            >
              {labels.ui.contentAddSpecies}
            </button>
          </div>
        ) : null}

        {tab === "regions" ? (
          <div className="mt-2 flex flex-wrap items-end gap-1 border border-[var(--bp-line)] p-2">
            <label className="min-w-[7rem] flex-1 text-[10px]">
              <span className="text-[var(--bp-muted)]">
                {labels.ui.contentNewId}
              </span>
              <TextInput value={newId} onChange={setNewId} />
            </label>
            <label className="min-w-[7rem] flex-1 text-[10px]">
              <span className="text-[var(--bp-muted)]">
                {labels.ui.contentNameEn}
              </span>
              <TextInput value={newNameEn} onChange={setNewNameEn} />
            </label>
            <label className="min-w-[7rem] flex-1 text-[10px]">
              <span className="text-[var(--bp-muted)]">
                {labels.ui.contentNameEs}
              </span>
              <TextInput value={newNameEs} onChange={setNewNameEs} />
            </label>
            <button
              type="button"
              className="beast-path__btn px-2 py-1 text-[10px]"
              onClick={() => {
                if (!newId.trim()) return;
                const id = addRegion({
                  id: newId,
                  nameEn: newNameEn,
                  nameEs: newNameEs,
                });
                setNewId("");
                setNewNameEn("");
                setNewNameEs("");
                setSelected(id);
                persist(labels.ui.contentRegionAdded);
              }}
            >
              {labels.ui.contentAddRegion}
            </button>
          </div>
        ) : null}

        {tab === "events" ? (
          <div className="mt-2 flex flex-wrap items-end gap-1 border border-[var(--bp-line)] p-2">
            <label className="min-w-[7rem] flex-1 text-[10px]">
              <span className="text-[var(--bp-muted)]">
                {labels.ui.contentNewId}
              </span>
              <TextInput value={newId} onChange={setNewId} />
            </label>
            <label className="min-w-[7rem] flex-1 text-[10px]">
              <span className="text-[var(--bp-muted)]">
                {labels.ui.contentTitleEn}
              </span>
              <TextInput value={newNameEn} onChange={setNewNameEn} />
            </label>
            <label className="min-w-[7rem] flex-1 text-[10px]">
              <span className="text-[var(--bp-muted)]">
                {labels.ui.contentTitleEs}
              </span>
              <TextInput value={newNameEs} onChange={setNewNameEs} />
            </label>
            <button
              type="button"
              className="beast-path__btn px-2 py-1 text-[10px]"
              onClick={() => {
                if (!newId.trim()) return;
                const id = addEvent({
                  id: newId,
                  titleEn: newNameEn,
                  titleEs: newNameEs,
                  global: true,
                });
                setNewId("");
                setNewNameEn("");
                setNewNameEs("");
                setSelected(id);
                persist(labels.ui.contentEventAdded);
              }}
            >
              {labels.ui.contentAddEvent}
            </button>
          </div>
        ) : null}

        {tab === "moves" ? (
          <div className="mt-2 flex flex-wrap items-end gap-1 border border-[var(--bp-line)] p-2">
            <label className="min-w-[7rem] flex-1 text-[10px]">
              <span className="text-[var(--bp-muted)]">
                {labels.ui.contentNewId}
              </span>
              <TextInput value={newId} onChange={setNewId} />
            </label>
            <label className="min-w-[7rem] flex-1 text-[10px]">
              <span className="text-[var(--bp-muted)]">
                {labels.ui.contentNameEn}
              </span>
              <TextInput value={newNameEn} onChange={setNewNameEn} />
            </label>
            <label className="min-w-[7rem] flex-1 text-[10px]">
              <span className="text-[var(--bp-muted)]">
                {labels.ui.contentNameEs}
              </span>
              <TextInput value={newNameEs} onChange={setNewNameEs} />
            </label>
            <label className="text-[10px]">
              <span className="text-[var(--bp-muted)]">type</span>
              <select
                className="beast-path__field-control mt-0.5 block px-2 py-1"
                value={newMoveOffensive ? "offensive" : "support"}
                onChange={(e) =>
                  setNewMoveOffensive(e.target.value === "offensive")
                }
              >
                <option value="offensive">offensive</option>
                <option value="support">support</option>
              </select>
            </label>
            {newMoveOffensive ? (
              <label className="text-[10px]">
                <span className="text-[var(--bp-muted)]">element</span>
                <select
                  className="beast-path__field-control mt-0.5 block px-2 py-1"
                  value={newElement}
                  onChange={(e) =>
                    setNewElement(e.target.value as Element | "")
                  }
                >
                  <option value="">{labels.ui.elementNone}</option>
                  {ELEMENTS.map((el) => (
                    <option key={el} value={el}>
                      {el}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <button
              type="button"
              className="beast-path__btn px-2 py-1 text-[10px]"
              onClick={() => {
                if (!newId.trim()) return;
                const id = addMove({
                  id: newId,
                  kind: newMoveOffensive ? "attack" : "passive",
                  element:
                    newMoveOffensive && newElement ? newElement : undefined,
                  nameEn: newNameEn,
                  nameEs: newNameEs,
                });
                setNewId("");
                setNewNameEn("");
                setNewNameEs("");
                setSelected(id);
                persist(labels.ui.contentMoveAdded);
              }}
            >
              {labels.ui.contentAddMove}
            </button>
          </div>
        ) : null}

        {tab === "items" ? (
          <div className="mt-2 flex flex-wrap items-end gap-1 border border-[var(--bp-line)] p-2">
            <label className="min-w-[7rem] flex-1 text-[10px]">
              <span className="text-[var(--bp-muted)]">
                {labels.ui.contentNewId}
              </span>
              <TextInput value={newId} onChange={setNewId} />
            </label>
            <label className="min-w-[7rem] flex-1 text-[10px]">
              <span className="text-[var(--bp-muted)]">
                {labels.ui.contentNameEn}
              </span>
              <TextInput value={newNameEn} onChange={setNewNameEn} />
            </label>
            <label className="min-w-[7rem] flex-1 text-[10px]">
              <span className="text-[var(--bp-muted)]">
                {labels.ui.contentNameEs}
              </span>
              <TextInput value={newNameEs} onChange={setNewNameEs} />
            </label>
            <button
              type="button"
              className="beast-path__btn px-2 py-1 text-[10px]"
              onClick={() => {
                if (!newId.trim()) return;
                const id = addItem({
                  id: newId,
                  nameEn: newNameEn,
                  nameEs: newNameEs,
                });
                setNewId("");
                setNewNameEn("");
                setNewNameEs("");
                setSelected(id);
                persist(labels.ui.contentItemAdded);
              }}
            >
              {labels.ui.contentAddItem}
            </button>
          </div>
        ) : null}

        {tab === "relics" ? (
          <div className="mt-2 flex flex-wrap items-end gap-1 border border-[var(--bp-line)] p-2">
            <label className="min-w-[7rem] flex-1 text-[10px]">
              <span className="text-[var(--bp-muted)]">
                {labels.ui.contentNewId}
              </span>
              <TextInput value={newId} onChange={setNewId} />
            </label>
            <label className="min-w-[7rem] flex-1 text-[10px]">
              <span className="text-[var(--bp-muted)]">
                {labels.ui.contentNameEn}
              </span>
              <TextInput value={newNameEn} onChange={setNewNameEn} />
            </label>
            <label className="min-w-[7rem] flex-1 text-[10px]">
              <span className="text-[var(--bp-muted)]">
                {labels.ui.contentNameEs}
              </span>
              <TextInput value={newNameEs} onChange={setNewNameEs} />
            </label>
            <button
              type="button"
              className="beast-path__btn px-2 py-1 text-[10px]"
              onClick={() => {
                if (!newId.trim()) return;
                const id = addRelic({
                  id: newId,
                  nameEn: newNameEn,
                  nameEs: newNameEs,
                });
                setNewId("");
                setNewNameEn("");
                setNewNameEs("");
                setSelected(id);
                persist(labels.ui.contentRelicAdded);
              }}
            >
              {labels.ui.contentAddRelic}
            </button>
          </div>
        ) : null}
        </div>

        <div className="beast-path__content-split">
          <ul className="beast-path__content-list text-[11px]">
            {tab === "rewards" ? (
              <li className="px-1.5 py-1 text-[var(--bp-muted)]">tuning</li>
            ) : (
              listIds.map((id) => (
                <li key={id}>
                  <button
                    type="button"
                    className={[
                      "w-full truncate px-1.5 py-1 text-left",
                      selected === id
                        ? "bg-[color-mix(in_oklab,var(--bp-gold)_18%,transparent)]"
                        : "",
                    ].join(" ")}
                    onClick={() => setSelected(id)}
                  >
                    {tab === "species" || tab === "bosses"
                      ? (copy.en.species[id] ?? id)
                      : tab === "moves"
                        ? (copy.en.moves[id]?.name ?? id)
                        : tab === "regions"
                          ? (copy.en.regions[id] ?? id)
                          : tab === "events"
                            ? (copy.en.events[id]?.title ?? id)
                            : tab === "items"
                              ? (copy.en.items[id]?.name ?? id)
                              : tab === "relics"
                                ? (copy.en.relics[id]?.name ?? id)
                                : `[${warnings[Number(id)]?.level}] ${warnings[Number(id)]?.scope}`}
                  </button>
                </li>
              ))
            )}
          </ul>

          <div className="beast-path__content-detail text-[11px] leading-relaxed">
            {(tab === "species" || tab === "bosses") &&
            selected &&
            SPECIES[selected] ? (
              <SpeciesEditor
                key={`species-${selected}`}
                id={selected}
                labels={labels}
                registerFlush={(fn) => {
                  flushEditorRef.current = fn;
                }}
                onCommit={(patch, names, pools) => {
                  patchSpecies(selected, patch);
                  patchSpeciesLabels(selected, names);
                  setSpeciesPools(selected, pools);
                }}
                onApplied={() => persist(labels.ui.contentSaved)}
                onDelete={() => {
                  if (!window.confirm(labels.ui.contentDeleteConfirm)) return;
                  flushEditorRef.current = null;
                  if (!removeSpecies(selected)) return;
                  setSelected(null);
                  persist(labels.ui.contentSpeciesDeleted);
                }}
              />
            ) : null}

            {tab === "moves" && selected && MOVES[selected] ? (
              <MoveEditor
                key={`move-${selected}`}
                id={selected}
                labels={labels}
                registerFlush={(fn) => {
                  flushEditorRef.current = fn;
                }}
                onCommit={(patch, names) => {
                  patchMove(selected, patch);
                  patchMoveLabels(selected, names);
                }}
                onApplied={() => persist(labels.ui.contentSaved)}
                onDelete={() => {
                  if (!window.confirm(labels.ui.contentDeleteMoveConfirm)) return;
                  flushEditorRef.current = null;
                  if (!removeMove(selected)) return;
                  setSelected(null);
                  persist(labels.ui.contentMoveDeleted);
                }}
              />
            ) : null}

            {tab === "regions" ? (
              <div>
                {selected && REGIONS[selected] ? (
                  <RegionEditor
                    key={`region-${selected}`}
                    id={selected}
                    labels={labels}
                    registerFlush={(fn) => {
                      flushEditorRef.current = fn;
                    }}
                    onCommit={(patch, names) => {
                      patchRegion(selected, patch);
                      patchRegionLabels(selected, names);
                    }}
                    onApplied={() => persist(labels.ui.contentSaved)}
                    onDelete={() => {
                      if (!window.confirm(labels.ui.contentDeleteRegionConfirm))
                        return;
                      flushEditorRef.current = null;
                      if (!removeRegion(selected)) return;
                      setSelected(null);
                      persist(labels.ui.contentRegionDeleted);
                    }}
                  />
                ) : (
                  <p className="mt-3 text-[var(--bp-muted)]">
                    {labels.ui.contentSelect}
                  </p>
                )}
              </div>
            ) : null}

            {tab === "events" && selected
              ? (() => {
                  const ev = EVENTS.find((e) => e.id === selected);
                  if (!ev) return null;
                  return (
                    <EventEditor
                      key={`event-${selected}`}
                      event={ev}
                      labels={labels}
                      registerFlush={(fn) => {
                        flushEditorRef.current = fn;
                      }}
                      onCommit={(next, names) => {
                        patchEvent(selected, { ...next, id: selected });
                        patchEventLabels(selected, names);
                      }}
                      onApplied={() => persist(labels.ui.contentSaved)}
                      onDelete={() => {
                        if (!window.confirm(labels.ui.contentDeleteEventConfirm))
                          return;
                        flushEditorRef.current = null;
                        if (!removeEvent(selected)) return;
                        setSelected(null);
                        persist(labels.ui.contentEventDeleted);
                      }}
                    />
                  );
                })()
              : null}

            {tab === "items" && selected && ITEMS[selected] ? (
              <ItemEditor
                key={`item-${selected}`}
                id={selected}
                labels={labels}
                registerFlush={(fn) => {
                  flushEditorRef.current = fn;
                }}
                onCommit={(patch, names) => {
                  patchItem(selected, patch);
                  patchItemLabels(selected, names);
                }}
                onApplied={() => persist(labels.ui.contentSaved)}
                onDelete={() => {
                  if (!window.confirm(labels.ui.contentDeleteItemConfirm)) return;
                  flushEditorRef.current = null;
                  if (!removeItem(selected)) return;
                  setSelected(null);
                  persist(labels.ui.contentItemDeleted);
                }}
              />
            ) : null}

            {tab === "relics" && selected && RELICS[selected] ? (
              <RelicEditor
                key={`relic-${selected}`}
                id={selected}
                labels={labels}
                registerFlush={(fn) => {
                  flushEditorRef.current = fn;
                }}
                onCommit={(patch, names) => {
                  patchRelic(selected, patch);
                  patchRelicLabels(selected, names);
                }}
                onApplied={() => persist(labels.ui.contentSaved)}
                onDelete={() => {
                  if (!window.confirm(labels.ui.contentDeleteRelicConfirm)) return;
                  flushEditorRef.current = null;
                  if (!removeRelic(selected)) return;
                  setSelected(null);
                  persist(labels.ui.contentRelicDeleted);
                }}
              />
            ) : null}

            {tab === "rewards" ? (
              <RewardsEditor
                key="rewards"
                labels={labels}
                tuning={REWARD_TUNING}
                registerFlush={(fn) => {
                  flushEditorRef.current = fn;
                }}
                onCommit={(patch) => {
                  patchRewardTuning(patch);
                }}
                onApplied={() => persist(labels.ui.contentSaved)}
              />
            ) : null}

            {tab === "warnings" ? (
              selected != null && warnings[Number(selected)] ? (
                <div>
                  <p className="font-semibold">
                    {warnings[Number(selected)]!.level.toUpperCase()}
                  </p>
                  <p>{warnings[Number(selected)]!.scope}</p>
                  <p className="mt-2">{warnings[Number(selected)]!.message}</p>
                </div>
              ) : (
                <p className="text-[var(--bp-muted)]">
                  {warnings.length === 0
                    ? "No warnings"
                    : "Select a warning"}
                </p>
              )
            ) : null}

            {tab !== "rewards" &&
            tab !== "warnings" &&
            tab !== "regions" &&
            !selected ? (
              <p className="text-[var(--bp-muted)]">
                {labels.ui.contentSelect}
              </p>
            ) : null}
          </div>
        </div>
      </div>
  );

  if (layout === "page") return panel;

  return (
    <div
      className="beast-path__modal-backdrop"
      role="presentation"
      onClick={closePanel}
    >
      {panel}
    </div>
  );
}

function SpeciesEditor({
  id,
  labels,
  registerFlush,
  onCommit,
  onApplied,
  onDelete,
}: {
  id: SpeciesId;
  labels: LocaleLabel;
  registerFlush: (fn: (() => boolean) | null) => void;
  onCommit: (
    patch: Partial<Species>,
    names: { en: string; es: string },
    pools: {
      starter: boolean;
      wild: boolean;
      early: boolean;
      habitats: HabitatId[];
    },
  ) => void;
  onApplied: () => void;
  onDelete: () => void;
}) {
  const sp = SPECIES[id];
  const [baseHp, setBaseHp] = useState(sp.baseHp);
  const [baseAtk, setBaseAtk] = useState(sp.baseAtk);
  const [baseDef, setBaseDef] = useState(sp.baseDef);
  const [baseSpd, setBaseSpd] = useState(sp.baseSpd);
  const [rarity, setRarity] = useState(sp.rarity);
  const [element, setElement] = useState<Element | "">(sp.element ?? "");
  const [art, setArt] = useState(sp.art ?? "");
  const [artFull, setArtFull] = useState(sp.artFull ?? "");
  const [nameEn, setNameEn] = useState(copy.en.species[id] ?? id);
  const [nameEs, setNameEs] = useState(copy.es.species[id] ?? id);
  const [starter, setStarter] = useState(STARTER_IDS.includes(id));
  const [wild, setWild] = useState(WILD_POOL.includes(id));
  const [early, setEarly] = useState(EARLY_POOL.includes(id));
  const [habitats, setHabitats] = useState<HabitatId[]>(() =>
    habitatsForSpecies(id),
  );
  const [learnset, setLearnset] = useState<LearnEntry[]>(() => [...sp.learnset]);

  useEffect(() => {
    const next = SPECIES[id];
    setBaseHp(next.baseHp);
    setBaseAtk(next.baseAtk);
    setBaseDef(next.baseDef);
    setBaseSpd(next.baseSpd);
    setRarity(next.rarity);
    setElement(next.element ?? "");
    setArt(next.art ?? "");
    setArtFull(next.artFull ?? "");
    setNameEn(copy.en.species[id] ?? id);
    setNameEs(copy.es.species[id] ?? id);
    setStarter(STARTER_IDS.includes(id));
    setWild(WILD_POOL.includes(id));
    setEarly(EARLY_POOL.includes(id));
    setHabitats(habitatsForSpecies(id));
    setLearnset([...next.learnset]);
  }, [id]);

  const commit = () => {
    onCommit(
      {
        baseHp,
        baseAtk,
        baseDef,
        baseSpd,
        rarity,
        element: element || undefined,
        art: art || undefined,
        artFull: artFull || undefined,
        learnset,
      },
      {
        en: nameEn.trim() || id,
        es: nameEs.trim() || nameEn.trim() || id,
      },
      { starter, wild, early, habitats },
    );
    return true;
  };

  useEffect(() => {
    registerFlush(commit);
    return () => registerFlush(null);
  });

  return (
    <div>
      <p className="font-semibold">{nameEn || id}</p>
      <p className="text-[var(--bp-muted)]">{id}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Field label={labels.ui.contentNameEn}>
          <TextInput value={nameEn} onChange={setNameEn} />
        </Field>
        <Field label={labels.ui.contentNameEs}>
          <TextInput value={nameEs} onChange={setNameEs} />
        </Field>
        <Field label="baseHp">
          <NumInput value={baseHp} onChange={setBaseHp} />
        </Field>
        <Field label="baseAtk">
          <NumInput value={baseAtk} onChange={setBaseAtk} />
        </Field>
        <Field label="baseDef">
          <NumInput value={baseDef} onChange={setBaseDef} />
        </Field>
        <Field label="baseSpd">
          <NumInput value={baseSpd} onChange={setBaseSpd} />
        </Field>
      </div>
      <Field label="element">
        <select
          className="beast-path__field-control w-full px-2 py-1"
          value={element}
          onChange={(e) => setElement(e.target.value as Element | "")}
        >
          <option value="">{labels.ui.elementNone}</option>
          {ELEMENTS.map((el) => (
            <option key={el} value={el}>
              {el}
            </option>
          ))}
        </select>
      </Field>
      <Field label="rarity">
        <select
          className="beast-path__field-control w-full px-2 py-1"
          value={rarity}
          onChange={(e) => setRarity(e.target.value as Species["rarity"])}
        >
          {(["common", "uncommon", "rare", "boss"] as const).map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </Field>
      <BeastPathArtPicker
        labels={labels}
        value={art}
        onChange={setArt}
        label={labels.ui.contentArtThumb}
      />
      <BeastPathArtPicker
        labels={labels}
        value={artFull}
        onChange={setArtFull}
        label={labels.ui.contentArtFull}
      />
      <div className="mt-2 flex flex-wrap gap-3 text-[10px]">
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={starter}
            onChange={(e) => setStarter(e.target.checked)}
          />
          {labels.ui.contentPoolStarter}
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={wild}
            onChange={(e) => setWild(e.target.checked)}
          />
          {labels.ui.contentPoolWild}
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={early}
            onChange={(e) => setEarly(e.target.checked)}
          />
          {labels.ui.contentPoolEarly}
        </label>
      </div>
      <p className="mt-2 text-[10px] text-[var(--bp-muted)]">
        {labels.ui.contentHabitats}
      </p>
      <div className="mt-1 flex flex-wrap gap-2 text-[10px]">
        {HABITAT_IDS.map((habitat) => (
          <label key={habitat} className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={habitats.includes(habitat)}
              onChange={(e) =>
                setHabitats((prev) =>
                  e.target.checked
                    ? [...prev, habitat]
                    : prev.filter((h) => h !== habitat),
                )
              }
            />
            {labels.habitats[habitat] ?? habitat}
          </label>
        ))}
      </div>
      <p className="mt-2 font-semibold">{labels.ui.contentLearnset}</p>
      <ul>
        {learnset.map((entry, index) => (
          <li key={`${entry.moveId}-${index}`} className="mt-1 flex gap-1">
            <input
              type="number"
              className="beast-path__field-control w-12 px-1 py-0.5"
              value={entry.level}
              onChange={(e) => {
                const level = Number(e.target.value);
                setLearnset((rows) =>
                  rows.map((row, i) => (i === index ? { ...row, level } : row)),
                );
              }}
            />
            <select
              className="beast-path__field-control min-w-0 flex-1 px-1 py-0.5"
              value={entry.moveId}
              onChange={(e) => {
                const moveId = e.target.value as MoveId;
                setLearnset((rows) =>
                  rows.map((row, i) =>
                    i === index ? { ...row, moveId } : row,
                  ),
                );
              }}
            >
              {MOVE_IDS.map((moveId) => (
                <option key={moveId} value={moveId}>
                  {copy.en.moves[moveId]?.name ?? moveId}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="beast-path__btn-ghost px-1.5 text-[10px]"
              onClick={() =>
                setLearnset((rows) => rows.filter((_, i) => i !== index))
              }
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="beast-path__btn-ghost mt-1 px-2 py-1 text-[10px]"
        onClick={() =>
          setLearnset((rows) => [
            ...rows,
            { level: 1, moveId: MOVE_IDS[0] ?? "scratch" },
          ])
        }
      >
        {labels.ui.contentAddLearn}
      </button>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="beast-path__btn px-3 py-1.5 text-[11px]"
          onClick={() => {
            commit();
            onApplied();
          }}
        >
          {labels.ui.contentApply}
        </button>
        <button
          type="button"
          className="beast-path__btn-ghost px-3 py-1.5 text-[11px] text-[var(--bp-danger)]"
          onClick={onDelete}
        >
          {labels.ui.contentDeleteSpecies}
        </button>
      </div>
    </div>
  );
}

function MoveEditor({
  id,
  labels,
  registerFlush,
  onCommit,
  onApplied,
  onDelete,
}: {
  id: MoveId;
  labels: LocaleLabel;
  registerFlush: (fn: (() => boolean) | null) => void;
  onCommit: (
    patch: Partial<{
      element?: Element;
      maxUses: number;
      effects: MoveEffect[];
    }>,
    names: {
      en: { name: string; description: string };
      es: { name: string; description: string };
    },
  ) => void;
  onApplied: () => void;
  onDelete: () => void;
}) {
  const move = normalizeMoveDef(MOVES[id]);
  const [element, setElement] = useState<Element | "">(move.element ?? "");
  const [maxUses, setMaxUses] = useState(move.maxUses);
  const [effects, setEffects] = useState<MoveEffect[]>(move.effects);
  const [nameEn, setNameEn] = useState(copy.en.moves[id]?.name ?? id);
  const [nameEs, setNameEs] = useState(copy.es.moves[id]?.name ?? id);
  const [descEn, setDescEn] = useState(copy.en.moves[id]?.description ?? "");
  const [descEs, setDescEs] = useState(copy.es.moves[id]?.description ?? "");

  useEffect(() => {
    const next = normalizeMoveDef(MOVES[id]);
    setElement(next.element ?? "");
    setMaxUses(next.maxUses);
    setEffects(next.effects);
    setNameEn(copy.en.moves[id]?.name ?? id);
    setNameEs(copy.es.moves[id]?.name ?? id);
    setDescEn(copy.en.moves[id]?.description ?? "");
    setDescEs(copy.es.moves[id]?.description ?? "");
  }, [id]);

  const commit = () => {
    onCommit(
      {
        maxUses,
        element: element || undefined,
        effects,
      },
      {
        en: { name: nameEn.trim() || id, description: descEn },
        es: {
          name: nameEs.trim() || nameEn.trim() || id,
          description: descEs,
        },
      },
    );
    return true;
  };

  useEffect(() => {
    registerFlush(commit);
    return () => registerFlush(null);
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">
          {nameEn || id}
          <span className="ml-2 text-[10px] font-normal text-[var(--bp-muted)]">
            {moveIsOffensive({ ...move, effects }) ? "offensive" : "support"}
          </span>
        </p>
        <button
          type="button"
          className="beast-path__btn-ghost px-2 py-1 text-[10px] text-[var(--bp-danger)]"
          onClick={onDelete}
        >
          {labels.ui.contentDeleteMove}
        </button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Field label={labels.ui.contentNameEn}>
          <TextInput value={nameEn} onChange={setNameEn} />
        </Field>
        <Field label={labels.ui.contentNameEs}>
          <TextInput value={nameEs} onChange={setNameEs} />
        </Field>
      </div>
      <Field label={labels.ui.contentDescEn}>
        <TextInput value={descEn} onChange={setDescEn} />
      </Field>
      <Field label={labels.ui.contentDescEs}>
        <TextInput value={descEs} onChange={setDescEs} />
      </Field>
      <Field label={labels.ui.contentEffectElement}>
        <select
          className="beast-path__field-control w-full px-2 py-1"
          value={element}
          onChange={(e) => setElement(e.target.value as Element | "")}
        >
          <option value="">{labels.ui.elementNone}</option>
          {ELEMENTS.map((el) => (
            <option key={el} value={el}>
              {el}
            </option>
          ))}
        </select>
      </Field>
      <Field label="maxUses">
        <NumInput value={maxUses} onChange={setMaxUses} />
      </Field>
      <EffectListEditor
        mode="move"
        value={effects}
        onChange={(next) => setEffects(next as MoveEffect[])}
        labels={labels}
      />
      <button
        type="button"
        className="beast-path__btn mt-3 px-3 py-1.5 text-[11px]"
        onClick={() => {
          commit();
          onApplied();
        }}
      >
        {labels.ui.contentApply}
      </button>
    </div>
  );
}

function EventEditor({
  event,
  labels,
  registerFlush,
  onCommit,
  onApplied,
  onDelete,
}: {
  event: EventDef;
  labels: LocaleLabel;
  registerFlush: (fn: (() => boolean) | null) => void;
  onCommit: (
    next: EventDef,
    names: {
      en: { title: string; body: string; choices: Record<string, string> };
      es: { title: string; body: string; choices: Record<string, string> };
    },
  ) => void;
  onApplied: () => void;
  onDelete?: () => void;
}) {
  const [json, setJson] = useState(() => JSON.stringify(event, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [isGlobal, setIsGlobal] = useState(event.global !== false);
  const [titleEn, setTitleEn] = useState(
    copy.en.events[event.id]?.title ?? event.id,
  );
  const [titleEs, setTitleEs] = useState(
    copy.es.events[event.id]?.title ?? event.id,
  );
  const [bodyEn, setBodyEn] = useState(copy.en.events[event.id]?.body ?? "");
  const [bodyEs, setBodyEs] = useState(copy.es.events[event.id]?.body ?? "");
  const [choicesEn, setChoicesEn] = useState(
    JSON.stringify(copy.en.events[event.id]?.choices ?? {}, null, 2),
  );
  const [choicesEs, setChoicesEs] = useState(
    JSON.stringify(copy.es.events[event.id]?.choices ?? {}, null, 2),
  );

  useEffect(() => {
    setJson(JSON.stringify(event, null, 2));
    setError(null);
    setIsGlobal(event.global !== false);
    setTitleEn(copy.en.events[event.id]?.title ?? event.id);
    setTitleEs(copy.es.events[event.id]?.title ?? event.id);
    setBodyEn(copy.en.events[event.id]?.body ?? "");
    setBodyEs(copy.es.events[event.id]?.body ?? "");
    setChoicesEn(
      JSON.stringify(copy.en.events[event.id]?.choices ?? {}, null, 2),
    );
    setChoicesEs(
      JSON.stringify(copy.es.events[event.id]?.choices ?? {}, null, 2),
    );
  }, [event]);

  const commit = () => {
    try {
      const next = JSON.parse(json) as EventDef;
      if (!next.id || !Array.isArray(next.choices)) {
        throw new Error("id/choices required");
      }
      next.global = isGlobal;
      const enChoices = JSON.parse(choicesEn) as Record<string, string>;
      const esChoices = JSON.parse(choicesEs) as Record<string, string>;
      onCommit(next, {
        en: { title: titleEn, body: bodyEn, choices: enChoices },
        es: { title: titleEs, body: bodyEs, choices: esChoices },
      });
      setError(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON");
      return false;
    }
  };

  useEffect(() => {
    registerFlush(commit);
    return () => registerFlush(null);
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{titleEn || event.id}</p>
        {onDelete ? (
          <button
            type="button"
            className="beast-path__btn-ghost px-2 py-1 text-[10px] text-[var(--bp-danger)]"
            onClick={onDelete}
          >
            {labels.ui.contentDeleteEvent}
          </button>
        ) : null}
      </div>
      <label className="mt-2 flex items-center gap-2 text-[11px]">
        <input
          type="checkbox"
          checked={isGlobal}
          onChange={(e) => setIsGlobal(e.target.checked)}
        />
        <span>{labels.ui.contentEventGlobal}</span>
      </label>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Field label={labels.ui.contentTitleEn}>
          <TextInput value={titleEn} onChange={setTitleEn} />
        </Field>
        <Field label={labels.ui.contentTitleEs}>
          <TextInput value={titleEs} onChange={setTitleEs} />
        </Field>
      </div>
      <Field label={labels.ui.contentBodyEn}>
        <textarea
          className="beast-path__field-control min-h-[4rem] w-full px-2 py-1 text-[11px]"
          value={bodyEn}
          onChange={(e) => setBodyEn(e.target.value)}
        />
      </Field>
      <Field label={labels.ui.contentBodyEs}>
        <textarea
          className="beast-path__field-control min-h-[4rem] w-full px-2 py-1 text-[11px]"
          value={bodyEs}
          onChange={(e) => setBodyEs(e.target.value)}
        />
      </Field>
      <Field label="choices EN JSON">
        <textarea
          className="beast-path__field-control min-h-[5rem] w-full px-2 py-1 font-mono text-[10px]"
          value={choicesEn}
          onChange={(e) => setChoicesEn(e.target.value)}
        />
      </Field>
      <Field label="choices ES JSON">
        <textarea
          className="beast-path__field-control min-h-[5rem] w-full px-2 py-1 font-mono text-[10px]"
          value={choicesEs}
          onChange={(e) => setChoicesEs(e.target.value)}
        />
      </Field>
      <Field label="EventDef JSON">
        <textarea
          className="beast-path__field-control min-h-[8rem] w-full px-2 py-1 font-mono text-[10px]"
          value={json}
          onChange={(e) => setJson(e.target.value)}
        />
      </Field>
      {error ? (
        <p className="mt-1 text-[10px] text-[var(--bp-danger)]">{error}</p>
      ) : null}
      <button
        type="button"
        className="beast-path__btn mt-3 px-3 py-1.5 text-[11px]"
        onClick={() => {
          if (commit()) onApplied();
        }}
      >
        {labels.ui.contentApply}
      </button>
    </div>
  );
}

function IdChecklist({
  label,
  ids,
  selected,
  nameOf,
  onChange,
}: {
  label: string;
  ids: string[];
  selected: string[];
  nameOf: (id: string) => string;
  onChange: (next: string[]) => void;
}) {
  const set = new Set(selected);
  return (
    <Field label={label}>
      <div className="mt-1 grid max-h-36 grid-cols-2 gap-1 overflow-auto border border-[var(--bp-line)] p-1.5 sm:grid-cols-3">
        {ids.map((id) => (
          <label key={id} className="flex items-center gap-1 text-[10px]">
            <input
              type="checkbox"
              checked={set.has(id)}
              onChange={(e) => {
                const next = new Set(selected);
                if (e.target.checked) next.add(id);
                else next.delete(id);
                onChange([...next]);
              }}
            />
            <span className="truncate">{nameOf(id)}</span>
          </label>
        ))}
      </div>
    </Field>
  );
}

function RegionEditor({
  id,
  labels,
  registerFlush,
  onCommit,
  onApplied,
  onDelete,
}: {
  id: RegionId;
  labels: LocaleLabel;
  registerFlush: (fn: (() => boolean) | null) => void;
  onCommit: (
    patch: Partial<RegionDef>,
    names: { en: string; es: string },
  ) => void;
  onApplied: () => void;
  onDelete: () => void;
}) {
  const region = REGIONS[id]!;
  const [nameEn, setNameEn] = useState(copy.en.regions[id] ?? id);
  const [nameEs, setNameEs] = useState(copy.es.regions[id] ?? id);
  const [levels, setLevels] = useState<RunLevel[]>([...region.levels]);
  const [creatures, setCreatures] = useState([...region.creatures]);
  const [earlyCreatures, setEarlyCreatures] = useState([
    ...(region.earlyCreatures ?? []),
  ]);
  const [bosses, setBosses] = useState([...region.bosses]);
  const [events, setEvents] = useState([...region.events]);

  useEffect(() => {
    const next = REGIONS[id]!;
    setNameEn(copy.en.regions[id] ?? id);
    setNameEs(copy.es.regions[id] ?? id);
    setLevels([...next.levels]);
    setCreatures([...next.creatures]);
    setEarlyCreatures([...(next.earlyCreatures ?? [])]);
    setBosses([...next.bosses]);
    setEvents([...next.events]);
  }, [id]);

  const commit = () => {
    onCommit(
      {
        levels: levels.length > 0 ? levels : [1],
        creatures,
        earlyCreatures,
        bosses,
        events,
      },
      {
        en: nameEn.trim() || id,
        es: nameEs.trim() || nameEn.trim() || id,
      },
    );
    return true;
  };

  useEffect(() => {
    registerFlush(commit);
    return () => registerFlush(null);
  });

  const speciesIds = [...SPECIES_IDS];
  const bossIds = listBossIds();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">
          {nameEn || id}{" "}
          <span className="text-[10px] font-normal text-[var(--bp-muted)]">
            ({id})
          </span>
        </p>
        <button
          type="button"
          className="beast-path__btn-ghost px-2 py-1 text-[10px] text-[var(--bp-danger)]"
          onClick={onDelete}
        >
          {labels.ui.contentDeleteRegion}
        </button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Field label={labels.ui.contentNameEn}>
          <TextInput value={nameEn} onChange={setNameEn} />
        </Field>
        <Field label={labels.ui.contentNameEs}>
          <TextInput value={nameEs} onChange={setNameEs} />
        </Field>
      </div>
      <IdChecklist
        label={labels.ui.contentRegionLevels}
        ids={RUN_LEVELS.map(String)}
        selected={levels.map(String)}
        nameOf={(lvl) =>
          labels.ui.contentRegionLevelN.replace("{n}", lvl)
        }
        onChange={(next) => {
          setLevels(
            next
              .map((n) => Number(n) as RunLevel)
              .filter((n): n is RunLevel => n === 1 || n === 2 || n === 3)
              .sort((a, b) => a - b),
          );
        }}
      />
      <IdChecklist
        label={labels.ui.contentRegionCreatures}
        ids={speciesIds}
        selected={creatures}
        nameOf={(sid) => copy.en.species[sid] ?? sid}
        onChange={setCreatures}
      />
      <IdChecklist
        label={labels.ui.contentRegionEarly}
        ids={speciesIds}
        selected={earlyCreatures}
        nameOf={(sid) => copy.en.species[sid] ?? sid}
        onChange={setEarlyCreatures}
      />
      <IdChecklist
        label={labels.ui.contentRegionBosses}
        ids={bossIds.length ? bossIds : speciesIds}
        selected={bosses}
        nameOf={(sid) => copy.en.species[sid] ?? sid}
        onChange={setBosses}
      />
      <IdChecklist
        label={labels.ui.contentRegionEvents}
        ids={[...EVENT_IDS]}
        selected={events}
        nameOf={(eid) => copy.en.events[eid]?.title ?? eid}
        onChange={setEvents}
      />
      <button
        type="button"
        className="beast-path__btn mt-3 px-3 py-1.5 text-[11px]"
        onClick={() => {
          commit();
          onApplied();
        }}
      >
        {labels.ui.contentApply}
      </button>
    </div>
  );
}

function ItemEditor({
  id,
  labels,
  registerFlush,
  onCommit,
  onApplied,
  onDelete,
}: {
  id: string;
  labels: LocaleLabel;
  registerFlush: (fn: (() => boolean) | null) => void;
  onCommit: (
    patch: Partial<ItemDef>,
    names: {
      en: { name: string; description: string };
      es: { name: string; description: string };
    },
  ) => void;
  onApplied: () => void;
  onDelete: () => void;
}) {
  const item = ITEMS[id]!;
  const [shopCost, setShopCost] = useState(item.shopCost ?? 0);
  const [maxStack, setMaxStack] = useState(item.maxStack ?? 0);
  const [art, setArt] = useState(item.art ?? "");
  const [effects, setEffects] = useState(item.effects);
  const [nameEn, setNameEn] = useState(copy.en.items[id]?.name ?? id);
  const [nameEs, setNameEs] = useState(copy.es.items[id]?.name ?? id);
  const [descEn, setDescEn] = useState(copy.en.items[id]?.description ?? "");
  const [descEs, setDescEs] = useState(copy.es.items[id]?.description ?? "");

  useEffect(() => {
    const next = ITEMS[id]!;
    setShopCost(next.shopCost ?? 0);
    setMaxStack(next.maxStack ?? 0);
    setArt(next.art ?? "");
    setEffects(next.effects);
    setNameEn(copy.en.items[id]?.name ?? id);
    setNameEs(copy.es.items[id]?.name ?? id);
    setDescEn(copy.en.items[id]?.description ?? "");
    setDescEs(copy.es.items[id]?.description ?? "");
  }, [id]);

  const commit = () => {
    onCommit(
      {
        shopCost,
        maxStack: maxStack > 0 ? maxStack : undefined,
        art: art || undefined,
        effects,
      },
      {
        en: { name: nameEn.trim() || id, description: descEn },
        es: {
          name: nameEs.trim() || nameEn.trim() || id,
          description: descEs,
        },
      },
    );
    return true;
  };

  useEffect(() => {
    registerFlush(commit);
    return () => registerFlush(null);
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{nameEn || id}</p>
        <button
          type="button"
          className="beast-path__btn-ghost px-2 py-1 text-[10px] text-[var(--bp-danger)]"
          onClick={onDelete}
        >
          {labels.ui.contentDeleteItem}
        </button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Field label={labels.ui.contentNameEn}>
          <TextInput value={nameEn} onChange={setNameEn} />
        </Field>
        <Field label={labels.ui.contentNameEs}>
          <TextInput value={nameEs} onChange={setNameEs} />
        </Field>
      </div>
      <Field label={labels.ui.contentDescEn}>
        <TextInput value={descEn} onChange={setDescEn} />
      </Field>
      <Field label={labels.ui.contentDescEs}>
        <TextInput value={descEs} onChange={setDescEs} />
      </Field>
      <Field label="shopCost">
        <NumInput value={shopCost} onChange={setShopCost} />
      </Field>
      <Field label="maxStack (0 = unlimited)">
        <NumInput value={maxStack} onChange={setMaxStack} />
      </Field>
      <BeastPathArtPicker labels={labels} value={art} onChange={setArt} />
      <EffectListEditor
        mode="item"
        value={effects}
        onChange={(next) => setEffects(next as ItemDef["effects"])}
        labels={labels}
      />
      <button
        type="button"
        className="beast-path__btn mt-3 px-3 py-1.5 text-[11px]"
        onClick={() => {
          commit();
          onApplied();
        }}
      >
        {labels.ui.contentApply}
      </button>
    </div>
  );
}

function RelicEditor({
  id,
  labels,
  registerFlush,
  onCommit,
  onApplied,
  onDelete,
}: {
  id: string;
  labels: LocaleLabel;
  registerFlush: (fn: (() => boolean) | null) => void;
  onCommit: (
    patch: Partial<RelicDef>,
    names: {
      en: { name: string; description: string };
      es: { name: string; description: string };
    },
  ) => void;
  onApplied: () => void;
  onDelete: () => void;
}) {
  const relic = RELICS[id]!;
  const [art, setArt] = useState(relic.art ?? "");
  const [hooks, setHooks] = useState(relic.hooks);
  const [nameEn, setNameEn] = useState(copy.en.relics[id]?.name ?? id);
  const [nameEs, setNameEs] = useState(copy.es.relics[id]?.name ?? id);
  const [descEn, setDescEn] = useState(copy.en.relics[id]?.description ?? "");
  const [descEs, setDescEs] = useState(copy.es.relics[id]?.description ?? "");

  useEffect(() => {
    const next = RELICS[id]!;
    setArt(next.art ?? "");
    setHooks(next.hooks);
    setNameEn(copy.en.relics[id]?.name ?? id);
    setNameEs(copy.es.relics[id]?.name ?? id);
    setDescEn(copy.en.relics[id]?.description ?? "");
    setDescEs(copy.es.relics[id]?.description ?? "");
  }, [id]);

  const commit = () => {
    onCommit(
      { art: art || undefined, hooks },
      {
        en: { name: nameEn.trim() || id, description: descEn },
        es: {
          name: nameEs.trim() || nameEn.trim() || id,
          description: descEs,
        },
      },
    );
    return true;
  };

  useEffect(() => {
    registerFlush(commit);
    return () => registerFlush(null);
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{nameEn || id}</p>
        <button
          type="button"
          className="beast-path__btn-ghost px-2 py-1 text-[10px] text-[var(--bp-danger)]"
          onClick={onDelete}
        >
          {labels.ui.contentDeleteRelic}
        </button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Field label={labels.ui.contentNameEn}>
          <TextInput value={nameEn} onChange={setNameEn} />
        </Field>
        <Field label={labels.ui.contentNameEs}>
          <TextInput value={nameEs} onChange={setNameEs} />
        </Field>
      </div>
      <Field label={labels.ui.contentDescEn}>
        <TextInput value={descEn} onChange={setDescEn} />
      </Field>
      <Field label={labels.ui.contentDescEs}>
        <TextInput value={descEs} onChange={setDescEs} />
      </Field>
      <BeastPathArtPicker labels={labels} value={art} onChange={setArt} />
      <EffectListEditor
        mode="relic"
        value={hooks}
        onChange={(next) => setHooks(next as RelicDef["hooks"])}
        labels={labels}
      />
      <button
        type="button"
        className="beast-path__btn mt-3 px-3 py-1.5 text-[11px]"
        onClick={() => {
          commit();
          onApplied();
        }}
      >
        {labels.ui.contentApply}
      </button>
    </div>
  );
}

function RewardsEditor({
  labels,
  tuning,
  registerFlush,
  onCommit,
  onApplied,
}: {
  labels: LocaleLabel;
  tuning: RewardTuning;
  registerFlush: (fn: (() => boolean) | null) => void;
  onCommit: (patch: Partial<RewardTuning>) => void;
  onApplied: () => void;
}) {
  const [draft, setDraft] = useState({ ...tuning });

  useEffect(() => {
    setDraft({ ...REWARD_TUNING });
  }, [tuning]);

  const commit = () => {
    onCommit(draft);
    return true;
  };

  useEffect(() => {
    registerFlush(commit);
    return () => registerFlush(null);
  });

  return (
    <div>
      <p className="font-semibold">{labels.ui.contentRewards}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {(Object.keys(draft) as (keyof RewardTuning)[]).map((key) => (
          <Field key={key} label={key}>
            <NumInput
              value={draft[key]}
              step={0.05}
              onChange={(n) => setDraft((d) => ({ ...d, [key]: n }))}
            />
          </Field>
        ))}
      </div>
      <p className="mt-3 text-[10px] text-[var(--bp-muted)]">
        Preview — gold battle col5 L1:{" "}
        {Math.round(baseGoldFor("battle", 5) * runLevelGoldMult(1))} · capture
        full: {(captureChance(10, 10) * 100).toFixed(0)}% · xp@40g:{" "}
        {xpFromGoldReward(40)} · xpToNext(5): {xpToNext(5)}
      </p>
      <button
        type="button"
        className="beast-path__btn mt-3 px-3 py-1.5 text-[11px]"
        onClick={() => {
          commit();
          onApplied();
        }}
      >
        {labels.ui.contentApply}
      </button>
    </div>
  );
}

