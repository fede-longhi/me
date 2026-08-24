"use client";

import { Oxanium } from "next/font/google";
import {
  Backpack,
  Bed,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Crown,
  Droplets,
  Flower2,
  Heart,
  Maximize2,
  Menu,
  Minimize2,
  Mountain,
  Palmtree,
  Shield,
  ShoppingBag,
  Skull,
  Swords,
  Tent,
  Trees,
  Users,
  Waves,
  Wind,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { GameChrome } from "@/components/games/GameChrome";
import { useLanguage } from "@/components/LanguageProvider";
import { elementColorOf, getItem, isBeastPathDev, SPECIES, speciesFullArt, speciesThumbArt, syncPublishedContent } from "@/lib/roguelike/content";
import { BeastPathContentPanel } from "@/components/games/BeastPathContentPanel";
import { BeastPortrait } from "@/components/games/BeastPortrait";
import {
  buildFightTimeline,
  allPlansReady,
  canStartFight,
  moveImpactHint,
  moveRequiresTargetChoice,
  plannedEffectsOn,
  previewTurnOrder,
  validTargetsForMove,
  type BattleFx,
  type MovePreview,
} from "@/lib/roguelike/combat";
import { MAP_LANES } from "@/lib/roguelike/map";
import { getMove, maxUsesFor, moveIsOffensive, remainingUses } from "@/lib/roguelike/moves";
import { xpToNext } from "@/lib/roguelike/monsters";
import {
  applyFightBattle,
  armCapture,
  buyOffer,
  claimBattleRewards,
  clearMovePlan,
  continueFromEvent,
  createMenuState,
  createRun,
  enterNode,
  getFightSeed,
  getLabels,
  getStarters,
  leaveShop,
  movePartyToReserve,
  moveReserveToParty,
  planMove,
  resolveEvent,
  selectStarter,
  sellCreature,
  sellPriceFor,
  skipMove,
  swapReserveIntoParty,
  takeRest,
  useItem,
} from "@/lib/roguelike/run";
import {
  clearSavedRun,
  hasSavedRun,
  hydrateRun,
  readSavedRun,
  syncRunPersistence,
} from "@/lib/roguelike/persist";
import type {
  BattleState,
  HabitatId,
  MapNode,
  Monster,
  MoveId,
  NodeType,
  RunState,
  Species,
} from "@/lib/roguelike/types";
import { BAG_LIMIT } from "@/lib/roguelike/types";
import { MAX_MOVES, MAX_RUN_LEVEL } from "@/lib/roguelike/types";

const oxanium = Oxanium({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-oxanium",
  display: "swap",
});

const COL_GAP = 100;
const ROW_GAP = 58;
const NODE_R = 24;
const PAD_X = 48;
const PAD_Y = 44;

/** Distinct accent per party slot (not tied to element). */
const PARTY_COLORS = [
  "#6f9f6a",
  "#d4b56a",
  "#5a9fd4",
  "#c45c2a",
  "#9b7bb8",
  "#4aa3a1",
] as const;

const NODE_ICONS: Record<
  NodeType,
  ComponentType<{ className?: string; size?: number; strokeWidth?: number }>
> = {
  start: Tent,
  battle: Swords,
  elite: Skull,
  shop: ShoppingBag,
  event: CircleHelp,
  rest: Bed,
  boss: Crown,
  habitat: Trees,
};

const HABITAT_ICONS: Record<
  HabitatId,
  ComponentType<{ className?: string; size?: number; strokeWidth?: number }>
> = {
  cave: Mountain,
  grassland: Flower2,
  forest: Trees,
  river: Droplets,
  sea: Waves,
  beach: Palmtree,
  desert: Wind,
  swamp: Droplets,
};

function layoutMap(nodes: MapNode[]) {
  const maxCols = Math.max(...nodes.map((n) => n.column)) + 1;
  const positions = new Map<string, { x: number; y: number }>();

  for (const node of nodes) {
    positions.set(node.id, {
      x: PAD_X + node.column * COL_GAP,
      y: PAD_Y + node.row * ROW_GAP,
    });
  }

  return {
    positions,
    width: PAD_X * 2 + (maxCols - 1) * COL_GAP,
    height: PAD_Y * 2 + (MAP_LANES - 1) * ROW_GAP,
  };
}

function HpBar({
  hp,
  maxHp,
  damage = 0,
  heal = 0,
}: {
  hp: number;
  maxHp: number;
  damage?: number;
  heal?: number;
}) {
  const safeMax = Math.max(1, maxHp);
  const dmg = Math.max(0, Math.min(hp, damage));
  const healAmt = Math.max(0, Math.min(safeMax - hp, heal));
  const remainPct = ((hp - dmg) / safeMax) * 100;
  const dmgPct = (dmg / safeMax) * 100;
  const healPct = (healAmt / safeMax) * 100;
  const hpPct = (hp / safeMax) * 100;

  return (
    <div className="beast-path__hp" aria-hidden>
      <span className="beast-path__hp-fill" style={{ width: `${remainPct}%` }} />
      {dmg > 0 ? (
        <span
          className="beast-path__hp-damage"
          style={{ left: `${remainPct}%`, width: `${dmgPct}%` }}
        />
      ) : null}
      {healAmt > 0 ? (
        <span
          className="beast-path__hp-heal"
          style={{ left: `${hpPct}%`, width: `${healPct}%` }}
        />
      ) : null}
    </div>
  );
}

function XpBar({
  xp,
  level,
  label,
}: {
  xp: number;
  level: number;
  label: string;
}) {
  const need = xpToNext(level);
  const pct = Math.max(0, Math.min(100, (xp / Math.max(1, need)) * 100));
  return (
    <div
      className="beast-path__xp"
      title={`${label}: ${xp}/${need}`}
      aria-label={`${label} ${xp}/${need}`}
    >
      <span className="beast-path__xp-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Intersect center→target with a rect edge (field-local coords). */
function edgePoint(
  left: number,
  top: number,
  width: number,
  height: number,
  towardX: number,
  towardY: number,
) {
  const cx = left + width / 2;
  const cy = top + height / 2;
  const dx = towardX - cx;
  const dy = towardY - cy;
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
    return { x: cx, y: cy };
  }
  const scale = Math.min(
    width / 2 / Math.abs(dx),
    height / 2 / Math.abs(dy),
  );
  return { x: cx + dx * scale, y: cy + dy * scale };
}

function curvedLinkPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  bend: number,
) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const cx = mx + (-dy / len) * bend;
  const cy = my + (dx / len) * bend;
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}

function hpPreviewFromEffects(effects: MovePreview[]) {
  let damage = 0;
  let heal = 0;
  for (const effect of effects) {
    if (effect.kind === "damage") damage += effect.amount;
    if (effect.kind === "heal") heal += effect.amount;
  }
  return { damage, heal };
}

type Floater = {
  key: string;
  targetId: string;
  text: string;
  tone: "damage" | "heal" | "buff" | "guard";
};

function floatersFromFx(fx: BattleFx[], stepKey: string): Floater[] {
  const out: Floater[] = [];
  fx.forEach((item, i) => {
    if (item.kind === "damage") {
      out.push({
        key: `${stepKey}-d${i}`,
        targetId: item.targetId,
        text: `−${item.amount}`,
        tone: "damage",
      });
    } else if (item.kind === "heal") {
      out.push({
        key: `${stepKey}-h${i}`,
        targetId: item.targetId,
        text: `+${item.amount}`,
        tone: "heal",
      });
    } else if (item.kind === "buff" || item.kind === "guard") {
      out.push({
        key: `${stepKey}-b${i}`,
        targetId: item.targetId,
        text: item.text,
        tone: item.kind,
      });
    } else if (item.kind === "status") {
      out.push({
        key: `${stepKey}-s${i}`,
        targetId: item.targetId,
        text: item.text,
        tone: "buff",
      });
    } else if (item.kind === "ward") {
      out.push({
        key: `${stepKey}-w${i}`,
        targetId: item.targetId,
        text: "ward",
        tone: "guard",
      });
    } else if (item.kind === "capture") {
      out.push({
        key: `${stepKey}-c${i}`,
        targetId: item.targetId,
        text: item.success ? "★" : "✕",
        tone: item.success ? "heal" : "damage",
      });
    }
  });
  return out;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function statusEffects(effects: MovePreview[]) {
  return effects.filter((e) => e.kind !== "damage");
}

function effectIcon(effect: MovePreview): LucideIcon {
  if (effect.kind === "heal") return Heart;
  if (effect.kind === "guard") return Shield;
  if (effect.kind === "buff") {
    if (effect.stat === "SPD") return Wind;
    if (effect.stat === "DEF") return Shield;
    return Swords;
  }
  return CircleHelp;
}

function MonsterPortrait({
  speciesId,
  label,
  compact,
  variant = "thumb",
}: {
  speciesId: string;
  label: string;
  compact?: boolean;
  variant?: "thumb" | "full";
}) {
  const species = SPECIES[speciesId];
  const art =
    variant === "full" ? speciesFullArt(species) : speciesThumbArt(species);
  return (
    <div
      className={[
        "beast-path__portrait",
        variant === "full" ? "beast-path__portrait--full" : "",
        compact ? "mb-1.5 min-h-[3.5rem]" : "mb-3",
      ].join(" ")}
    >
      <BeastPortrait art={art} alt={label} variant={variant} fill />
    </div>
  );
}

function MonsterCard({
  monster,
  labels,
  selected,
  dimmed,
  compact,
  onClick,
}: {
  monster: Monster;
  labels: ReturnType<typeof getLabels>;
  selected?: boolean;
  dimmed?: boolean;
  compact?: boolean;
  onClick?: () => void;
}) {
  const interactive = Boolean(onClick);
  const className = [
    "beast-path__panel text-left transition",
    compact ? "beast-path__starter-card" : "p-3",
    selected ? "ring-1 ring-[var(--bp-ember)] border-[var(--bp-ember)]" : "",
    dimmed ? "opacity-40" : "",
    interactive
      ? "cursor-pointer hover:border-[color-mix(in_oklab,var(--bp-gold)_60%,transparent)]"
      : "",
  ].join(" ");

  const body = (
    <>
      <MonsterPortrait
        speciesId={monster.speciesId}
        label={monster.name}
        compact={compact}
        variant="full"
      />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className={[
              "beast-path__title truncate font-semibold",
              compact ? "text-sm" : "text-base",
            ].join(" ")}
          >
            {monster.name}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--bp-muted)]">
            {labels.ui.level} {monster.level} ·{" "}
            <span style={{ color: elementColorOf(monster.element) }}>
              {monster.element
                ? labels.elements[monster.element]
                : labels.ui.elementNone}
            </span>
          </p>
        </div>
        <p className="shrink-0 text-[11px] font-semibold text-[var(--bp-muted)]">
          {monster.hp}/{monster.maxHp}
        </p>
      </div>
      <div className={compact ? "mt-1.5" : "mt-2"}>
        <HpBar hp={monster.hp} maxHp={monster.maxHp} />
      </div>
      <dl
        className={[
          "grid grid-cols-3 gap-2 uppercase tracking-wide text-[var(--bp-muted)]",
          compact ? "mt-2 text-[10px]" : "mt-3 text-[11px]",
        ].join(" ")}
      >
        <div>
          <dt>{labels.ui.atk}</dt>
          <dd className="text-sm font-semibold normal-case tracking-normal text-[var(--bp-ink)]">
            {monster.atk}
          </dd>
        </div>
        <div>
          <dt>{labels.ui.def}</dt>
          <dd className="text-sm font-semibold normal-case tracking-normal text-[var(--bp-ink)]">
            {monster.def}
          </dd>
        </div>
        <div>
          <dt>{labels.ui.spd}</dt>
          <dd className="text-sm font-semibold normal-case tracking-normal text-[var(--bp-ink)]">
            {monster.spd}
          </dd>
        </div>
      </dl>
    </>
  );

  if (interactive) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {body}
      </button>
    );
  }

  return <div className={className}>{body}</div>;
}

