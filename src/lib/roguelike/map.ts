import { pickHabitat } from "./habitats";
import type { HabitatId, MapNode, NodeType, RunMap } from "./types";
import { MAP_COLUMNS } from "./types";

/** Deterministic map seed for a given run seed + path level. */
export function mapSeedForLevel(runSeed: number, level: number) {
  return (runSeed >>> 0) + Math.max(0, level - 1) * 1_000_003;
}

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

function inDegree(edges: Array<[number, number]>, toIdx: number) {
  return edges.reduce((n, [, j]) => n + (j === toIdx ? 1 : 0), 0);
}

/**
 * Connect adjacent columns with few merges.
 * Every source MUST get ≥1 outgoing edge so all routes reach the boss.
 * Targets prefer ≤2 incoming edges, but the cap yields if needed for connectivity.
 */
function connectColumns(
  from: MapNode[],
  to: MapNode[],
  rng: () => number,
) {
  const edges: Array<[number, number]> = [];
  const softMaxIn = 2;

  function tryLink(i: number, j: number, ignoreInCap: boolean) {
    if (wouldCross(edges, i, j)) return false;
    if (!ignoreInCap && inDegree(edges, j) >= softMaxIn) return false;
    if (edges.some(([a, b]) => a === i && b === j)) return false;
    edges.push([i, j]);
    return true;
  }

  function linkSource(i: number) {
    const prefer = Math.min(
      to.length - 1,
      Math.round((i * (to.length - 1)) / Math.max(1, from.length - 1)),
    );
    // Soft cap first, then ignore in-degree so the source never dead-ends.
    for (const ignoreInCap of [false, true]) {
      for (let di = 0; di < to.length; di += 1) {
        for (const j of [prefer - di, prefer + di]) {
          if (j < 0 || j >= to.length) continue;
          if (tryLink(i, j, ignoreInCap)) return;
        }
      }
    }
    // Absolute fallback (should be unreachable): link to prefer even if crossing.
    const j = prefer;
    if (!edges.some(([a, b]) => a === i && b === j)) {
      edges.push([i, j]);
    }
  }

  for (let i = 0; i < from.length; i += 1) {
    linkSource(i);
  }

  // Ensure every target has a parent (reachable from previous column).
  for (let j = 0; j < to.length; j += 1) {
    if (inDegree(edges, j) > 0) continue;
    const prefer = Math.min(
      from.length - 1,
      Math.round((j * (from.length - 1)) / Math.max(1, to.length - 1)),
    );
    let linked = false;
    for (const ignoreInCap of [false, true]) {
      for (let di = 0; di < from.length; di += 1) {
        for (const i of [prefer - di, prefer + di]) {
          if (i < 0 || i >= from.length) continue;
          if (tryLink(i, j, ignoreInCap)) {
            linked = true;
            break;
          }
        }
        if (linked) break;
      }
      if (linked) break;
    }
  }

  // Rare optional adjacent branches (only if target still has merge room).
  for (let i = 0; i < from.length; i += 1) {
    if (rng() > 0.16) continue;
    const current = edges.filter(([fi]) => fi === i).map(([, tj]) => tj);
    if (current.length === 0) continue;
    const base = current[0]!;
    for (const cand of [base - 1, base + 1]) {
      if (cand < 0 || cand >= to.length) continue;
      if (current.includes(cand)) continue;
      if (!tryLink(i, cand, false)) continue;
      break;
    }
  }

  for (const [i, j] of edges) {
    const id = to[j]!.id;
    if (!from[i]!.next.includes(id)) {
      from[i]!.next.push(id);
    }
  }
}

/** Safety net: no non-boss node may have an empty successor list. */
function ensureAllRoutesReachBoss(columns: MapNode[][]) {
  const bossId = columns[MAP_COLUMNS - 1]![0]!.id;

  for (let col = 0; col < MAP_COLUMNS - 1; col += 1) {
    const from = columns[col]!;
    const to = columns[col + 1]!;
    for (let i = 0; i < from.length; i += 1) {
      const node = from[i]!;
      // Drop dangling refs (shouldn't happen) and ensure ≥1 live successor.
      node.next = node.next.filter((id) => to.some((n) => n.id === id));
      if (node.next.length > 0) continue;
      const j = Math.min(
        to.length - 1,
        Math.round((i * (to.length - 1)) / Math.max(1, from.length - 1)),
      );
      node.next.push(to[j]!.id);
    }
  }

  // Pre-boss must only point at the boss.
  for (const node of columns[MAP_COLUMNS - 2]!) {
    node.next = [bossId];
  }
  columns[MAP_COLUMNS - 1]![0]!.next = [];
}

