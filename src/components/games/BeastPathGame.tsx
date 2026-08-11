"use client";

import { Oxanium } from "next/font/google";
import {
  Bed,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleHelp,
  Coins,
  Crown,
  Droplets,
  Flower2,
  Heart,
  ImageIcon,
  ListOrdered,
  Maximize2,
  Minimize2,
  Mountain,
  Palmtree,
  ScrollText,
  Shield,
  ShoppingBag,
  Skull,
  Swords,
  Tent,
  Trees,
  Waves,
  Wind,
  X,
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
import { useLayoutMode } from "@/lib/use-layout-mode";
import { ELEMENT_COLOR } from "@/lib/roguelike/content";
import {
  buildFightTimeline,
  canFight,
  moveImpactHint,
  moveRequiresTargetChoice,
  plannedEffectsOn,
  previewTurnOrder,
  validTargetsForMove,
  type BattleFx,
  type MovePreview,
} from "@/lib/roguelike/combat";
import { MAP_LANES } from "@/lib/roguelike/map";
import { getMove, maxUsesFor, remainingUses } from "@/lib/roguelike/moves";
import { xpToNext } from "@/lib/roguelike/monsters";
import {
  applyFightBattle,
  armCapture,
  buyOffer,
  claimBattleRewards,
  clearMovePlan,
  continueFromEvent,
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
} from "@/lib/roguelike/run";
import type {
  BattleState,
  HabitatId,
  MapNode,
  Monster,
  MoveId,
  NodeType,
  RunState,
} from "@/lib/roguelike/types";
import { MAX_MOVES, PARTY_LIMIT } from "@/lib/roguelike/types";

const oxanium = Oxanium({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-oxanium",
  display: "swap",
});

const COL_GAP = 100;
const ROW_GAP = 52;
const NODE_R = 24;
const PAD_X = 48;
const PAD_Y = 40;

/** Vertical (portrait) path: columns run top → bottom, lanes spread sideways. */
const V_COL_GAP = 78;
const V_LANE_GAP = 58;
const V_PAD_X = 30;
const V_PAD_Y = 38;
const COMPACT_NODE_R = 19;

type MapAxis = "horizontal" | "vertical";

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

function layoutMap(nodes: MapNode[], axis: MapAxis) {
  const maxCols = Math.max(...nodes.map((n) => n.column)) + 1;
  const positions = new Map<string, { x: number; y: number }>();

  if (axis === "vertical") {
    for (const node of nodes) {
      positions.set(node.id, {
        x: V_PAD_X + node.row * V_LANE_GAP,
        y: V_PAD_Y + node.column * V_COL_GAP,
      });
    }

    return {
      positions,
      width: V_PAD_X * 2 + (MAP_LANES - 1) * V_LANE_GAP,
      height: V_PAD_Y * 2 + (maxCols - 1) * V_COL_GAP,
    };
  }

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

/** Path between two nodes, bent along the travel axis. */
function nodeLinkPath(
  a: { x: number; y: number },
  b: { x: number; y: number },
  axis: MapAxis,
  radius: number,
) {
  if (axis === "vertical") {
    const midY = (a.y + b.y) / 2;
    return `M ${a.x} ${a.y + radius - 2} C ${a.x} ${midY}, ${b.x} ${midY}, ${b.x} ${b.y - radius + 2}`;
  }
  const midX = (a.x + b.x) / 2;
  return `M ${a.x + radius - 2} ${a.y} C ${midX} ${a.y}, ${midX} ${b.y}, ${b.x - radius + 2} ${b.y}`;
}

/** Collapsible section used to fold secondary info away on small screens. */
function Collapsible({
  title,
  meta,
  badge,
  preview,
  defaultOpen = false,
  children,
}: {
  title: string;
  meta?: React.ReactNode;
  badge?: React.ReactNode;
  /** Shown next to the title while the section is folded. */
  preview?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={[
        "beast-path__collapse",
        open ? "beast-path__collapse--open" : "",
      ].join(" ")}
    >
      <button
        type="button"
        className="beast-path__collapse-head"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="beast-path__collapse-title">{title}</span>
        {badge != null ? (
          <span className="beast-path__collapse-badge">{badge}</span>
        ) : null}
        {!open && preview != null ? (
          <span className="beast-path__collapse-preview">{preview}</span>
        ) : null}
        {meta != null ? (
          <span className="beast-path__collapse-meta">{meta}</span>
        ) : null}
        <span className="beast-path__collapse-chevron" aria-hidden>
          <ChevronDown size={14} strokeWidth={2.25} />
        </span>
      </button>
      {open ? (
        <div className="beast-path__collapse-body">{children}</div>
      ) : null}
    </div>
  );
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
  label,
  compact,
}: {
  label: string;
  compact?: boolean;
}) {
  return (
    <div
      className={[
        "beast-path__portrait",
        compact ? "mb-1.5 min-h-[3.5rem]" : "mb-3",
      ].join(" ")}
      aria-hidden
    >
      <span className="flex flex-col items-center gap-1">
        <ImageIcon size={compact ? 16 : 18} strokeWidth={1.75} />
        <span>{label}</span>
      </span>
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
      <MonsterPortrait label={labels.ui.artPlaceholder} compact={compact} />
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
            <span style={{ color: ELEMENT_COLOR[monster.element] }}>
              {labels.elements[monster.element]}
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

function PartyStrip({
  party,
  labels,
  gold,
  compact,
}: {
  party: Monster[];
  labels: ReturnType<typeof getLabels>;
  gold: number;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <Collapsible
        title={labels.ui.party}
        badge={`${party.length}/${PARTY_LIMIT}`}
        meta={
          <span className="beast-path__gold-chip">
            <Coins size={11} strokeWidth={2.25} aria-hidden />
            {gold}
          </span>
        }
        preview={
          party.length > 0 ? (
            <span
              className="beast-path__party-pips"
              aria-label={labels.ui.partyStatus}
            >
              {party.map((m) => (
                <span key={m.uid} className="beast-path__party-pip">
                  <HpBar hp={m.hp} maxHp={m.maxHp} />
                </span>
              ))}
            </span>
          ) : null
        }
      >
        {party.length === 0 ? (
          <p className="text-xs text-[var(--bp-muted)]">—</p>
        ) : (
          <ul className="beast-path__party-list">
            {party.map((m) => (
              <li key={m.uid} className="beast-path__party-row">
                <span className="beast-path__party-thumb" aria-hidden>
                  <ImageIcon size={13} strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-xs font-semibold leading-tight">
                      {m.name}
                    </span>
                    <span className="shrink-0 text-[10px] text-[var(--bp-muted)]">
                      {labels.ui.level} {m.level} · {m.hp}/{m.maxHp}
                    </span>
                  </span>
                  <span className="mt-1 block space-y-1">
                    <HpBar hp={m.hp} maxHp={m.maxHp} />
                    <XpBar xp={m.xp} level={m.level} label={labels.ui.rewardXp} />
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Collapsible>
    );
  }

  return (
    <div className="beast-path__panel flex shrink-0 flex-col gap-2 p-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--bp-moss)]">
          {labels.ui.party}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {party.length === 0 ? (
            <p className="text-sm text-[var(--bp-muted)]">—</p>
          ) : (
            party.map((m) => {
              return (
                <div
                  key={m.uid}
                  className="grid w-[200px] grid-cols-[40px_minmax(0,1fr)] items-center gap-2.5 border border-[var(--bp-line)] bg-black/20 px-2 py-2"
                >
                  <div
                    className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--bp-line)] bg-[color-mix(in_oklab,black_30%,var(--bp-bg-panel))] text-[var(--bp-muted)]"
                    aria-hidden
                  >
                    <ImageIcon size={16} strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold leading-tight">
                      {m.name}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] leading-tight text-[var(--bp-muted)]">
                      {labels.ui.level} {m.level} · {m.hp}/{m.maxHp}
                    </p>
                    <div className="mt-1.5 space-y-1">
                      <HpBar hp={m.hp} maxHp={m.maxHp} />
                      <XpBar
                        xp={m.xp}
                        level={m.level}
                        label={labels.ui.rewardXp}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      <p className="beast-path__title shrink-0 text-lg font-bold text-[var(--bp-gold)]">
        {labels.ui.gold}: {gold}
      </p>
    </div>
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
  axis,
  compact = false,
}: {
  state: RunState;
  labels: ReturnType<typeof getLabels>;
  onSelect: (id: string) => void;
  axis: MapAxis;
  compact?: boolean;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);
  const vertical = axis === "vertical";
  const nodeRadius = compact ? COMPACT_NODE_R : NODE_R;

  const { positions, width, height } = useMemo(
    () => layoutMap(state.map.nodes, axis),
    [state.map.nodes, axis],
  );

  const edges = useMemo(() => {
    return state.map.nodes.flatMap((node) =>
      node.next.map((targetId) => ({ from: node.id, to: targetId })),
    );
  }, [state.map.nodes]);

  const updateScrollState = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (vertical) {
      setCanScrollBack(el.scrollTop > 2);
      setCanScrollForward(
        el.scrollTop + el.clientHeight < el.scrollHeight - 2,
      );
      return;
    }
    setCanScrollBack(el.scrollLeft > 2);
    setCanScrollForward(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, [vertical]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const ro = new ResizeObserver(() => updateScrollState());
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro.disconnect();
    };
  }, [updateScrollState, width, height]);

  // Small screens only: keep the next open nodes in view without panning.
  const focusNodeId = state.available[0] ?? state.currentNodeId;
  useEffect(() => {
    if (!compact) return;
    const el = scrollerRef.current;
    const pos = positions.get(focusNodeId);
    if (!el || !pos) return;
    if (vertical) {
      el.scrollTo({
        top: Math.max(0, pos.y - el.clientHeight * 0.55),
        behavior: "smooth",
      });
      return;
    }
    el.scrollTo({
      left: Math.max(0, pos.x - el.clientWidth * 0.5),
      behavior: "smooth",
    });
  }, [compact, focusNodeId, positions, vertical]);

  function scrollMap(direction: -1 | 1) {
    const el = scrollerRef.current;
    if (!el) return;
    if (vertical) {
      el.scrollBy({
        top: direction * Math.min(240, el.clientHeight * 0.6),
        behavior: "smooth",
      });
      return;
    }
    el.scrollBy({
      left: direction * Math.min(280, el.clientWidth * 0.55),
      behavior: "smooth",
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="beast-path__map-hint mb-2 shrink-0 text-xs text-[var(--bp-muted)]">
        {labels.ui.mapHint}
      </p>
      <div className="beast-path__map-wrap">
        <div
          className={[
            "beast-path__map-shell",
            vertical ? "beast-path__map-shell--vertical" : "",
          ].join(" ")}
        >
        <button
          type="button"
          className={[
            "beast-path__map-arrow",
            vertical
              ? "beast-path__map-arrow--up"
              : "beast-path__map-arrow--left",
          ].join(" ")}
          aria-label={vertical ? labels.ui.scrollUp : labels.ui.scrollLeft}
          disabled={!canScrollBack}
          onClick={() => scrollMap(-1)}
        >
          <span className="beast-path__map-arrow-icon" aria-hidden>
            {vertical ? (
              <ChevronUp size={22} strokeWidth={2.25} />
            ) : (
              <ChevronLeft size={22} strokeWidth={2.25} />
            )}
          </span>
        </button>
        <button
          type="button"
          className={[
            "beast-path__map-arrow",
            vertical
              ? "beast-path__map-arrow--down"
              : "beast-path__map-arrow--right",
          ].join(" ")}
          aria-label={vertical ? labels.ui.scrollDown : labels.ui.scrollRight}
          disabled={!canScrollForward}
          onClick={() => scrollMap(1)}
        >
          <span className="beast-path__map-arrow-icon" aria-hidden>
            {vertical ? (
              <ChevronDown size={22} strokeWidth={2.25} />
            ) : (
              <ChevronRight size={22} strokeWidth={2.25} />
            )}
          </span>
        </button>
        <div
          ref={scrollerRef}
          className={[
            "beast-path__map-scroller",
            vertical ? "beast-path__map-scroller--vertical" : "",
          ].join(" ")}
        >
          <div
            className={[
              "beast-path__map",
              vertical ? "beast-path__map--vertical" : "",
            ].join(" ")}
            style={
              vertical
                ? { width, height, minHeight: height }
                : { width, height, minWidth: width }
            }
          >
            <svg
              className="beast-path__map-svg"
              viewBox={`0 0 ${width} ${height}`}
            >
              {edges.map(({ from, to }) => {
                const a = positions.get(from);
                const b = positions.get(to);
                if (!a || !b) return null;
                const active =
                  state.available.includes(to) &&
                  (state.currentNodeId === from ||
                    state.visited.includes(from));
                const done =
                  state.visited.includes(from) && state.visited.includes(to);
                return (
                  <path
                    key={`${from}-${to}`}
                    d={nodeLinkPath(a, b, axis, nodeRadius)}
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

const LEGEND_TYPES: NodeType[] = [
  "battle",
  "elite",
  "habitat",
  "shop",
  "event",
  "rest",
  "boss",
  "start",
];

function MapLegend({ labels }: { labels: ReturnType<typeof getLabels> }) {
  return (
    <Collapsible title={labels.ui.mapLegend}>
      <ul className="beast-path__legend">
        {LEGEND_TYPES.map((type) => {
          const Icon = NODE_ICONS[type];
          return (
            <li key={type}>
              <span className="beast-path__legend-icon" aria-hidden>
                <Icon size={13} strokeWidth={2} />
              </span>
              {labels.nodes[type]}
            </li>
          );
        })}
      </ul>
    </Collapsible>
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
  onFightComplete,
  onClaim,
  compact = false,
}: {
  state: RunState;
  labels: ReturnType<typeof getLabels>;
  onPlan: (actorId: string, moveId: MoveId, targetId: string | null) => void;
  onClearPlan: (actorId: string) => void;
  onSkip: (actorId: string) => void;
  onArmCapture: (enabled: boolean) => void;
  onFightComplete: (battle: BattleState) => void;
  onClaim: () => void;
  /** Small screens: creatures + actions stay visible, the rest folds away. */
  compact?: boolean;
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
  const [sheet, setSheet] = useState<"order" | "log" | null>(null);
  const [inspectOpen, setInspectOpen] = useState(false);
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const [links, setLinks] = useState<
    { key: string; d: string; color: string; active?: boolean }[]
  >([]);

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
  const ready = canFight(liveBattle) && !playback;
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

  const updateLinks = useCallback(() => {
    const field = fieldRef.current;
    if (!field) {
      setLinks([]);
      return;
    }
    const fieldRect = field.getBoundingClientRect();
    const next: { key: string; d: string; color: string; active?: boolean }[] =
      [];
    const plans = [
      ...Object.values(battle.plans),
      ...Object.values(battle.enemyPlans),
    ];
    plans.forEach((plan, idx) => {
      if (!plan.moveId || !plan.targetId || plan.actorId === plan.targetId) {
        return;
      }
      const fromEl = cardRefs.current.get(plan.actorId);
      const toEl = cardRefs.current.get(plan.targetId);
      if (!fromEl || !toEl) return;
      const actor = combatantsById.get(plan.actorId);
      const target = combatantsById.get(plan.targetId);
      if (!actor || !target || actor.hp <= 0 || target.hp <= 0) return;
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
      const bend = (idx % 2 === 0 ? 1 : -1) * (18 + idx * 10);
      const color =
        actor.side === "player"
          ? (partyColorById.get(actor.uid) ??
            ELEMENT_COLOR[actor.element])
          : (partyColorById.get(target.uid) ??
            ELEMENT_COLOR[target.element]);
      next.push({
        key: `${plan.actorId}-${plan.targetId}-${plan.moveId}`,
        d: curvedLinkPath(start.x, start.y, x2, y2, bend),
        color,
        active: playback?.actorId === plan.actorId,
      });
    });
    setLinks(next);
  }, [
    battle.enemyPlans,
    battle.plans,
    combatantsById,
    partyColorById,
    playback?.actorId,
  ]);

  useLayoutEffect(() => {
    updateLinks();
  }, [updateLinks, battle.player, battle.enemies, pendingMove, playback]);

  useEffect(() => {
    const field = fieldRef.current;
    const onResize = () => updateLinks();
    window.addEventListener("resize", onResize);
    document.addEventListener("fullscreenchange", onResize);
    const ro =
      field && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            updateLinks();
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
    if (!ready || playback) return;
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
    onFightComplete(timeline.final);
    setPlayback(null);
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

  const titleText =
    isWild && liveBattle.habitat
      ? labels.habitats[liveBattle.habitat]
      : labels.ui.fight;

  const phaseText =
    battle.phase === "won"
      ? labels.ui.victoryBattle
      : battle.phase === "lost"
        ? labels.ui.defeatBattle
        : resolving
          ? labels.ui.resolving
          : captureArmed
            ? labels.ui.captureArmed
            : pendingMove
              ? labels.ui.chooseTarget
              : ready
                ? labels.ui.yourTurn
                : labels.ui.needPlans;

  function renderMoveGrid(className: string) {
    if (!focus) return null;
    return (
      <div className={className}>
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
          const moveSelected = battle.plans[focus.uid]?.moveId === moveId;
          const pending = pendingMove === moveId;
          const uses = remainingUses(focus.moveUses, moveId);
          const max = maxUsesFor(moveId);
          const exhausted = uses <= 0;
          const hasTargets =
            validTargetsForMove(battle, focus.uid, moveId).length > 0;
          const plannedTarget =
            battle.plans[focus.uid]?.moveId === moveId
              ? battle.plans[focus.uid]?.targetId
              : null;
          const impact = exhausted
            ? null
            : moveImpactHint(battle, focus.uid, moveId, labels, plannedTarget);
          const impactTone =
            move.kind === "attack"
              ? "damage"
              : move.effect?.type === "heal"
                ? "heal"
                : "buff";
          return (
            <button
              key={moveId}
              type="button"
              disabled={exhausted || !hasTargets}
              className={[
                "beast-path__move-slot disabled:cursor-not-allowed disabled:opacity-40",
                moveSelected || pending
                  ? "border-[var(--bp-ember)] bg-[color-mix(in_oklab,var(--bp-ember)_12%,transparent)]"
                  : "",
              ].join(" ")}
              onClick={() => selectMove(moveId)}
            >
              <div className="flex items-start justify-between gap-1.5">
                <p className="text-[11px] font-semibold leading-tight">
                  {labels.moves[moveId].name}
                  <span className="ml-1 text-[8px] uppercase tracking-wide text-[var(--bp-muted)]">
                    {move.kind}
                  </span>
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
    );
  }

  function renderSkipButton(extraClass: string) {
    if (!focus) return null;
    return (
      <button
        type="button"
        className={[
          extraClass,
          battle.plans[focus.uid]?.moveId === null
            ? "border-[var(--bp-gold)] text-[var(--bp-gold)]"
            : "border-[var(--bp-line)] text-[var(--bp-muted)] hover:border-[var(--bp-gold)]",
        ].join(" ")}
        onClick={selectSkip}
      >
        {labels.ui.skipMove}
      </button>
    );
  }

  function renderCaptureButton(className: string) {
    return (
      <button
        type="button"
        className={[
          className,
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
    );
  }

  function renderFightButton(className: string) {
    return (
      <button
        type="button"
        disabled={!ready || Boolean(playback)}
        className={[
          "beast-path__btn disabled:cursor-not-allowed disabled:opacity-40",
          className,
        ].join(" ")}
        onClick={() => {
          void playFight();
        }}
      >
        {playback ? labels.ui.resolving : labels.ui.fightRound}
      </button>
    );
  }

  const turnOrderList = (
    <ol className="beast-path__turn-order">
      {order.map((uid, idx) => {
        const m = combatantsById.get(uid);
        if (!m) return null;
        const accent =
          m.side === "player"
            ? (partyColorById.get(m.uid) ?? PARTY_COLORS[0])
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
  );

  const logList = (
    <ul className="space-y-1 text-[var(--bp-muted)]">
      {battle.log.map((entry) => (
        <li key={entry.id}>{entry.text}</li>
      ))}
    </ul>
  );

  const victoryOverlay =
    battle.phase === "won" && !playback ? (
      <div className="beast-path__victory p-3">
        <p className="text-sm font-semibold">{labels.ui.victoryBattle}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="beast-path__btn px-3 py-1.5 text-xs"
            onClick={() => onClaim()}
          >
            {labels.ui.claimRewards}
          </button>
        </div>
      </div>
    ) : null;

  const combatField = (
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
                      <span className="beast-path__combatant-thumb" aria-hidden>
                        <ImageIcon size={14} strokeWidth={1.75} />
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
                      <span className="beast-path__combatant-thumb" aria-hidden>
                        <ImageIcon size={14} strokeWidth={1.75} />
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
  );

  const inspectPanel = inspected ? (
                  <div className="beast-path__panel beast-path__inspect p-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold leading-tight">
                        {inspected.name}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] text-[var(--bp-muted)]">
                        {labels.ui.level} {inspected.level} ·{" "}
                        <span
                          style={{ color: ELEMENT_COLOR[inspected.element] }}
                        >
                          {labels.elements[inspected.element]}
                        </span>
                        {" · "}
                        {inspected.hp}/{inspected.maxHp}
                      </p>
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
                  </div>
  ) : null;

  const desktopDock =
    planning || playback ? (
      <div
        className={[
          "beast-path__actions-dock",
          inspected || (isWild && planning)
            ? ""
            : "beast-path__actions-dock--empty",
        ].join(" ")}
      >
        {inspected || (isWild && planning) ? (
          <div className="beast-path__dock-row">
            {inspectPanel}
            {focus ? (
              <div className="beast-path__panel beast-path__actions p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--bp-gold)]">
                      {labels.ui.actionsPanel}
                    </p>
                    <p className="truncate text-[11px] text-[var(--bp-muted)]">
                      {labels.ui.chooseMove}
                    </p>
                  </div>
                  {renderSkipButton(
                    "shrink-0 border px-3 py-1.5 text-xs font-bold uppercase tracking-wide",
                  )}
                </div>
                {renderMoveGrid("mt-1.5 grid grid-cols-2 gap-1.5")}
              </div>
            ) : null}
            {isWild && planning ? (
              <div className="beast-path__capture-slot">
                {renderCaptureButton("beast-path__capture-btn")}
                {captureArmed ? (
                  <p className="beast-path__capture-hint">
                    {labels.ui.captureHint}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <p>
            {captureArmed ? labels.ui.captureHint : labels.ui.chooseMove}
          </p>
        )}
      </div>
    ) : null;

  const compactDock =
    planning || playback ? (
      <div className="beast-path__cdock">
        {inspected ? (
          <div
            className={[
              "beast-path__cinspect",
              inspectOpen ? "beast-path__cinspect--open" : "",
            ].join(" ")}
          >
            <button
              type="button"
              className="beast-path__cinspect-head"
              aria-expanded={inspectOpen}
              onClick={() => setInspectOpen((value) => !value)}
            >
              <span className="beast-path__cinspect-name">
                {inspected.name}
              </span>
              <span className="beast-path__cinspect-meta">
                {labels.ui.level} {inspected.level} · {inspected.hp}/
                {inspected.maxHp} ·{" "}
                <span style={{ color: ELEMENT_COLOR[inspected.element] }}>
                  {labels.elements[inspected.element]}
                </span>
              </span>
              <span className="beast-path__collapse-chevron" aria-hidden>
                <ChevronDown size={13} strokeWidth={2.25} />
              </span>
            </button>
            {inspectOpen ? (
              <div className="beast-path__cinspect-body">
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
                <div className="mt-1.5 space-y-1">
                  <HpBar hp={inspected.hp} maxHp={inspected.maxHp} />
                  {inspected.side === "player" ? (
                    <XpBar
                      xp={inspected.xp}
                      level={inspected.level}
                      label={labels.ui.rewardXp}
                    />
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {focus ? (
          renderMoveGrid("beast-path__cmoves")
        ) : (
          <p className="beast-path__chint">
            {captureArmed ? labels.ui.captureHint : labels.ui.chooseMove}
          </p>
        )}

        <div className="beast-path__cdock-row">
          {renderSkipButton("beast-path__cbtn")}
          {isWild && planning
            ? renderCaptureButton("beast-path__cbtn beast-path__cbtn--capture")
            : null}
          {renderFightButton("beast-path__cfight")}
        </div>
      </div>
    ) : null;

  if (compact) {
    const sheetTitle =
      sheet === "order" ? labels.ui.turnOrder : labels.ui.log;
    return (
      <div className="beast-path__battle beast-path__battle--compact">
        <div className="beast-path__battle-main">
          <div className="beast-path__cbar">
            <div className="beast-path__cbar-info">
              <p className="beast-path__cbar-title beast-path__title">
                {titleText}
              </p>
              <p className="beast-path__cbar-phase">{phaseText}</p>
            </div>
            <span className="beast-path__gold-chip">
              <Coins size={11} strokeWidth={2.25} aria-hidden />
              {state.gold}
            </span>
            <button
              type="button"
              className={[
                "beast-path__cbar-btn",
                sheet === "order" ? "beast-path__cbar-btn--on" : "",
              ].join(" ")}
              aria-label={labels.ui.turnOrder}
              aria-expanded={sheet === "order"}
              onClick={() =>
                setSheet((value) => (value === "order" ? null : "order"))
              }
            >
              <ListOrdered size={15} strokeWidth={2} />
            </button>
            <button
              type="button"
              className={[
                "beast-path__cbar-btn",
                sheet === "log" ? "beast-path__cbar-btn--on" : "",
              ].join(" ")}
              aria-label={labels.ui.log}
              aria-expanded={sheet === "log"}
              onClick={() =>
                setSheet((value) => (value === "log" ? null : "log"))
              }
            >
              <ScrollText size={15} strokeWidth={2} />
            </button>
          </div>

          {combatField}
          {compactDock}
          {victoryOverlay}
        </div>

        {sheet ? (
          <div
            className="beast-path__sheet-backdrop"
            role="presentation"
            onClick={() => setSheet(null)}
          >
            <div
              className="beast-path__sheet"
              role="dialog"
              aria-modal="true"
              aria-label={sheetTitle}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="beast-path__sheet-head">
                <p>{sheetTitle}</p>
                <button
                  type="button"
                  className="beast-path__sheet-close"
                  aria-label={labels.ui.close}
                  onClick={() => setSheet(null)}
                >
                  <X size={14} strokeWidth={2.25} />
                </button>
              </div>
              <div className="beast-path__sheet-body">
                {sheet === "order" ? turnOrderList : logList}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="beast-path__battle">
      <div className="beast-path__battle-main">
        <h2 className="beast-path__title shrink-0 text-base font-bold">
          {titleText}
        </h2>
        <p className="mt-0.5 shrink-0 text-[10px] text-[var(--bp-muted)]">
          {phaseText}
        </p>

        {combatField}
        {desktopDock}
        {victoryOverlay}
      </div>

      <aside className="beast-path__battle-side">
        <p className="beast-path__title shrink-0 text-sm font-bold text-[var(--bp-gold)]">
          {labels.ui.gold}: {state.gold}
        </p>
        {planning || playback
          ? renderFightButton("w-full px-3 py-2 text-sm")
          : null}

        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--bp-muted)]">
            {labels.ui.turnOrder}
          </p>
          {turnOrderList}
        </div>

        <div className="beast-path__panel beast-path__log p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--bp-muted)]">
            {labels.ui.log}
          </p>
          <div className="mt-1.5">{logList}</div>
        </div>
      </aside>
    </div>
  );
}

export function BeastPathGame() {
  const { locale } = useLanguage();
  const labels = getLabels(locale);
  const { compact, portrait } = useLayoutMode();
  const [state, setState] = useState<RunState>(() => createRun(locale));
  const [starters, setStarters] = useState(() => getStarters(locale));
  const [sellOpen, setSellOpen] = useState(false);
  const [reserveOpen, setReserveOpen] = useState(false);
  const [reserveSwapParty, setReserveSwapParty] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);

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

  function restart() {
    setState(createRun(locale));
    setStarters(getStarters(locale));
    setSellOpen(false);
    setReserveOpen(false);
    setReserveSwapParty(null);
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
          compact ? "beast-path--compact" : "",
          compact && portrait ? "beast-path--portrait" : "",
        ].join(" ")}
      >
        {canFullscreen ? (
          <div className="beast-path__chrome-bar">
            <button
              type="button"
              className="beast-path__fullscreen-btn"
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
          </div>
        ) : null}
        {state.screen.kind !== "battle" ? (
          <PartyStrip
            party={state.party}
            labels={labels}
            gold={state.gold}
            compact={compact}
          />
        ) : null}

        <div
          className={[
            "beast-path__body",
            state.screen.kind !== "battle" ? "mt-3" : "",
          ].join(" ")}
        >
        {state.lastMessage ? (
          <p className="beast-path__panel mb-3 px-3 py-2 text-xs text-[var(--bp-muted)]">
            {state.lastMessage}
          </p>
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
                  onClick={() => setState(selectStarter(state, monster))}
                />
              ))}
            </div>
          </div>
        ) : null}

        {state.screen.kind === "map" ? (
          <div className="flex h-full min-h-0 flex-col gap-2">
            <div className="flex shrink-0 items-center justify-end gap-2">
              {compact ? (
                <div className="min-w-0 flex-1">
                  <MapLegend labels={labels} />
                </div>
              ) : null}
              <button
                type="button"
                className="beast-path__btn-ghost shrink-0 px-3 py-1.5 text-xs"
                onClick={() => setReserveOpen(true)}
              >
                {labels.ui.reserveOpen}
                {state.reserve.length > 0 ? ` (${state.reserve.length})` : ""}
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <MapView
                state={state}
                labels={labels}
                onSelect={(id) => setState(enterNode(state, id, locale))}
                axis={compact && portrait ? "vertical" : "horizontal"}
                compact={compact}
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
                  <div className="flex items-center justify-between gap-2">
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
                  <p className="mt-1 text-[11px] text-[var(--bp-muted)]">
                    {labels.ui.reserveHint}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
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
                            setState((s) =>
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
                                    setState((s) =>
                                      swapReserveIntoParty(
                                        s,
                                        m.uid,
                                        reserveSwapParty,
                                      ),
                                    );
                                    setReserveSwapParty(null);
                                    return;
                                  }
                                  setState((s) => moveReserveToParty(s, m.uid));
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
              onFightComplete={(battle) =>
                setState((s) => applyFightBattle(s, battle, locale))
              }
              onClaim={() =>
                setState((s) => claimBattleRewards(s, locale))
              }
              compact={compact}
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
                    {labels.shop[offer.labelKey]}
                    {offer.kind === "recruit" ? `: ${offer.monster.name}` : ""}
                  </p>
                  {offer.kind === "recruit" ? (
                    <p className="mt-1 text-xs text-[var(--bp-muted)]">
                      {labels.ui.level} {offer.monster.level} ·{" "}
                      {labels.elements[offer.monster.element]} · ATK{" "}
                      {offer.monster.atk}
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
                  setState(leaveShop(state));
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
              className="beast-path__modal"
              role="dialog"
              aria-modal="true"
              aria-label={labels.ui.shopSellTitle}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-sm font-semibold">{labels.ui.shopSellPick}</p>
              <p className="mt-1 text-[11px] text-[var(--bp-muted)]">
                {labels.ui.shopSellOnce}
              </p>
              <ul className="mt-3 grid grid-cols-1 gap-1.5">
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
                className="beast-path__btn-ghost mt-3 w-full px-3 py-1.5 text-xs"
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
              onClick={() => setState(takeRest(state, locale))}
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
                onClick={() => setState(continueFromEvent(state))}
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
              onClick={restart}
            >
              {labels.ui.newRun}
            </button>
          </div>
        ) : null}
        </div>
      </div>
    </GameChrome>
  );
}