function rarityLabel(
  rarity: Species["rarity"],
  labels: ReturnType<typeof getLabels>,
) {
  switch (rarity) {
    case "uncommon":
      return labels.ui.rarityUncommon;
    case "rare":
      return labels.ui.rarityRare;
    case "boss":
      return labels.ui.rarityBoss;
    default:
      return labels.ui.rarityCommon;
  }
}

function PartyBeastDetail({
  monster,
  labels,
  onClose,
}: {
  monster: Monster;
  labels: ReturnType<typeof getLabels>;
  onClose: () => void;
}) {
  const species = SPECIES[monster.speciesId];
  const need = xpToNext(monster.level);
  const moveIds = monster.moves.filter(Boolean);

  return (
    <div
      className="beast-path__modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="beast-path__modal beast-path__party-detail"
        role="dialog"
        aria-modal="true"
        aria-label={labels.ui.partyDetail}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">{labels.ui.partyDetail}</p>
          <button
            type="button"
            className="beast-path__btn-ghost px-2 py-1 text-[10px]"
            onClick={onClose}
          >
            {labels.ui.partyDetailClose}
          </button>
        </div>

        <div className="beast-path__party-detail-body">
          <div className="beast-path__party-detail-layout">
            <div className="beast-path__party-detail-art">
              <BeastPortrait
                art={speciesThumbArt(species)}
                alt={monster.name}
                variant="thumb"
                fill
              />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold leading-tight">
                {monster.name}
              </p>
              <p className="mt-1 text-[11px] text-[var(--bp-muted)]">
                {labels.ui.level} {monster.level}
                {" · "}
                <span style={{ color: elementColorOf(monster.element) }}>
                  {monster.element
                    ? labels.elements[monster.element]
                    : labels.ui.elementNone}
                </span>
                {species ? (
                  <>
                    {" · "}
                    {labels.ui.partyDetailRarity}:{" "}
                    {rarityLabel(species.rarity, labels)}
                  </>
                ) : null}
              </p>

              <div className="mt-3 space-y-1.5">
                <div>
                  <div className="mb-0.5 flex items-baseline justify-between gap-2 text-[10px] text-[var(--bp-muted)]">
                    <span>{labels.ui.hp}</span>
                    <span>
                      {monster.hp}/{monster.maxHp}
                    </span>
                  </div>
                  <HpBar hp={monster.hp} maxHp={monster.maxHp} />
                </div>
                <div>
                  <div className="mb-0.5 flex items-baseline justify-between gap-2 text-[10px] text-[var(--bp-muted)]">
                    <span>{labels.ui.rewardXp}</span>
                    <span>
                      {labels.ui.partyDetailXp
                        .replace("{xp}", String(monster.xp))
                        .replace("{need}", String(need))}
                    </span>
                  </div>
                  <XpBar
                    xp={monster.xp}
                    level={monster.level}
                    label={labels.ui.rewardXp}
                  />
                </div>
              </div>

              <dl className="beast-path__party-detail-stats">
                <div>
                  <dt>{labels.ui.atk}</dt>
                  <dd>{monster.atk}</dd>
                </div>
                <div>
                  <dt>{labels.ui.def}</dt>
                  <dd>{monster.def}</dd>
                </div>
                <div>
                  <dt>{labels.ui.spd}</dt>
                  <dd>{monster.spd}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="beast-path__party-detail-moves">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--bp-gold)]">
              {labels.ui.partyDetailMoves}
            </p>
            {moveIds.length === 0 ? (
              <p className="text-[11px] text-[var(--bp-muted)]">
                {labels.ui.partyDetailEmptyMoves}
              </p>
            ) : (
              moveIds.map((moveId) => {
                const move = getMove(moveId);
                const moveLabel = labels.moves[moveId];
                const uses = remainingUses(monster.moveUses, moveId);
                const max = maxUsesFor(moveId);
                const element = move.element ?? monster.element;
                return (
                  <div key={moveId} className="beast-path__party-detail-move">
                    <div className="beast-path__party-detail-move-top">
                      <p className="truncate text-xs font-semibold">
                        {moveLabel?.name ?? moveId}
                      </p>
                      <p className="shrink-0 text-[10px] text-[var(--bp-muted)]">
                        {labels.ui.partyDetailUses
                          .replace("{n}", String(uses))
                          .replace("{max}", String(max))}
                      </p>
                    </div>
                    <p className="mt-0.5 text-[10px] text-[var(--bp-muted)]">
                      <span style={{ color: elementColorOf(element) }}>
                        {element
                          ? labels.elements[element]
                          : labels.ui.elementNone}
                      </span>
                      {" · "}
                      {(() => {
                        const dmg = move.effects.find(
                          (e) => e.type === "damage" || e.type === "chain",
                        );
                        return moveIsOffensive(move)
                          ? `${labels.ui.atk} ${dmg?.power ?? "—"}`
                          : labels.ui.previewBuff;
                      })()}
                    </p>
                    {moveLabel?.description ? (
                      <p className="mt-1 text-[11px] leading-snug text-[var(--bp-muted)]">
                        {moveLabel.description}
                      </p>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PartyStrip({
  party,
  labels,
  gold,
  currentLevel,
  regionId,
  reserveCount = 0,
  itemCount = 0,
  relicCount = 0,
  onOpenReserve,
  onOpenBag,
}: {
  party: Monster[];
  labels: ReturnType<typeof getLabels>;
  gold: number;
  currentLevel: number;
  regionId: string;
  reserveCount?: number;
  itemCount?: number;
  relicCount?: number;
  onOpenReserve?: () => void;
  onOpenBag?: () => void;
}) {
  const [detailUid, setDetailUid] = useState<string | null>(null);
  const detail =
    detailUid == null
      ? null
      : (party.find((m) => m.uid === detailUid) ?? null);
  const regionName = labels.regions[regionId] ?? regionId;

  useEffect(() => {
    if (detailUid && !party.some((m) => m.uid === detailUid)) {
      setDetailUid(null);
    }
  }, [party, detailUid]);

  return (
    <>
      <div className="beast-path__party-panel beast-path__panel shrink-0 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--bp-moss)]">
              {labels.ui.party}
            </p>
            <p className="text-[11px] font-semibold text-[var(--bp-gold)]">
              {labels.ui.pathLabel
                .replace("{n}", String(currentLevel))
                .replace("{max}", String(MAX_RUN_LEVEL))}
            </p>
            <p className="text-[11px] text-[var(--bp-muted)]">
              {labels.ui.pathRegion.replace("{name}", regionName)}
            </p>
          </div>
          <div className="beast-path__party-tools">
            {onOpenReserve ? (
              <button
                type="button"
                className="beast-path__btn-ghost beast-path__party-tool-btn"
                onClick={onOpenReserve}
              >
                <Users size={16} strokeWidth={2} />
                {labels.ui.reserveOpen}
                {reserveCount > 0 ? ` (${reserveCount})` : ""}
              </button>
            ) : null}
            {onOpenBag ? (
              <button
                type="button"
                className="beast-path__btn-ghost beast-path__party-tool-btn"
                onClick={onOpenBag}
              >
                <Backpack size={16} strokeWidth={2} />
                {labels.ui.bag}
                {itemCount + relicCount > 0
                  ? ` (${itemCount}${relicCount ? `+${relicCount}` : ""})`
                  : ""}
              </button>
            ) : null}
            <p className="beast-path__title text-sm font-bold text-[var(--bp-gold)] sm:text-base">
              {labels.ui.gold}: {gold}
            </p>
          </div>
        </div>
        <div className="beast-path__party-grid mt-2.5">
          {party.length === 0 ? (
            <p className="text-sm text-[var(--bp-muted)]">—</p>
          ) : (
            party.map((m) => (
              <button
                key={m.uid}
                type="button"
                className="beast-path__party-card"
                onClick={() => setDetailUid(m.uid)}
                aria-label={`${labels.ui.partyDetail}: ${m.name}`}
              >
                <BeastPortrait
                  art={speciesThumbArt(SPECIES[m.speciesId])}
                  alt={m.name}
                  size={32}
                  className="beast-path__party-card-art"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold leading-tight sm:text-base">
                    {m.name}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] leading-tight text-[var(--bp-muted)]">
                    {labels.ui.level} {m.level} · {m.hp}/{m.maxHp}
                  </p>
                  <div className="mt-1 space-y-1">
                    <HpBar hp={m.hp} maxHp={m.maxHp} />
                    <XpBar
                      xp={m.xp}
                      level={m.level}
                      label={labels.ui.rewardXp}
                    />
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
      {detail ? (
        <PartyBeastDetail
          monster={detail}
          labels={labels}
          onClose={() => setDetailUid(null)}
        />
      ) : null}
    </>
  );
}

function MapNodeButton({
  tip,
  available,
  visited,
  current,
  Icon,
  style,
  onSelect,
}: {
  tip: string;
  available: boolean;
  visited: boolean;
  current: boolean;
  Icon: ComponentType<{ className?: string; size?: number; strokeWidth?: number }>;
  style: React.CSSProperties;
  onSelect: () => void;
}) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(
    null,
  );

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords({
      left: rect.left + rect.width / 2,
      top: rect.top - 8,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onMove = () => updatePosition();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open, updatePosition]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-disabled={!available}
        onClick={() => {
          if (!available) return;
          onSelect();
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-label={tip}
        className={[
          "beast-path__node",
          available
            ? "beast-path__node--available"
            : current
              ? "beast-path__node--current"
              : visited
                ? "beast-path__node--visited"
                : "beast-path__node--locked",
        ].join(" ")}
        style={style}
      >
        <span className="beast-path__node-art" aria-hidden />
        <span className="beast-path__node-icon">
          <Icon size={18} strokeWidth={2} />
        </span>
      </button>
      {open && coords && typeof document !== "undefined"
        ? createPortal(
            <span
              role="tooltip"
              className="beast-path__tooltip beast-path__tooltip--portal"
              style={{ left: coords.left, top: coords.top }}
            >
              {tip}
            </span>,
            document.body,
          )
        : null}
    </>
  );
}

function MapView({
  state,
  labels,
  onSelect,
}: {
  state: RunState;
  labels: ReturnType<typeof getLabels>;
  onSelect: (id: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const { positions, width, height } = useMemo(
    () => layoutMap(state.map.nodes),
    [state.map.nodes],
  );

  const edges = useMemo(() => {
    return state.map.nodes.flatMap((node) =>
      node.next.map((targetId) => ({ from: node.id, to: targetId })),
    );
  }, [state.map.nodes]);

  const updateScrollState = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  const centerOnCurrent = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      const el = scrollerRef.current;
      const pos = positions.get(state.currentNodeId);
      if (!el || !pos) return;
      const padLeft = Number.parseFloat(getComputedStyle(el).paddingLeft) || 0;
      const target = pos.x + padLeft - el.clientWidth / 2;
      const max = Math.max(0, el.scrollWidth - el.clientWidth);
      el.scrollTo({
        left: Math.max(0, Math.min(max, target)),
        behavior,
      });
      updateScrollState();
    },
    [positions, state.currentNodeId, updateScrollState],
  );

  useLayoutEffect(() => {
    centerOnCurrent("auto");
  }, [centerOnCurrent]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const ro = new ResizeObserver(() => {
      centerOnCurrent("auto");
      updateScrollState();
    });
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro.disconnect();
    };
  }, [updateScrollState, centerOnCurrent, width]);

  function scrollMap(direction: -1 | 1) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction * Math.min(280, el.clientWidth * 0.55),
      behavior: "smooth",
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="mb-2 shrink-0 text-xs text-[var(--bp-muted)]">
        {labels.ui.mapHint}
      </p>
      <div className="beast-path__map-wrap">
        <div className="beast-path__map-shell">
        <button
          type="button"
          className="beast-path__map-arrow beast-path__map-arrow--left"
          aria-label={labels.ui.scrollLeft}
          disabled={!canScrollLeft}
          onClick={() => scrollMap(-1)}
        >
          <span className="beast-path__map-arrow-icon" aria-hidden>
            <ChevronLeft size={22} strokeWidth={2.25} />
          </span>
        </button>
        <button
          type="button"
          className="beast-path__map-arrow beast-path__map-arrow--right"
          aria-label={labels.ui.scrollRight}
          disabled={!canScrollRight}
          onClick={() => scrollMap(1)}
        >
          <span className="beast-path__map-arrow-icon" aria-hidden>
            <ChevronRight size={22} strokeWidth={2.25} />
          </span>
        </button>
        <div ref={scrollerRef} className="beast-path__map-scroller">
          <div
            className="beast-path__map"
            style={{ width, height, minWidth: width }}
          >
            <svg
              className="beast-path__map-svg"
              viewBox={`0 0 ${width} ${height}`}
            >
              {edges.map(({ from, to }) => {
                const a = positions.get(from);
                const b = positions.get(to);
                if (!a || !b) return null;
                const midX = (a.x + b.x) / 2;
                const active =
                  state.available.includes(to) &&
                  (state.currentNodeId === from ||
                    state.visited.includes(from));
                const done =
                  state.visited.includes(from) && state.visited.includes(to);
                return (
                  <path
                    key={`${from}-${to}`}
                    d={`M ${a.x + NODE_R - 2} ${a.y} C ${midX} ${a.y}, ${midX} ${b.y}, ${b.x - NODE_R + 2} ${b.y}`}
                    className={[
                      "beast-path__path",
                      active ? "beast-path__path--active" : "",
                      done ? "beast-path__path--done" : "",
                    ].join(" ")}
                  />
                );
              })}
            </svg>

            {state.map.nodes.map((node) => {
              const pos = positions.get(node.id);
              if (!pos) return null;
              const tip =
                node.type === "habitat" && node.habitat
                  ? labels.habitats[node.habitat]
                  : labels.nodes[node.type];
              const Icon =
                node.type === "habitat" && node.habitat
                  ? HABITAT_ICONS[node.habitat]
                  : NODE_ICONS[node.type];
              return (
                <MapNodeButton
                  key={node.id}
                  tip={tip}
                  available={state.available.includes(node.id)}
                  visited={state.visited.includes(node.id)}
                  current={state.currentNodeId === node.id}
                  Icon={Icon}
                  style={{ left: pos.x, top: pos.y }}
                  onSelect={() => onSelect(node.id)}
                />
              );
            })}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

function EffectIconTip({
  effect,
  tip,
}: {
  effect: MovePreview;
  tip: string;
}) {
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(
    null,
  );
  const Icon = effectIcon(effect);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords({
      left: rect.left + rect.width / 2,
      top: rect.top,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  return (
    <>
      <span
        ref={triggerRef}
        role="button"
        tabIndex={0}
        aria-label={tip}
        className="inline-flex size-4 items-center justify-center border border-[color-mix(in_oklab,var(--bp-gold)_45%,transparent)] text-[var(--bp-gold)]"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen((v) => !v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.stopPropagation();
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
      >
        <Icon size={11} strokeWidth={2.25} />
      </span>
      {open && coords && typeof document !== "undefined"
        ? createPortal(
            <span
              role="tooltip"
              className="beast-path__effect-tip"
              style={{ left: coords.left, top: coords.top }}
            >
              {tip}
            </span>,
            document.body,
          )
        : null}
    </>
  );
}

function EffectIcons({ effects }: { effects: MovePreview[] }) {
  const status = statusEffects(effects);
  if (status.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {status.map((effect, idx) => (
        <EffectIconTip
          key={`${effect.kind}-${effect.text}-${idx}`}
          effect={effect}
          tip={effect.text}
        />
      ))}
    </div>
  );
}

function BattleView({
  state,
  labels,
  onPlan,
  onClearPlan,
  onSkip,
  onArmCapture,
  onOpenBag,
  onFightComplete,
  onClaim,
}: {
  state: RunState;
  labels: ReturnType<typeof getLabels>;
  onPlan: (actorId: string, moveId: MoveId, targetId: string | null) => void;
  onClearPlan: (actorId: string) => void;
  onSkip: (actorId: string) => void;
  onArmCapture: (enabled: boolean) => void;
  onOpenBag: () => void;
  onFightComplete: (
    battle: BattleState,
    consumedItemSlot?: number,
  ) => void;
  onClaim: () => void;
}) {
  const liveBattle = state.battle!;
  const [playback, setPlayback] = useState<{
    battle: BattleState;
    actorId: string | null;
    floaters: Floater[];
    hitIds: string[];
    striking: boolean;
  } | null>(null);
  const playGen = useRef(0);
  const [focusActor, setFocusActor] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<MoveId | null>(null);
  const [fightWarnOpen, setFightWarnOpen] = useState(false);
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const frozenLinksRef = useRef(
    new Map<string, { d: string; color: string; bend: number }>(),
  );
  const [links, setLinks] = useState<
    { key: string; d: string; color: string; active?: boolean }[]
  >([]);

  // Always focus the first living party beast when a battle starts / resumes planning.
  const battleKey = `${liveBattle.enemies.map((e) => e.uid).join("|")}:${liveBattle.player.map((p) => p.uid).join("|")}`;
  useEffect(() => {
    const firstLiving =
      liveBattle.player.find((m) => m.hp > 0) ?? liveBattle.player[0] ?? null;
    setFocusActor(firstLiving?.uid ?? null);
    setPendingMove(null);
    frozenLinksRef.current.clear();
  }, [battleKey]); // eslint-disable-line react-hooks/exhaustive-deps -- intentionally key on roster identity

  const battle = playback?.battle ?? liveBattle;
  const resolving = playback != null || battle.phase === "resolving";

  const order = useMemo(
    () => previewTurnOrder(battle.player, battle.enemies),
    [battle.player, battle.enemies],
  );

  const combatantsById = useMemo(() => {
    const map = new Map<string, (typeof battle.player)[number]>();
    for (const m of [...battle.player, ...battle.enemies]) map.set(m.uid, m);
    return map;
  }, [battle.player, battle.enemies]);

  const partyColorById = useMemo(() => {
    const map = new Map<string, string>();
    battle.player.forEach((m, idx) => {
      map.set(m.uid, PARTY_COLORS[idx % PARTY_COLORS.length]);
    });
    return map;
  }, [battle.player]);

  const planning = battle.phase === "planning" && !playback;
  const fightable = canStartFight(liveBattle) && !playback;
  const plansReady = allPlansReady(liveBattle);
  const captureArmed = liveBattle.captureAttempt;
  const isWild = liveBattle.battleKind === "wild";
  const inspected =
    focusActor != null ? (combatantsById.get(focusActor) ?? null) : null;
  const focus =
    !captureArmed &&
    inspected &&
    inspected.side === "player" &&
    inspected.hp > 0
      ? inspected
      : null;

  const validTargets =
    focus && pendingMove && planning
      ? validTargetsForMove(battle, focus.uid, pendingMove)
      : [];

  const lockedTargetIds = useMemo(() => {
    const ids = new Set<string>();
    for (const plan of Object.values(battle.plans)) {
      if (plan.moveId && plan.targetId) ids.add(plan.targetId);
    }
    for (const plan of Object.values(battle.enemyPlans)) {
      if (plan.moveId && plan.targetId) ids.add(plan.targetId);
    }
    return ids;
  }, [battle.plans, battle.enemyPlans]);

  const floaterByTarget = useMemo(() => {
    const map = new Map<string, Floater[]>();
    for (const floater of playback?.floaters ?? []) {
      const list = map.get(floater.targetId) ?? [];
      list.push(floater);
      map.set(floater.targetId, list);
    }
    return map;
  }, [playback?.floaters]);

  const updateLinks = useCallback(
    (opts?: { reflow?: boolean }) => {
      const field = fieldRef.current;
      if (!field) {
        setLinks([]);
        return;
      }
      const reflow = opts?.reflow === true;
      const fieldRect = field.getBoundingClientRect();
      const next: { key: string; d: string; color: string; active?: boolean }[] =
        [];
      const plans = [
        ...Object.values(liveBattle.plans),
        ...Object.values(liveBattle.enemyPlans),
      ];
      const seen = new Set<string>();

      plans.forEach((plan) => {
        if (!plan.moveId || !plan.targetId || plan.actorId === plan.targetId) {
          return;
        }
        const actor = combatantsById.get(plan.actorId);
        const target = combatantsById.get(plan.targetId);
        if (!actor || !target) return;

        const key = `${plan.actorId}-${plan.targetId}-${plan.moveId}`;
        seen.add(key);

        const frozen = frozenLinksRef.current.get(key);
        if (frozen && !reflow) {
          next.push({
            key,
            d: frozen.d,
            color: frozen.color,
            active: playback?.actorId === plan.actorId,
          });
          return;
        }

        // Only place new arrows while both ends are still up.
        if (actor.hp <= 0 || target.hp <= 0) return;
        const fromEl = cardRefs.current.get(plan.actorId);
        const toEl = cardRefs.current.get(plan.targetId);
        if (!fromEl || !toEl) return;
        const a = fromEl.getBoundingClientRect();
        const b = toEl.getBoundingClientRect();
        const aLeft = a.left - fieldRect.left;
        const aTop = a.top - fieldRect.top;
        const bLeft = b.left - fieldRect.left;
        const bTop = b.top - fieldRect.top;
        const aCx = aLeft + a.width / 2;
        const aCy = aTop + a.height / 2;
        const bCx = bLeft + b.width / 2;
        const bCy = bTop + b.height / 2;
        const start = edgePoint(aLeft, aTop, a.width, a.height, bCx, bCy);
        const end = edgePoint(bLeft, bTop, b.width, b.height, aCx, aCy);
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const len = Math.hypot(dx, dy) || 1;
        const pull = Math.min(6, len * 0.08);
        const x2 = end.x - (dx / len) * pull;
        const y2 = end.y - (dy / len) * pull;
        // Stable bend from actor id — never reshuffles when other plans appear.
        let hash = 0;
        for (let i = 0; i < plan.actorId.length; i += 1) {
          hash = (hash * 31 + plan.actorId.charCodeAt(i)) | 0;
        }
        const bend =
          ((hash & 1) === 0 ? 1 : -1) * (16 + (Math.abs(hash) % 5) * 7);
        const color =
          actor.side === "player"
            ? (partyColorById.get(actor.uid) ?? elementColorOf(actor.element))
            : (partyColorById.get(target.uid) ?? elementColorOf(target.element));
        const d = curvedLinkPath(start.x, start.y, x2, y2, bend);
        frozenLinksRef.current.set(key, { d, color, bend });
        next.push({
          key,
          d,
          color,
          active: playback?.actorId === plan.actorId,
        });
      });

      for (const key of [...frozenLinksRef.current.keys()]) {
        if (!seen.has(key)) frozenLinksRef.current.delete(key);
      }
      setLinks(next);
    },
    [
      combatantsById,
      liveBattle.enemyPlans,
      liveBattle.plans,
      partyColorById,
      playback?.actorId,
    ],
  );

  useLayoutEffect(() => {
    updateLinks();
  }, [updateLinks]);

  useEffect(() => {
    const field = fieldRef.current;
    const onResize = () => updateLinks({ reflow: true });
    window.addEventListener("resize", onResize);
    document.addEventListener("fullscreenchange", onResize);
    const ro =
      field && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            updateLinks({ reflow: true });
          })
        : null;
    if (field && ro) ro.observe(field);
    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("fullscreenchange", onResize);
      ro?.disconnect();
    };
  }, [updateLinks]);

  useEffect(() => {
    return () => {
      playGen.current += 1;
    };
  }, []);

  function setCardRef(uid: string, el: HTMLElement | null) {
    if (el) cardRefs.current.set(uid, el);
    else cardRefs.current.delete(uid);
  }

  function selectMove(moveId: MoveId) {
    if (!focus || !planning) return;
    if (remainingUses(focus.moveUses, moveId) <= 0) return;
    const targets = validTargetsForMove(battle, focus.uid, moveId);
    if (targets.length === 0) return;

    // Self-buffs / guard: lock in immediately, no target pick.
    if (!moveRequiresTargetChoice(moveId)) {
      setPendingMove(null);
      onPlan(focus.uid, moveId, focus.uid);
      return;
    }

    if (pendingMove === moveId) {
      setPendingMove(null);
      return;
    }

    // Drop the previous plan so previews don't stack old + pending.
    onClearPlan(focus.uid);
    setPendingMove(moveId);
  }

  function selectTarget(targetId: string) {
    if (!focus || !pendingMove || !planning) return;
    if (!validTargets.some((t) => t.uid === targetId)) return;
    onPlan(focus.uid, pendingMove, targetId);
    setPendingMove(null);
  }

  function selectSkip() {
    if (!focus || !planning) return;
    setPendingMove(null);
    onSkip(focus.uid);
  }

  async function playFight() {
    if (!fightable || playback) return;
    setFightWarnOpen(false);
    const timeline = buildFightTimeline(
      liveBattle,
      labels,
      getFightSeed(state),
    );
    if (!timeline) return;

    const gen = ++playGen.current;
    setFocusActor(null);
    setPendingMove(null);
    setPlayback({
      battle: {
        ...liveBattle,
        phase: "resolving",
        player: liveBattle.player.map((m) => ({ ...m, tempDefBonus: 0 })),
        enemies: liveBattle.enemies.map((m) => ({ ...m, tempDefBonus: 0 })),
      },
      actorId: null,
      floaters: [],
      hitIds: [],
      striking: false,
    });

    for (let i = 0; i < timeline.steps.length; i += 1) {
      if (playGen.current !== gen) return;
      const step = timeline.steps[i]!;
      const floaters = floatersFromFx(step.fx, `s${i}`);
      const hitIds = floaters
        .filter((f) => f.tone === "damage")
        .map((f) => f.targetId);
      const striking = step.fx.some(
        (f) =>
          f.kind === "damage" ||
          f.kind === "heal" ||
          f.kind === "buff" ||
          f.kind === "guard" ||
          f.kind === "act",
      );

      // Wind-up: keep this action's preview on the HP bar.
      setPlayback({
        battle: step.before,
        actorId: step.actorId,
        floaters: [],
        hitIds: [],
        striking: true,
      });
      await sleep(320);

      if (playGen.current !== gen) return;
      // Impact: apply damage/heal and drop this plan from remaining previews.
      setPlayback({
        battle: step.battle,
        actorId: step.actorId,
        floaters,
        hitIds,
        striking,
      });
      await sleep(520);
    }

    if (playGen.current !== gen) return;
    onFightComplete(timeline.final, timeline.consumedItemSlot);
    setPlayback(null);
    const firstLiving =
      timeline.final.player.find((m) => m.hp > 0) ??
      timeline.final.player[0] ??
      null;
    setFocusActor(firstLiving?.uid ?? null);
  }

  function requestFight() {
    if (!fightable || playback) return;
    if (!plansReady && !captureArmed) {
      setFightWarnOpen(true);
      return;
    }
    void playFight();
  }

  // Previews only for confirmed plans — never while still picking a target.
  // Keep planned HP/effect previews visible while the round resolves.
  function effectsFor(uid: string): MovePreview[] {
    return plannedEffectsOn(battle, uid, labels);
  }

  function renderFloaters(uid: string) {
    const items = floaterByTarget.get(uid);
    if (!items?.length) return null;
    return items.map((floater) => (
      <span
        key={floater.key}
        className={[
          "beast-path__floater",
          `beast-path__floater--${floater.tone}`,
        ].join(" ")}
      >
        {floater.text}
      </span>
    ));
  }

  return (
    <div className="beast-path__battle">
      <div className="beast-path__battle-main">
        <h2 className="beast-path__title shrink-0 text-base font-bold">
          {isWild && liveBattle.habitat
            ? labels.habitats[liveBattle.habitat]
            : labels.ui.fight}
        </h2>
        <p className="mt-0.5 shrink-0 text-[10px] text-[var(--bp-muted)]">
          {battle.phase === "won"
            ? labels.ui.victoryBattle
            : battle.phase === "lost"
              ? labels.ui.defeatBattle
                : resolving
                ? labels.ui.resolving
                : captureArmed
                  ? labels.ui.captureArmed
                  : pendingMove
                    ? labels.ui.chooseTarget
                    : plansReady
                      ? labels.ui.yourTurn
                      : labels.ui.needPlans}
        </p>

        <div ref={fieldRef} className="relative mt-2 min-h-0 flex-1">
          <svg
            className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible"
            aria-hidden
          >
            <defs>
              {links.map((link) => (
                <marker
                  key={`marker-${link.key}`}
                  id={`bp-arrow-${link.key}`}
                  markerWidth="8"
                  markerHeight="8"
                  refX="6"
                  refY="3"
                  orient="auto"
                >
                  <path d="M0,0 L6,3 L0,6 Z" fill={link.color} />
                </marker>
              ))}
            </defs>
            {links.map((link) => (
              <path
                key={link.key}
                d={link.d}
                fill="none"
                stroke={link.color}
                strokeWidth={link.active ? 2.75 : 2}
                strokeOpacity={link.active ? 1 : resolving ? 0.35 : 0.9}
                markerEnd={`url(#bp-arrow-${link.key})`}
              />
            ))}
          </svg>

          <div className="beast-path__field relative z-[1]">
            <div className="beast-path__field-party">
              <p className="mb-1 shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--bp-moss)]">
                {labels.ui.party}
              </p>
              <div className="beast-path__field-stack">
                {battle.player.map((m, idx) => {
                  const plan = battle.plans[m.uid];
                  const isCandidate =
                    pendingMove != null &&
                    validTargets.some((t) => t.uid === m.uid);
                  const isLockedTarget = lockedTargetIds.has(m.uid);
                  const effects = effectsFor(m.uid);
                  const { damage, heal } = hpPreviewFromEffects(effects);
                  const allyColor =
                    partyColorById.get(m.uid) ??
                    PARTY_COLORS[idx % PARTY_COLORS.length];
                  const isActing =
                    m.hp > 0 && playback?.actorId === m.uid;
                  const isStriking =
                    isActing && playback.striking;
                  return (
                    <button
                      key={m.uid}
                      type="button"
                      ref={(el) => setCardRef(m.uid, el)}
                      disabled={!planning}
                      onClick={() => {
                        if (isCandidate) {
                          selectTarget(m.uid);
                          return;
                        }
                        setFocusActor(m.uid);
                        setPendingMove(null);
                      }}
                      style={
                        {
                          "--bp-card-border": allyColor,
                        } as CSSProperties
                      }
                      className={[
                        "beast-path__panel beast-path__combatant beast-path__combatant--party",
                        inspected?.uid === m.uid &&
                        !isCandidate &&
                        !isLockedTarget
                          ? "beast-path__combatant--focus"
                          : "",
                        isCandidate ? "beast-path__combatant--candidate" : "",
                        isLockedTarget && !isCandidate
                          ? "beast-path__combatant--locked"
                          : "",
                        isActing ? "beast-path__combatant--acting" : "",
                        isStriking
                          ? "beast-path__combatant--strike-ally"
                          : "",
                        m.hp > 0 && playback?.hitIds.includes(m.uid)
                          ? "beast-path__combatant--hit"
                          : "",
                        m.hp <= 0 ? "opacity-40" : "cursor-pointer",
                      ].join(" ")}
                    >
                      {renderFloaters(m.uid)}
                      <span className="beast-path__combatant-thumb">
                        <BeastPortrait
                          art={speciesThumbArt(SPECIES[m.speciesId])}
                          alt={m.name}
                          variant="thumb"
                          fill
                        />
                      </span>
                      <div className="beast-path__combatant-body">
                        <div className="flex items-start justify-between gap-1">
                          <p className="beast-path__combatant-name">
                            {m.name}
                          </p>
                          <span className="beast-path__combatant-status shrink-0">
                            {plan
                              ? plan.moveId === null
                                ? labels.ui.skipped
                                : labels.ui.planned
                              : "\u00a0"}
                          </span>
                        </div>
                        <p className="beast-path__combatant-meta">
                          {labels.ui.level} {m.level} · {m.hp}/{m.maxHp}
                          {damage > 0 ? (
                            <span className="text-[var(--bp-ember)]">
                              {" "}
                              (−{damage})
                            </span>
                          ) : null}
                          {heal > 0 ? (
                            <span className="text-[var(--bp-moss)]">
                              {" "}
                              (+{heal})
                            </span>
                          ) : null}
                        </p>
                        <HpBar
                          hp={m.hp}
                          maxHp={m.maxHp}
                          damage={damage}
                          heal={heal}
                        />
                        <XpBar
                          xp={m.xp}
                          level={m.level}
                          label={labels.ui.rewardXp}
                        />
                        <div className="flex items-center justify-between gap-1">
                          <p className="beast-path__combatant-move">
                            {plan?.moveId
                              ? labels.moves[plan.moveId].name
                              : plan?.moveId === null
                                ? labels.ui.skipped
                                : "\u00a0"}
                          </p>
                          <div className="beast-path__combatant-effects">
                            <EffectIcons effects={effects} />
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="beast-path__field-enemies">
              <p className="mb-1 shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--bp-ember)]">
                {labels.nodes.battle}
              </p>
              <div className="beast-path__field-stack">
                {battle.enemies.map((m) => {
                  const enemyPlan = battle.enemyPlans[m.uid];
                  const isCandidate =
                    pendingMove != null &&
                    validTargets.some((t) => t.uid === m.uid);
                  const isLockedTarget = lockedTargetIds.has(m.uid);
                  const effects = effectsFor(m.uid);
                  const { damage, heal } = hpPreviewFromEffects(effects);
                  const isActing =
                    m.hp > 0 && playback?.actorId === m.uid;
                  const isStriking =
                    isActing && playback.striking;
                  return (
                    <button
                      key={m.uid}
                      type="button"
                      ref={(el) => setCardRef(m.uid, el)}
                      disabled={!planning}
                      onClick={() => {
                        if (isCandidate) {
                          selectTarget(m.uid);
                          return;
                        }
                        setFocusActor(m.uid);
                        setPendingMove(null);
                      }}
                      style={
                        {
                          "--bp-card-border": "var(--bp-ember)",
                        } as CSSProperties
                      }
                      className={[
                        "beast-path__panel beast-path__combatant",
                        m.hp <= 0 ? "opacity-40" : "cursor-pointer",
                        inspected?.uid === m.uid &&
                        !isCandidate &&
                        !isLockedTarget
                          ? "beast-path__combatant--focus"
                          : "",
                        isCandidate ? "beast-path__combatant--candidate" : "",
                        isLockedTarget && !isCandidate
                          ? "beast-path__combatant--locked"
                          : "",
                        isActing ? "beast-path__combatant--acting" : "",
                        isStriking
                          ? "beast-path__combatant--strike-enemy"
                          : "",
                        m.hp > 0 && playback?.hitIds.includes(m.uid)
                          ? "beast-path__combatant--hit"
                          : "",
                      ].join(" ")}
                    >
                      {renderFloaters(m.uid)}
                      <span className="beast-path__combatant-thumb">
                        <BeastPortrait
                          art={speciesThumbArt(SPECIES[m.speciesId])}
                          alt={m.name}
                          variant="thumb"
                          fill
                        />
                      </span>
                      <div className="beast-path__combatant-body">
                        <div className="flex items-start justify-between gap-1">
                          <p className="beast-path__combatant-name">
                            {m.name}
                          </p>
                          <span className="beast-path__combatant-status shrink-0">
                            {"\u00a0"}
                          </span>
                        </div>
                        <p className="beast-path__combatant-meta">
                          {labels.ui.level} {m.level} · {m.hp}/{m.maxHp}
                          {damage > 0 ? (
                            <span className="text-[var(--bp-ember)]">
                              {" "}
                              (−{damage})
                            </span>
                          ) : null}
                          {heal > 0 ? (
                            <span className="text-[var(--bp-moss)]">
                              {" "}
                              (+{heal})
                            </span>
                          ) : null}
                        </p>
                        <HpBar
                          hp={m.hp}
                          maxHp={m.maxHp}
                          damage={damage}
                          heal={heal}
                        />
                        <div className="flex items-center justify-between gap-1">
                          <p className="beast-path__combatant-move">
                            {enemyPlan?.moveId
                              ? labels.moves[enemyPlan.moveId].name
                              : "\u00a0"}
                          </p>
                          <div className="beast-path__combatant-effects">
                            <EffectIcons effects={effects} />
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {planning || playback ? (
          <div className="beast-path__actions-dock">
            <div className="beast-path__dock-row">
              <div className="beast-path__panel beast-path__inspect p-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--bp-muted)]">
                  {labels.ui.statsPanel}
                </p>
                {inspected ? (
                  <>
                    <div className="beast-path__inspect-head">
                      <div className="beast-path__inspect-art">
                        <BeastPortrait
                          art={speciesThumbArt(SPECIES[inspected.speciesId])}
                          alt={inspected.name}
                          variant="thumb"
                          fill
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold leading-tight">
                          {inspected.name}
                        </p>
                        <p className="mt-0.5 truncate text-[10px] text-[var(--bp-muted)]">
                          {labels.ui.level} {inspected.level} ·{" "}
                          <span
                            style={{ color: elementColorOf(inspected.element) }}
                          >
                            {inspected.element
                              ? labels.elements[inspected.element]
                              : labels.ui.elementNone}
                          </span>
                          {" · "}
                          {inspected.hp}/{inspected.maxHp}
                        </p>
                      </div>
                    </div>
                    <dl className="beast-path__inspect-stats">
                      <div>
                        <dt>{labels.ui.atk}</dt>
                        <dd>{inspected.atk}</dd>
                      </div>
                      <div>
                        <dt>{labels.ui.def}</dt>
                        <dd>
                          {inspected.def}
                          {(inspected.tempDefBonus ?? 0) > 0
                            ? `+${inspected.tempDefBonus}`
                            : ""}
                        </dd>
                      </div>
                      <div>
                        <dt>{labels.ui.spd}</dt>
                        <dd>{inspected.spd}</dd>
                      </div>
                    </dl>
                    {inspected.side === "player" ? (
                      <div className="mt-1.5 space-y-1">
                        <HpBar hp={inspected.hp} maxHp={inspected.maxHp} />
                        <XpBar
                          xp={inspected.xp}
                          level={inspected.level}
                          label={labels.ui.rewardXp}
                        />
                      </div>
                    ) : (
                      <div className="mt-1.5">
                        <HpBar hp={inspected.hp} maxHp={inspected.maxHp} />
                      </div>
                    )}
                  </>
                ) : (
                  <p className="beast-path__panel-empty mt-3">
                    {labels.ui.statsEmpty}
                  </p>
                )}
              </div>

              <div className="beast-path__panel beast-path__moves p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--bp-gold)]">
                      {labels.ui.movesPanel}
                    </p>
                    <p className="truncate text-[11px] text-[var(--bp-muted)]">
                      {focus
                        ? labels.ui.chooseMove
                        : captureArmed
                          ? labels.ui.captureHint
                          : labels.ui.movesEmpty}
                    </p>
                  </div>
                  {focus ? (
                    <button
                      type="button"
                      className={[
                        "shrink-0 border px-3 py-1.5 text-xs font-bold uppercase tracking-wide",
                        battle.plans[focus.uid]?.moveId === null
                          ? "border-[var(--bp-gold)] text-[var(--bp-gold)]"
                          : "border-[var(--bp-line)] text-[var(--bp-muted)] hover:border-[var(--bp-gold)]",
                      ].join(" ")}
                      onClick={selectSkip}
                    >
                      {labels.ui.skipMove}
                    </button>
                  ) : null}
                </div>
                {focus ? (
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    {Array.from({ length: MAX_MOVES }, (_, slot) => {
                      const moveId = focus.moves[slot] ?? null;
                      if (!moveId) {
                        return (
                          <div
                            key={`empty-${slot}`}
                            className="beast-path__move-slot beast-path__move-slot--empty"
                            aria-hidden
                          >
                            {labels.ui.emptyMove}
                          </div>
                        );
                      }
                      const move = getMove(moveId);
                      const moveSelected =
                        battle.plans[focus.uid]?.moveId === moveId;
                      const pending = pendingMove === moveId;
                      const uses = remainingUses(focus.moveUses, moveId);
                      const max = maxUsesFor(moveId);
                      const exhausted = uses <= 0;
                      const hasTargets =
                        validTargetsForMove(battle, focus.uid, moveId)
                          .length > 0;
                      const plannedTarget =
                        battle.plans[focus.uid]?.moveId === moveId
                          ? battle.plans[focus.uid]?.targetId
                          : null;
                      const impact = exhausted
                        ? null
                        : moveImpactHint(
                            battle,
                            focus.uid,
                            moveId,
                            labels,
                            plannedTarget,
                          );
                      const impactTone = moveIsOffensive(move)
                        ? "damage"
                        : move.effects.some((e) => e.type === "heal")
                          ? "heal"
                          : "buff";
                      return (
                        <button
                          key={moveId}
                          type="button"
                          disabled={exhausted || !hasTargets || captureArmed}
                          className={[
                            "beast-path__move-slot disabled:cursor-not-allowed disabled:opacity-40",
                            moveSelected || pending
                              ? "border-[var(--bp-ember)] bg-[color-mix(in_oklab,var(--bp-ember)_12%,transparent)]"
                              : "",
                          ].join(" ")}
                          onClick={() => selectMove(moveId)}
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <p className="text-[13px] font-semibold leading-tight">
                              {labels.moves[moveId].name}
                            </p>
                            <span
                              className={[
                                "shrink-0 text-[9px] font-bold tabular-nums",
                                exhausted
                                  ? "text-[var(--bp-ember)]"
                                  : "text-[var(--bp-muted)]",
                              ].join(" ")}
                            >
                              {uses}/{max}
                            </span>
                          </div>
                          {exhausted ? (
                            <p className="mt-0.5 text-[9px] font-semibold text-[var(--bp-ember)]">
                              {labels.ui.noUses}
                            </p>
                          ) : impact ? (
                            <p
                              className={[
                                "beast-path__move-impact",
                                impactTone === "heal"
                                  ? "beast-path__move-impact--heal"
                                  : impactTone === "buff"
                                    ? "beast-path__move-impact--buff"
                                    : "",
                              ].join(" ")}
                            >
                              {impact}
                            </p>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="beast-path__moves-grid-placeholder mt-1.5">
                    {Array.from({ length: MAX_MOVES }, (_, slot) => (
                      <div
                        key={`ph-${slot}`}
                        className="beast-path__move-slot beast-path__move-slot--empty"
                        aria-hidden
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="beast-path__panel beast-path__battle-actions p-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--bp-muted)]">
                  {labels.ui.actionsPanel}
                </p>
                <div className="beast-path__battle-actions-list mt-1.5">
                  <button
                    type="button"
                    disabled={!planning}
                    className="beast-path__capture-btn beast-path__bag-btn"
                    onClick={() => onOpenBag()}
                  >
                    <Backpack size={22} strokeWidth={2} />
                    {labels.ui.battleBag}
                  </button>
                  <button
                    type="button"
                    disabled={!isWild || !planning}
                    className={[
                      "beast-path__capture-btn",
                      captureArmed ? "beast-path__capture-btn--armed" : "",
                    ].join(" ")}
                    onClick={() => {
                      setFocusActor(null);
                      setPendingMove(null);
                      onArmCapture(!captureArmed);
                    }}
                  >
                    {labels.ui.captureAction}
                  </button>
                  {captureArmed && planning ? (
                    <p className="beast-path__capture-hint">
                      {labels.ui.captureHint}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {battle.phase === "won" && !playback ? (
          <div className="beast-path__victory p-3 text-center">
            <p className="text-sm font-semibold">{labels.ui.victoryBattle}</p>
            {battle.capturedMonster ? (
              <div className="beast-path__capture-art mx-auto mt-3">
                <BeastPortrait
                  art={speciesFullArt(
                    SPECIES[battle.capturedMonster.speciesId],
                  )}
                  alt={battle.capturedMonster.name}
                  variant="full"
                  fill
                />
                <p className="mt-2 text-xs font-semibold">
                  {battle.capturedMonster.name}
                </p>
                <p className="text-[10px] text-[var(--bp-muted)]">
                  {labels.ui.captureSuccess}
                </p>
              </div>
            ) : null}
            <div className="mt-3 flex justify-center">
              <button
                type="button"
                className="beast-path__btn px-3 py-1.5 text-xs"
                onClick={() => onClaim()}
              >
                {labels.ui.claimRewards}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <aside className="beast-path__battle-side">
        <p className="beast-path__title shrink-0 text-sm font-bold text-[var(--bp-gold)]">
          {labels.ui.gold}: {state.gold}
        </p>
        {planning || playback ? (
          <button
            type="button"
            disabled={!fightable || Boolean(playback)}
            className="beast-path__btn w-full px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
            onClick={requestFight}
          >
            {playback ? labels.ui.resolving : labels.ui.fightRound}
          </button>
        ) : null}

        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--bp-muted)]">
            {labels.ui.turnOrder}
          </p>
          <ol className="beast-path__turn-order">
            {order.map((uid, idx) => {
              const m = combatantsById.get(uid);
              if (!m) return null;
              const accent =
                m.side === "player"
                  ? (partyColorById.get(m.uid) ??
                    PARTY_COLORS[0])
                  : "var(--bp-ember)";
              return (
                <li
                  key={uid}
                  style={
                    {
                      color: accent,
                      borderColor: `color-mix(in oklab, ${accent} 45%, transparent)`,
                    } as CSSProperties
                  }
                >
                  {idx + 1}. {m.name}
                  <span className="mt-0.5 block opacity-70">
                    {labels.ui.spd} {m.spd}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="beast-path__panel beast-path__log p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--bp-muted)]">
            Log
          </p>
          <ul className="mt-1.5 space-y-1 text-[var(--bp-muted)]">
            {battle.log.map((entry) => (
              <li key={entry.id}>{entry.text}</li>
            ))}
          </ul>
        </div>
      </aside>

      {fightWarnOpen ? (
        <div
          className="beast-path__modal-backdrop"
          role="presentation"
          onClick={() => setFightWarnOpen(false)}
        >
          <div
            className="beast-path__modal beast-path__modal--sm"
            role="dialog"
            aria-modal="true"
            aria-label={labels.ui.fightWarnTitle}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="shrink-0 text-sm font-semibold">
              {labels.ui.fightWarnTitle}
            </p>
            <div className="beast-path__modal-body flex flex-col">
              <p className="text-xs leading-relaxed text-[var(--bp-muted)]">
                {labels.ui.fightWarnBody}
              </p>
              <div className="mt-auto flex flex-wrap justify-end gap-2 pt-3">
                <button
                  type="button"
                  className="beast-path__btn-ghost px-3 py-1.5 text-xs"
                  onClick={() => setFightWarnOpen(false)}
                >
                  {labels.ui.fightWarnCancel}
                </button>
                <button
                  type="button"
                  className="beast-path__btn px-3 py-1.5 text-xs"
                  onClick={() => {
                    void playFight();
                  }}
                >
                  {labels.ui.fightWarnConfirm}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function BeastPathGame() {
  const { locale } = useLanguage();
  const [contentEpoch, setContentEpoch] = useState(0);
  const labels = useMemo(() => getLabels(locale), [locale, contentEpoch]);
  const [state, setState] = useState<RunState>(() => createMenuState());
  const [starters, setStarters] = useState(() => getStarters(locale));
  const [hasSave, setHasSave] = useState(false);
  const [overwriteOpen, setOverwriteOpen] = useState(false);
  const [gameMenuOpen, setGameMenuOpen] = useState(false);
  const [bagOpen, setBagOpen] = useState(false);
  const [bagFocusSlot, setBagFocusSlot] = useState<number | null>(null);
  const [bagHoverSlot, setBagHoverSlot] = useState<number | null>(null);
  const [contentDevOpen, setContentDevOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);
  const showContentDev = isBeastPathDev();
  const [reserveOpen, setReserveOpen] = useState(false);
  const [reserveSwapParty, setReserveSwapParty] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await syncPublishedContent();
      if (cancelled) return;
      setStarters(getStarters(locale));
      setContentEpoch((n) => n + 1);
    })();
    return () => {
      cancelled = true;
    };
    // locale is read once on mount so stored author packs apply before first menu paint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setHasSave(hasSavedRun());
  }, []);

  useEffect(() => {
    setCanFullscreen(
      typeof document !== "undefined" &&
        typeof document.documentElement.requestFullscreen === "function",
    );
    const onChange = () => {
      setIsFullscreen(document.fullscreenElement === stageRef.current);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const commit = useCallback((next: RunState) => {
    syncRunPersistence(next);
    setState(next);
  }, []);

  const commitUpdate = useCallback(
    (updater: (prev: RunState) => RunState) => {
      setState((prev) => {
        const next = updater(prev);
        syncRunPersistence(next);
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    if (state.screen.kind === "map" && state.party.length > 0) {
      setHasSave(true);
    } else if (
      state.screen.kind === "victory" ||
      state.screen.kind === "defeat"
    ) {
      setHasSave(false);
    }
  }, [state.screen.kind, state.party.length]);

  async function toggleFullscreen() {
    const el = stageRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement === el) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch {
      // Browser may reject without a user gesture or if unsupported.
    }
  }

  function resetUiFlags() {
    setSellOpen(false);
    setReserveOpen(false);
    setReserveSwapParty(null);
    setOverwriteOpen(false);
    setGameMenuOpen(false);
    setBagOpen(false);
    setBagFocusSlot(null);
    setBagHoverSlot(null);
    setContentDevOpen(false);
  }

  function goToMenu() {
    resetUiFlags();
    setHasSave(hasSavedRun());
    setState(createMenuState());
  }

  /** Leave to main menu without wiping the save. */
  function returnToMainMenu() {
    if (state.screen.kind === "map" && state.party.length > 0) {
      syncRunPersistence(state);
    }
    resetUiFlags();
    setHasSave(hasSavedRun());
    setState(createMenuState());
  }

  function abandonRun() {
    clearSavedRun();
    setHasSave(false);
    goToMenu();
  }

  function startNewRun() {
    clearSavedRun();
    setHasSave(false);
    resetUiFlags();
    setStarters(getStarters(locale));
    setState(createRun(locale));
  }

  function requestNewRun() {
    if (hasSave) {
      setOverwriteOpen(true);
      return;
    }
    startNewRun();
  }

  function continueRun() {
    const saved = readSavedRun();
    if (!saved) {
      setHasSave(false);
      return;
    }
    resetUiFlags();
    setHasSave(true);
    setState(hydrateRun(saved));
  }

  return (
    <GameChrome
      eyebrow={labels.ui.eyebrow}
      title={labels.ui.title}
      lead={labels.ui.lead}
      wide
      compact
    >
      <div
        ref={stageRef}
        className={[
          `${oxanium.variable} beast-path p-4 sm:p-5`,
          isFullscreen ? "beast-path--fullscreen" : "",
        ].join(" ")}
      >
        <div
          className={[
            "beast-path__chrome-bar",
            state.screen.kind === "menu" ? "beast-path__chrome-bar--end" : "",
          ].join(" ")}
        >
          {state.screen.kind !== "menu" ? (
            <button
              type="button"
              className="beast-path__chrome-btn"
              onClick={() => setGameMenuOpen(true)}
              aria-label={labels.ui.gameMenu}
              title={labels.ui.gameMenu}
            >
              <Menu size={15} strokeWidth={2} />
            </button>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            {showContentDev && state.screen.kind === "menu" ? (
              <button
                type="button"
                className="beast-path__chrome-btn"
                onClick={() => setContentDevOpen((open) => !open)}
                aria-label={labels.ui.contentDev}
                title={labels.ui.contentDev}
              >
                <Wrench size={15} strokeWidth={2} />
              </button>
            ) : null}
            {canFullscreen ? (
              <button
                type="button"
                className="beast-path__chrome-btn"
                onClick={() => {
                  void toggleFullscreen();
                }}
                aria-label={
                  isFullscreen
                    ? labels.ui.fullscreenExit
                    : labels.ui.fullscreenEnter
                }
                title={
                  isFullscreen
                    ? labels.ui.fullscreenExit
                    : labels.ui.fullscreenEnter
                }
              >
                {isFullscreen ? (
                  <Minimize2 size={15} strokeWidth={2} />
                ) : (
                  <Maximize2 size={15} strokeWidth={2} />
                )}
              </button>
            ) : null}
          </div>
        </div>
        {state.screen.kind !== "battle" && state.screen.kind !== "menu" ? (
          <PartyStrip
            party={state.party}
            labels={labels}
            gold={state.gold}
            currentLevel={state.currentLevel}
            regionId={state.regionId}
            reserveCount={state.reserve.length}
            itemCount={state.items.length}
            relicCount={state.relics.length}
            onOpenBag={() => {
              setBagFocusSlot(null);
              setBagHoverSlot(null);
              setBagOpen(true);
            }}
            onOpenReserve={
              state.screen.kind === "map"
                ? () => setReserveOpen(true)
                : undefined
            }
          />
        ) : null}

        <div
          className={[
            "beast-path__body",
            state.screen.kind === "menu" || contentDevOpen
              ? "beast-path__body--menu"
              : "",
            state.screen.kind !== "battle" &&
            state.screen.kind !== "menu" &&
            !contentDevOpen
              ? "mt-3"
              : "",
          ].join(" ")}
        >
        {contentDevOpen && showContentDev && state.screen.kind === "menu" ? (
          <BeastPathContentPanel
            layout="page"
            labels={labels}
            onClose={() => setContentDevOpen(false)}
            onContentChange={() => {
              setContentEpoch((n) => n + 1);
              setStarters(getStarters(locale));
            }}
          />
        ) : null}

        {!(contentDevOpen && state.screen.kind === "menu") && state.lastMessage ? (
          <p className="beast-path__panel mb-3 px-3 py-2 text-xs text-[var(--bp-muted)]">
            {state.lastMessage}
          </p>
        ) : null}

        {gameMenuOpen && state.screen.kind !== "menu" ? (
          <div
            className="beast-path__modal-backdrop"
            role="presentation"
            onClick={() => setGameMenuOpen(false)}
          >
            <div
              className="beast-path__modal beast-path__modal--game-menu"
              role="dialog"
              aria-modal="true"
              aria-label={labels.ui.gameMenu}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="beast-path__title shrink-0 text-2xl font-bold">
                {labels.ui.gameMenu}
              </p>
              <div className="beast-path__modal-body mt-0 flex flex-col gap-2.5">
                <button
                  type="button"
                  className="beast-path__btn px-4 py-3 text-base"
                  onClick={returnToMainMenu}
                >
                  {labels.ui.menuReturnSave}
                </button>
                <button
                  type="button"
                  className="beast-path__btn-ghost px-4 py-3 text-base"
                  onClick={abandonRun}
                >
                  {labels.ui.abandonRun}
                </button>
                <button
                  type="button"
                  className="beast-path__btn-ghost px-4 py-3 text-base"
                  onClick={() => setGameMenuOpen(false)}
                >
                  {labels.ui.abandonCancel}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {bagOpen && state.screen.kind !== "menu" ? (
          <div
            className="beast-path__modal-backdrop"
            role="presentation"
            onClick={() => {
              setBagOpen(false);
              setBagFocusSlot(null);
              setBagHoverSlot(null);
            }}
          >
            <div
              className="beast-path__modal beast-path__modal--bag"
              role="dialog"
              aria-modal="true"
              aria-label={labels.ui.inventory}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between gap-2">
                <p className="text-sm font-semibold">{labels.ui.inventory}</p>
                <button
                  type="button"
                  className="beast-path__btn-ghost px-2 py-1 text-[10px]"
                  onClick={() => {
                    setBagOpen(false);
                    setBagFocusSlot(null);
                    setBagHoverSlot(null);
                  }}
                >
                  {labels.ui.reserveClose}
                </button>
              </div>
              <div className="beast-path__modal-body">
                <div className="flex shrink-0 items-baseline justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--bp-muted)]">
                    {labels.ui.bag}
                  </p>
                  <p className="text-[10px] text-[var(--bp-muted)]">
                    {labels.ui.bagSlots.replace(
                      "{n}",
                      String(state.items.length),
                    )}
                  </p>
                </div>
                <div className="beast-path__bag-grid">
                  {Array.from({ length: BAG_LIMIT }, (_, slot) => {
                    const stack = state.items[slot];
                    const active =
                      bagHoverSlot === slot || bagFocusSlot === slot;
                    return (
                      <button
                        key={`bag-slot-${slot}`}
                        type="button"
                        className={[
                          "beast-path__bag-slot",
                          stack ? "" : "beast-path__bag-slot--empty",
                          active ? "beast-path__bag-slot--active" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        disabled={!stack}
                        onMouseEnter={() => {
                          if (stack) setBagHoverSlot(slot);
                        }}
                        onMouseLeave={() => setBagHoverSlot(null)}
                        onFocus={() => {
                          if (stack) setBagFocusSlot(slot);
                        }}
                        onClick={() => {
                          if (!stack) return;
                          setBagFocusSlot(slot);
                        }}
                        aria-label={
                          stack
                            ? (labels.items[stack.itemId]?.name ?? stack.itemId)
                            : undefined
                        }
                      >
                        {stack ? (
                          <BeastPortrait
                            art={getItem(stack.itemId)?.art}
                            alt={
                              labels.items[stack.itemId]?.name ?? stack.itemId
                            }
                            variant="thumb"
                            fill
                          />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                {(() => {
                  const detailSlot = bagHoverSlot ?? bagFocusSlot;
                  const stack =
                    detailSlot != null ? state.items[detailSlot] : null;
                const canUseBattle =
                  state.screen.kind === "battle" &&
                  state.battle?.phase === "planning";
                const canUseMap = state.screen.kind !== "battle";
                if (!stack) {
                  return (
                    <div className="beast-path__bag-detail">
                      <p className="text-[11px] text-[var(--bp-muted)]">
                        {state.items.length === 0
                          ? labels.ui.inventoryEmpty
                          : null}
                      </p>
                    </div>
                  );
                }
                const itemCopy = labels.items[stack.itemId];
                const def = getItem(stack.itemId);
                const effectHint = (def?.effects ?? [])
                  .map((effect) => {
                    if (effect.type === "healParty") {
                      return effect.amount === "full"
                        ? "HP full"
                        : effect.amount === "half"
                          ? "HP 50%"
                          : `HP +${effect.amount}`;
                    }
                    if (effect.type === "buffParty") {
                      return `${effect.stat.toUpperCase()} +${effect.amount}`;
                    }
                    if (effect.type === "damageParty") {
                      return `HP -${effect.amount}`;
                    }
                    return "";
                  })
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <div className="beast-path__bag-detail">
                    <p className="text-xs font-semibold">
                      {itemCopy?.name ?? stack.itemId}
                    </p>
                    {itemCopy?.description ? (
                      <p className="mt-1 text-[10px] leading-relaxed text-[var(--bp-muted)]">
                        {itemCopy.description}
                      </p>
                    ) : null}
                    {effectHint ? (
                      <p className="mt-1 text-[10px] text-[var(--bp-gold)]">
                        {effectHint}
                      </p>
                    ) : null}
                    {(canUseMap || canUseBattle) && detailSlot != null ? (
                      <button
                        type="button"
                        className="beast-path__btn mt-2 px-2.5 py-1 text-[10px]"
                        onClick={() => {
                          commit(useItem(state, detailSlot, locale));
                          setBagFocusSlot(null);
                          setBagHoverSlot(null);
                        }}
                      >
                        {labels.ui.useItem}
                      </button>
                    ) : null}
                  </div>
                );
                })()}
                <div className="beast-path__bag-relics">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--bp-muted)]">
                    {labels.ui.relics}
                  </p>
                  {state.relics.length === 0 ? (
                    <p className="mt-1 text-[11px] text-[var(--bp-muted)]">
                      {labels.ui.relicsEmpty}
                    </p>
                  ) : (
                    <ul className="mt-1 grid gap-1">
                      {state.relics.map((id) => (
                        <li
                          key={id}
                          className="border border-[var(--bp-line)] px-2 py-1.5"
                        >
                          <span className="block truncate text-xs font-semibold">
                            {labels.relics[id]?.name ?? id}
                          </span>
                          <span className="block text-[10px] text-[var(--bp-muted)]">
                            {labels.relics[id]?.description}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {state.screen.kind === "menu" && !contentDevOpen ? (
          <div className="beast-path__menu">
            <h2 className="beast-path__title text-4xl font-bold sm:text-5xl">
              {labels.ui.menuTitle}
            </h2>
            <p className="mt-3 max-w-lg text-lg leading-relaxed text-[var(--bp-muted)]">
              {labels.ui.menuLead}
            </p>
            <div className="beast-path__menu-actions mt-12">
              <button
                type="button"
                className="beast-path__btn px-6 py-3.5 text-lg"
                onClick={requestNewRun}
              >
                {labels.ui.menuNewRun}
              </button>
              <button
                type="button"
                className="beast-path__btn-ghost px-6 py-3.5 text-lg disabled:cursor-default disabled:opacity-40"
                disabled={!hasSave}
                onClick={continueRun}
              >
                {labels.ui.menuContinue}
              </button>
            </div>
            {overwriteOpen ? (
              <div
                className="beast-path__modal-backdrop"
                role="presentation"
                onClick={() => setOverwriteOpen(false)}
              >
                <div
                  className="beast-path__modal beast-path__modal--sm"
                  role="dialog"
                  aria-modal="true"
                  aria-label={labels.ui.menuOverwriteTitle}
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="shrink-0 text-sm font-semibold">
                    {labels.ui.menuOverwriteTitle}
                  </p>
                  <div className="beast-path__modal-body flex flex-col">
                    <p className="text-xs leading-relaxed text-[var(--bp-muted)]">
                      {labels.ui.menuOverwriteBody}
                    </p>
                    <div className="mt-auto flex flex-wrap justify-end gap-2 pt-3">
                      <button
                        type="button"
                        className="beast-path__btn-ghost px-3 py-1.5 text-xs"
                        onClick={() => setOverwriteOpen(false)}
                      >
                        {labels.ui.menuOverwriteCancel}
                      </button>
                      <button
                        type="button"
                        className="beast-path__btn px-3 py-1.5 text-xs"
                        onClick={startNewRun}
                      >
                        {labels.ui.menuOverwriteConfirm}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {state.screen.kind === "starter" ? (
          <div className="beast-path__starter">
            <h2 className="beast-path__title shrink-0 text-xl font-bold">
              {labels.ui.chooseStarter}
            </h2>
            <p className="mt-1 shrink-0 text-xs text-[var(--bp-muted)]">
              {labels.ui.starterHint}
            </p>
            <div className="beast-path__starter-grid mt-3">
              {starters.map((monster) => (
                <MonsterCard
                  key={monster.uid}
                  monster={monster}
                  labels={labels}
                  compact
                  onClick={() => commit(selectStarter(state, monster))}
                />
              ))}
            </div>
          </div>
        ) : null}

        {state.screen.kind === "map" ? (
          <div className="flex h-full min-h-0 flex-col gap-2">
            <div className="min-h-0 flex-1">
              <MapView
                state={state}
                labels={labels}
                onSelect={(id) => setState(enterNode(state, id, locale))}
              />
            </div>
            {reserveOpen ? (
              <div
                className="beast-path__modal-backdrop"
                role="presentation"
                onClick={() => {
                  setReserveOpen(false);
                  setReserveSwapParty(null);
                }}
              >
                <div
                  className="beast-path__modal"
                  role="dialog"
                  aria-modal="true"
                  aria-label={labels.ui.reserve}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex shrink-0 items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{labels.ui.reserve}</p>
                    <button
                      type="button"
                      className="beast-path__btn-ghost px-2 py-1 text-[10px]"
                      onClick={() => {
                        setReserveOpen(false);
                        setReserveSwapParty(null);
                      }}
                    >
                      {labels.ui.reserveClose}
                    </button>
                  </div>
                  <p className="mt-1 shrink-0 text-[11px] text-[var(--bp-muted)]">
                    {labels.ui.reserveHint}
                  </p>
                  <div className="beast-path__modal-body">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--bp-muted)]">
                        {labels.ui.party}
                      </p>
                      <ul className="grid gap-1">
                        {state.party.map((m) => (
                          <li key={m.uid}>
                            <button
                              type="button"
                              className={[
                                "w-full border px-2 py-1.5 text-left text-xs",
                                reserveSwapParty === m.uid
                                  ? "border-[var(--bp-gold)] text-[var(--bp-gold)]"
                                  : "border-[var(--bp-line)]",
                              ].join(" ")}
                              onClick={() =>
                                setReserveSwapParty((prev) =>
                                  prev === m.uid ? null : m.uid,
                                )
                              }
                            >
                              <span className="block truncate font-semibold">
                                {m.name}
                              </span>
                              <span className="text-[10px] text-[var(--bp-muted)]">
                                {labels.ui.level} {m.level}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                      {reserveSwapParty && state.party.length > 1 ? (
                        <button
                          type="button"
                          className="beast-path__btn-ghost mt-2 w-full px-2 py-1 text-[10px]"
                          onClick={() => {
                            commitUpdate((s) =>
                              movePartyToReserve(s, reserveSwapParty),
                            );
                            setReserveSwapParty(null);
                          }}
                        >
                          {labels.ui.partyToReserve}
                        </button>
                      ) : null}
                    </div>
                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--bp-muted)]">
                        {labels.ui.reserve}
                      </p>
                      {state.reserve.length === 0 ? (
                        <p className="text-[11px] text-[var(--bp-muted)]">
                          {labels.ui.reserveEmpty}
                        </p>
                      ) : (
                        <ul className="grid gap-1">
                          {state.reserve.map((m) => (
                            <li key={m.uid}>
                              <button
                                type="button"
                                className="w-full border border-[var(--bp-line)] px-2 py-1.5 text-left text-xs hover:border-[color-mix(in_oklab,var(--bp-gold)_50%,transparent)]"
                                onClick={() => {
                                  if (reserveSwapParty) {
                                    commitUpdate((s) =>
                                      swapReserveIntoParty(
                                        s,
                                        m.uid,
                                        reserveSwapParty,
                                      ),
                                    );
                                    setReserveSwapParty(null);
                                    return;
                                  }
                                  commitUpdate((s) =>
                                    moveReserveToParty(s, m.uid),
                                  );
                                }}
                              >
                                <span className="block truncate font-semibold">
                                  {m.name}
                                </span>
                                <span className="text-[10px] text-[var(--bp-muted)]">
                                  {labels.ui.level} {m.level} ·{" "}
                                  {reserveSwapParty
                                    ? labels.ui.reserveSwap
                                    : labels.ui.reserveToParty}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {state.screen.kind === "battle" && state.battle ? (
          <div className="h-full min-h-0">
            <BattleView
              state={state}
              labels={labels}
              onPlan={(actorId, moveId, targetId) =>
                setState((s) => planMove(s, actorId, moveId, targetId))
              }
              onClearPlan={(actorId) =>
                setState((s) => clearMovePlan(s, actorId))
              }
              onSkip={(actorId) => setState((s) => skipMove(s, actorId))}
              onArmCapture={(enabled) =>
                setState((s) => armCapture(s, enabled))
              }
              onOpenBag={() => {
                setBagFocusSlot(null);
                setBagHoverSlot(null);
                setBagOpen(true);
              }}
              onFightComplete={(battle, consumedItemSlot) =>
                commitUpdate((s) =>
                  applyFightBattle(s, battle, locale, consumedItemSlot),
                )
              }
              onClaim={() =>
                commitUpdate((s) => claimBattleRewards(s, locale))
              }
            />
          </div>
        ) : null}

        {state.screen.kind === "shop" ? (
          <div className="min-h-0 overflow-auto">
            <h2 className="beast-path__title text-xl font-bold">{labels.ui.shopTitle}</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {state.shopOffers.map((offer) => (
                <li key={offer.id} className="beast-path__panel p-3">
                  <p className="font-semibold">
                    {offer.kind === "item"
                      ? `${labels.shop.item}: ${labels.items[offer.itemId]?.name ?? offer.itemId}`
                      : offer.kind === "relic"
                        ? `${labels.shop.relic}: ${labels.relics[offer.relicId]?.name ?? offer.relicId}`
                        : labels.shop[offer.labelKey]}
                    {offer.kind === "recruit" ? `: ${offer.monster.name}` : ""}
                  </p>
                  {offer.kind === "recruit" ? (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="beast-path__shop-recruit-art">
                        <BeastPortrait
                          art={speciesFullArt(
                            SPECIES[offer.monster.speciesId],
                          )}
                          alt={offer.monster.name}
                          variant="full"
                          fill
                        />
                      </div>
                      <p className="text-xs text-[var(--bp-muted)]">
                        {labels.ui.level} {offer.monster.level} ·{" "}
                        {offer.monster.element
                          ? labels.elements[offer.monster.element]
                          : labels.ui.elementNone}{" "}
                        · ATK {offer.monster.atk}
                      </p>
                    </div>
                  ) : null}
                  {offer.kind === "item" ? (
                    <p className="mt-1 text-xs text-[var(--bp-muted)]">
                      {labels.items[offer.itemId]?.description}
                    </p>
                  ) : null}
                  {offer.kind === "relic" ? (
                    <p className="mt-1 text-xs text-[var(--bp-muted)]">
                      {labels.relics[offer.relicId]?.description}
                    </p>
                  ) : null}
                  <p className="mt-2 text-sm text-[var(--bp-gold)]">
                    {labels.ui.gold}: {offer.cost}
                  </p>
                  <button
                    type="button"
                    className="beast-path__btn mt-3 px-3 py-2 text-sm"
                    onClick={() => setState(buyOffer(state, offer, locale))}
                  >
                    {labels.ui.buy}
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={state.shopSoldCreature || state.party.length <= 1}
                className="beast-path__btn px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => setSellOpen(true)}
              >
                {labels.ui.shopSellOpen}
              </button>
              <button
                type="button"
                className="beast-path__btn-ghost px-4 py-2 text-sm"
                onClick={() => {
                  setSellOpen(false);
                  commit(leaveShop(state));
                }}
              >
                {labels.ui.leaveShop}
              </button>
            </div>
            {state.shopSoldCreature ? (
              <p className="mt-2 text-xs text-[var(--bp-muted)]">
                {labels.ui.shopSellOnce}
              </p>
            ) : null}
          </div>
        ) : null}

        {sellOpen && state.screen.kind === "shop" ? (
          <div
            className="beast-path__modal-backdrop"
            role="presentation"
            onClick={() => setSellOpen(false)}
          >
            <div
              className="beast-path__modal beast-path__modal--md"
              role="dialog"
              aria-modal="true"
              aria-label={labels.ui.shopSellTitle}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="shrink-0 text-sm font-semibold">
                {labels.ui.shopSellPick}
              </p>
              <p className="mt-1 shrink-0 text-[11px] text-[var(--bp-muted)]">
                {labels.ui.shopSellOnce}
              </p>
              <ul className="beast-path__modal-body mt-0 grid grid-cols-1 content-start gap-1.5">
                {state.party.map((monster) => (
                  <li key={monster.uid}>
                    <button
                      type="button"
                      disabled={state.party.length <= 1}
                      className="flex w-full items-center justify-between gap-2 border border-[var(--bp-line)] px-2.5 py-2 text-left transition hover:border-[color-mix(in_oklab,var(--bp-gold)_50%,transparent)] disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() => {
                        setState(sellCreature(state, monster.uid, locale));
                        setSellOpen(false);
                      }}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">
                          {monster.name}
                        </span>
                        <span className="block text-[10px] text-[var(--bp-muted)]">
                          {labels.ui.level} {monster.level}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-[var(--bp-gold)]">
                        +{sellPriceFor(monster)} {labels.ui.gold}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="beast-path__btn-ghost mt-3 w-full shrink-0 px-3 py-1.5 text-xs"
                onClick={() => setSellOpen(false)}
              >
                {labels.ui.shopSellClose}
              </button>
            </div>
          </div>
        ) : null}

        {state.screen.kind === "rest" ? (
          <div className="max-w-xl">
            <h2 className="beast-path__title text-2xl font-bold">{labels.ui.restTitle}</h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--bp-muted)]">
              {labels.ui.restBody}
            </p>
            <button
              type="button"
              className="beast-path__btn mt-5 px-4 py-2 text-sm"
              onClick={() => commit(takeRest(state, locale))}
            >
              {labels.ui.restAction}
            </button>
          </div>
        ) : null}

        {state.screen.kind === "event" && state.event ? (
          <div className="max-w-xl">
            <h2 className="beast-path__title text-2xl font-bold">
              {labels.events[state.event.id].title}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--bp-muted)]">
              {labels.events[state.event.id].body}
            </p>
            {!state.eventResolved ? (
              <div className="mt-5 flex flex-col gap-3">
                {state.event.id === "release" ? (
                  <>
                    <button
                      type="button"
                      className="beast-path__panel px-4 py-3 text-left text-sm font-semibold transition hover:border-[color-mix(in_oklab,var(--bp-gold)_50%,transparent)]"
                      onClick={() =>
                        setState(resolveEvent(state, "keep", locale))
                      }
                    >
                      {labels.events.release.choices.keep}
                    </button>
                    {state.party.map((monster) => (
                      <button
                        key={monster.uid}
                        type="button"
                        disabled={state.party.length <= 1}
                        className="beast-path__panel px-4 py-3 text-left text-sm font-semibold transition hover:border-[color-mix(in_oklab,var(--bp-gold)_50%,transparent)] disabled:cursor-not-allowed disabled:opacity-40"
                        onClick={() =>
                          setState(
                            resolveEvent(state, `free:${monster.uid}`, locale),
                          )
                        }
                      >
                        {labels.events.release.choices.free}: {monster.name} (
                        {labels.ui.level} {monster.level})
                      </button>
                    ))}
                  </>
                ) : (
                  state.event.choices.map((choice) => (
                    <button
                      key={choice.id}
                      type="button"
                      className="beast-path__panel px-4 py-3 text-left text-sm font-semibold transition hover:border-[color-mix(in_oklab,var(--bp-gold)_50%,transparent)]"
                      onClick={() =>
                        setState(resolveEvent(state, choice.id, locale))
                      }
                    >
                      {labels.events[state.event!.id].choices[choice.labelKey]}
                    </button>
                  ))
                )}
              </div>
            ) : (
              <button
                type="button"
                className="beast-path__btn mt-5 px-4 py-2 text-sm"
                onClick={() => commit(continueFromEvent(state))}
              >
                {labels.ui.continue}
              </button>
            )}
          </div>
        ) : null}

        {state.screen.kind === "victory" || state.screen.kind === "defeat" ? (
          <div className="beast-path__panel p-6 text-center">
            <h2 className="beast-path__title text-2xl font-bold">
              {state.screen.kind === "victory"
                ? labels.ui.runVictory
                : labels.ui.runDefeat}
            </h2>
            <button
              type="button"
              className="beast-path__btn mt-6 px-5 py-3 text-sm"
              onClick={goToMenu}
            >
              {labels.ui.menuMain}
            </button>
          </div>
        ) : null}
        </div>
      </div>
    </GameChrome>
  );
}