function parentsOf(
  columns: MapNode[][],
  col: number,
  nodeId: string,
): MapNode[] {
  if (col <= 0) return [];
  return columns[col - 1]!.filter((n) => n.next.includes(nodeId));
}

/** Max rests already on any start→node path (via parents' annotations). */
function maxRestsInto(
  restsOnPath: Map<string, number>,
  parents: MapNode[],
) {
  if (parents.length === 0) return 0;
  return Math.max(...parents.map((p) => restsOnPath.get(p.id) ?? 0));
}

function pickType(args: {
  rng: () => number;
  column: number;
  prevHadRest: boolean;
  prevHadShop: boolean;
  restsOnIncoming: number;
  preferRestOverElite: boolean;
}): NodeType {
  const {
    rng,
    column,
    prevHadRest,
    prevHadShop,
    restsOnIncoming,
    preferRestOverElite,
  } = args;

  if (column === 0) return "start";
  if (column === MAP_COLUMNS - 1) return "boss";
  if (column === MAP_COLUMNS - 2) return "rest";

  const allowRest =
    column >= 5 &&
    !prevHadRest &&
    restsOnIncoming < 2 && // +1 here, +1 mandatory pre-boss ⇒ ≤3 on a full path
    column !== MAP_COLUMNS - 3;
  const allowShop = !prevHadShop && column >= 4;

  // Early path: fights, wilds, events (no shop / rest).
  if (column <= 3) {
    const roll = rng();
    if (roll < 0.4) return "battle";
    if (roll < 0.7) return "habitat";
    if (roll < 0.9) return "event";
    return "battle";
  }

  // Mid / late. Elites from col 5+, but sometimes rest instead before an elite.
  const roll = rng();
  if (column >= 5 && roll < 0.19) {
    if (preferRestOverElite && allowRest && rng() < 0.5) return "rest";
    return "elite";
  }
  if (roll < 0.3) return "battle";
  if (roll < 0.52) return "habitat";
  if (roll < 0.72) return "event";
  if (roll < 0.84 && allowRest) return "rest";
  if (allowShop) return "shop";
  if (allowRest && rng() < 0.35) return "rest";
  return rng() < 0.55 ? "battle" : "event";
}

function allPaths(map: RunMap): string[][] {
  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  const paths: string[][] = [];
  function walk(id: string, acc: string[]) {
    const node = byId.get(id);
    if (!node) return;
    const nextAcc = [...acc, id];
    if (node.next.length === 0) {
      paths.push(nextAcc);
      return;
    }
    for (const nxt of node.next) walk(nxt, nextAcc);
  }
  walk(map.startId, []);
  return paths;
}

function rebalanceQuotas(map: RunMap, rng: () => number) {
  const byId = new Map(map.nodes.map((n) => [n.id, n] as const));
  const paths = allPaths(map);

  const countType = (ids: MapNode[], type: NodeType) =>
    ids.filter((n) => n.type === type).length;

  const midNode = (n: MapNode) =>
    n.column > 0 && n.column < MAP_COLUMNS - 2;

  for (let iter = 0; iter < 10; iter += 1) {
    let changed = false;

    for (const pathIds of paths) {
      const path = pathIds.map((id) => byId.get(id)!);

      // Habitat minimum 2
      let h = countType(path, "habitat");
      while (h < 2) {
        const cand = path.filter(
          (n) =>
            midNode(n) &&
            (n.type === "battle" || n.type === "event" || n.type === "shop"),
        );
        if (cand.length === 0) break;
        const pick = cand[Math.floor(rng() * cand.length)]!;
        pick.type = "habitat";
        pick.habitat = pickHabitat(rng);
        h += 1;
        changed = true;
      }

      // Habitat maximum 5
      h = countType(path, "habitat");
      while (h > 5) {
        const cand = path.filter((n) => midNode(n) && n.type === "habitat");
        if (cand.length === 0) break;
        // Prefer dropping habitats that keep other paths ≥2.
        let pick = cand[0]!;
        for (const c of cand) {
          const ok = paths.every((pids) => {
            if (!pids.includes(c.id)) return true;
            const nodes = pids.map((id) => byId.get(id)!);
            const count =
              countType(nodes, "habitat") - (c.type === "habitat" ? 1 : 0);
            return count >= 2;
          });
          if (ok) {
            pick = c;
            break;
          }
        }
        pick.type = "battle";
        pick.habitat = undefined;
        h -= 1;
        changed = true;
      }

      // Events soft target ~3 (clamp 2–4)
      let e = countType(path, "event");
      while (e < 2) {
        const cand = path.filter((n) => midNode(n) && n.type === "battle");
        if (cand.length === 0) break;
        const pick = cand[Math.floor(rng() * cand.length)]!;
        pick.type = "event";
        pick.habitat = undefined;
        e += 1;
        changed = true;
      }
      e = countType(path, "event");
      while (e > 4) {
        const cand = path.filter((n) => midNode(n) && n.type === "event");
        if (cand.length === 0) break;
        const pick = cand[Math.floor(rng() * cand.length)]!;
        pick.type = "battle";
        e -= 1;
        changed = true;
      }
    }

    if (!changed) break;
  }

  for (const node of map.nodes) {
    if (node.type === "habitat") {
      node.habitat = node.habitat ?? pickHabitat(rng);
    } else {
      node.habitat = undefined;
    }
  }
}

