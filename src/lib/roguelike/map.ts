import { pickHabitat } from "./habitats";
import type { HabitatId, MapNode, NodeType, RunMap } from "./types";
import { MAP_COLUMNS } from "./types";

/** Fixed vertical lanes so paths stay tidy and never need to cross. */
export const MAP_LANES = 5;

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickType(
  rng: () => number,
  column: number,
  prevHadRest: boolean,
): NodeType {
  if (column === 0) return "start";
  if (column === MAP_COLUMNS - 1) return "boss";
  // Always a rest site immediately before the boss.
  if (column === MAP_COLUMNS - 2) return "rest";
  // Column before that must not be rest, so heals never stack into the pre-boss rest.
  const allowRest = !prevHadRest && column !== MAP_COLUMNS - 3;

  // Early path: fights + wild habitats + light events (no shop)
  if (column <= 2) {
    const roll = rng();
    if (roll < 0.52) return "battle";
    if (roll < 0.78) return "habitat";
    return "event";
  }
  if (column === 3) {
    const roll = rng();
    if (roll < 0.4) return "battle";
    if (roll < 0.62) return "habitat";
    if (roll < 0.82) return "event";
    return allowRest ? "rest" : "battle";
  }

  // Mid / late: shops from col 4+, elites from col 5+
  const roll = rng();
  if (column >= 5 && roll < 0.12) return "elite";
  if (roll < 0.34) return "battle";
  if (roll < 0.52) return "habitat";
  if (roll < 0.66) return "event";
  if (roll < 0.78 && allowRest) return "rest";
  if (column >= 4) return "shop";
  return "event";
}

function lanesForColumn(col: number, count: number): number[] {
  if (col === 0 || col === MAP_COLUMNS - 1) return [2];
  if (count <= 1) return [2];
  if (count === 2) return [1, 3];
  if (count === 3) return [0, 2, 4];
  if (count === 4) return [0, 1, 3, 4];
  return [0, 1, 2, 3, 4];
}

function wouldCross(
  edges: Array<[number, number]>,
  fromIdx: number,
  toIdx: number,
) {
  return edges.some(
    ([a, b]) => (a < fromIdx && b > toIdx) || (a > fromIdx && b < toIdx),
  );
}

function connectColumns(
  from: MapNode[],
  to: MapNode[],
  rng: () => number,
) {
  const edges: Array<[number, number]> = [];

  // Each source gets one primary target (proportional, non-crossing).
  for (let i = 0; i < from.length; i += 1) {
    const j = Math.min(
      to.length - 1,
      Math.round((i * (to.length - 1)) / Math.max(1, from.length - 1)),
    );
    if (!wouldCross(edges, i, j)) {
      edges.push([i, j]);
    }
  }

  // Every target needs at least one parent.
  for (let j = 0; j < to.length; j += 1) {
    if (edges.some(([, tj]) => tj === j)) continue;
    const i = Math.min(
      from.length - 1,
      Math.round((j * (from.length - 1)) / Math.max(1, to.length - 1)),
    );
    if (!wouldCross(edges, i, j)) {
      edges.push([i, j]);
    } else {
      // Fall back to nearest non-crossing parent.
      for (let di = 0; di < from.length; di += 1) {
        const left = i - di;
        const right = i + di;
        if (left >= 0 && !wouldCross(edges, left, j)) {
          edges.push([left, j]);
          break;
        }
        if (right < from.length && !wouldCross(edges, right, j)) {
          edges.push([right, j]);
          break;
        }
      }
    }
  }

  // Sparse optional branches: only adjacent targets, never crossing.
  for (let i = 0; i < from.length; i += 1) {
    if (rng() > 0.4) continue;
    const current = edges.filter(([fi]) => fi === i).map(([, tj]) => tj);
    if (current.length === 0) continue;
    const base = current[0];
    for (const cand of [base - 1, base + 1]) {
      if (cand < 0 || cand >= to.length) continue;
      if (current.includes(cand)) continue;
      if (wouldCross(edges, i, cand)) continue;
      edges.push([i, cand]);
      break;
    }
  }

  for (const [i, j] of edges) {
    const id = to[j].id;
    if (!from[i].next.includes(id)) {
      from[i].next.push(id);
    }
  }
}

export function generateMap(seed: number): RunMap {
  const rng = mulberry32(seed);
  const nodes: MapNode[] = [];
  const columns: MapNode[][] = [];

  for (let col = 0; col < MAP_COLUMNS; col += 1) {
    const prevHadRest =
      col > 0 && columns[col - 1].some((n) => n.type === "rest");
    const count =
      col === 0 || col === MAP_COLUMNS - 1
        ? 1
        : col === MAP_COLUMNS - 2
          ? 2 + (rng() > 0.5 ? 1 : 0)
          : 2 + Math.floor(rng() * 4); // 2–5 parallel paths
    const lanes = lanesForColumn(col, Math.min(MAP_LANES, count));
    const colNodes: MapNode[] = lanes.map((lane, rowIdx) => {
      const type = pickType(rng, col, prevHadRest);
      const habitat: HabitatId | undefined =
        type === "habitat" ? pickHabitat(rng) : undefined;
      return {
        id: `n-${col}-${rowIdx}`,
        column: col,
        row: lane,
        type,
        habitat,
        next: [],
      };
    });
    columns.push(colNodes);
    nodes.push(...colNodes);
  }

  for (let col = 0; col < MAP_COLUMNS - 1; col += 1) {
    connectColumns(columns[col], columns[col + 1], rng);
  }

  return {
    nodes,
    startId: columns[0][0].id,
    bossId: columns[MAP_COLUMNS - 1][0].id,
  };
}

export function getNode(map: RunMap, id: string) {
  return map.nodes.find((n) => n.id === id);
}