export function generateMap(seed: number): RunMap {
  const rng = mulberry32(seed);
  const nodes: MapNode[] = [];
  const columns: MapNode[][] = [];
  const restsOnPath = new Map<string, number>();

  for (let col = 0; col < MAP_COLUMNS; col += 1) {
    const prev = col > 0 ? columns[col - 1]! : [];
    const prevHadRest = prev.some((n) => n.type === "rest");
    const prevHadShop = prev.some((n) => n.type === "shop");
    const count =
      col === 0 || col === MAP_COLUMNS - 1
        ? 1
        : col === MAP_COLUMNS - 2
          ? 2 + (rng() > 0.55 ? 1 : 0)
          : 2 + Math.floor(rng() * 3); // 2–4 parallel paths (fewer merges)
    const lanes = lanesForColumn(col, Math.min(MAP_LANES, count));

    // Placeholder nodes first (types filled after we know parents via a two-step
    // for typed columns: create empty then we'd need edges first).
    // Instead: create nodes without next, connect after all columns exist for
    // structure-only, then assign types. Cleaner: create structure with types
    // using prev column only (parents not yet linked). Use prev column rest/shop
    // flags; restsOnIncoming approximated from prev nodes' rest annotations
    // after we link — so assign types AFTER connect for mid columns.
    const colNodes: MapNode[] = lanes.map((lane, rowIdx) => ({
      id: `n-${col}-${rowIdx}`,
      column: col,
      row: lane,
      type: "battle" as NodeType,
      habitat: undefined as HabitatId | undefined,
      next: [] as string[],
    }));
    columns.push(colNodes);
    nodes.push(...colNodes);
  }

  for (let col = 0; col < MAP_COLUMNS - 1; col += 1) {
    connectColumns(columns[col]!, columns[col + 1]!, rng);
  }
  ensureAllRoutesReachBoss(columns);

  // Assign types column by column with path-aware rest caps.
  for (let col = 0; col < MAP_COLUMNS; col += 1) {
    const prev = col > 0 ? columns[col - 1]! : [];
    const prevHadRest = prev.some((n) => n.type === "rest");
    const prevHadShop = prev.some((n) => n.type === "shop");

    for (const node of columns[col]!) {
      const parents = parentsOf(columns, col, node.id);
      const restsIn = maxRestsInto(restsOnPath, parents);
      const type = pickType({
        rng,
        column: col,
        prevHadRest,
        prevHadShop,
        restsOnIncoming: restsIn,
        preferRestOverElite: true,
      });
      node.type = type;
      node.habitat = type === "habitat" ? pickHabitat(rng) : undefined;
      const here = restsIn + (type === "rest" ? 1 : 0);
      restsOnPath.set(node.id, here);
    }
  }

  // Fixed anchors (override any drift).
  columns[0]![0]!.type = "start";
  columns[0]![0]!.habitat = undefined;
  restsOnPath.set(columns[0]![0]!.id, 0);

  const preBoss = columns[MAP_COLUMNS - 2]!;
  for (const node of preBoss) {
    node.type = "rest";
    node.habitat = undefined;
    const parents = parentsOf(columns, MAP_COLUMNS - 2, node.id);
    restsOnPath.set(
      node.id,
      maxRestsInto(restsOnPath, parents) + 1,
    );
  }

  const boss = columns[MAP_COLUMNS - 1]![0]!;
  boss.type = "boss";
  boss.habitat = undefined;

  const map: RunMap = {
    nodes,
    startId: columns[0]![0]!.id,
    bossId: boss.id,
  };

  rebalanceQuotas(map, rng);
  return map;
}

export function getNode(map: RunMap, id: string) {
  return map.nodes.find((n) => n.id === id);
}
