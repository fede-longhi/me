/**
 * Voronoi lampshade: 2D Voronoi on a cylindrical unwrap → 3D struts + rims.
 * Z-up (print orientation); XY is the horizontal plane.
 */

import { Delaunay } from "d3-delaunay";
import { pushQuad, StlWriter, stlTriangleCount } from "@/lib/stl-writer";
import { downloadArrayBuffer, slugifyLabel } from "@/lib/map-stl";

export type VoronoiShadeShape = "cylinder" | "cone";

export type VoronoiShadeParams = {
  shape: VoronoiShadeShape;
  heightMm: number;
  radiusTopMm: number;
  radiusBottomMm: number;
  wallMm: number;
  cellCount: number;
  strutWidthMm: number;
  seed: number;
  solidTop: boolean;
  solidBottom: boolean;
};

export const DEFAULT_VORONOI_SHADE_PARAMS: VoronoiShadeParams = {
  shape: "cylinder",
  heightMm: 120,
  radiusTopMm: 60,
  radiusBottomMm: 60,
  wallMm: 1.2,
  cellCount: 48,
  strutWidthMm: 1.6,
  seed: 42,
  solidTop: true,
  solidBottom: true,
};

export type VoronoiPreview = {
  width: number;
  height: number;
  edges: Array<[[number, number], [number, number]]>;
  seeds: Array<[number, number]>;
};

type Vec3 = [number, number, number];

function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function radiusAt(
  y: number,
  height: number,
  radiusBottom: number,
  radiusTop: number,
): number {
  const t = Math.max(0, Math.min(1, y / height));
  return radiusBottom + (radiusTop - radiusBottom) * t;
}

function mapUnwrapTo3D(
  x: number,
  y: number,
  circumference: number,
  height: number,
  radiusBottom: number,
  radiusTop: number,
  radialScale: number,
): Vec3 {
  const phi = (x / circumference) * Math.PI * 2;
  const r = radiusAt(y, height, radiusBottom, radiusTop) * radialScale;
  return [r * Math.cos(phi), r * Math.sin(phi), y];
}

function edgeKey(ax: number, ay: number, bx: number, by: number): string {
  const a = `${ax.toFixed(3)},${ay.toFixed(3)}`;
  const b = `${bx.toFixed(3)},${by.toFixed(3)}`;
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function generateSeeds(
  count: number,
  width: number,
  height: number,
  margin: number,
  seed: number,
): Float64Array {
  const rand = mulberry32(seed);
  const points = new Float64Array(count * 2);
  for (let i = 0; i < count; i += 1) {
    points[i * 2] = margin + rand() * (width - margin * 2);
    points[i * 2 + 1] = margin + rand() * (height - margin * 2);
  }
  return points;
}

/** Duplicate seeds near seams for a cleaner cylindrical wrap. */
function seedsWithWrap(
  points: Float64Array,
  width: number,
): Float64Array {
  const wrapBand = width * 0.08;
  const extras: number[] = [];
  for (let i = 0; i < points.length; i += 2) {
    const x = points[i]!;
    const y = points[i + 1]!;
    if (x < wrapBand) {
      extras.push(x + width, y);
    } else if (x > width - wrapBand) {
      extras.push(x - width, y);
    }
  }
  if (extras.length === 0) return points;
  const merged = new Float64Array(points.length + extras.length);
  merged.set(points);
  for (let i = 0; i < extras.length; i += 1) {
    merged[points.length + i] = extras[i]!;
  }
  return merged;
}

function delaunayFromFlat(points: Float64Array): Delaunay {
  const count = points.length / 2;
  const pairs: [number, number][] = new Array(count);
  for (let i = 0; i < count; i += 1) {
    pairs[i] = [points[i * 2]!, points[i * 2 + 1]!];
  }
  return Delaunay.from(pairs);
}

export function buildVoronoiPreview(
  params: VoronoiShadeParams,
): VoronoiPreview {
  const height = params.heightMm;
  const avgRadius = (params.radiusTopMm + params.radiusBottomMm) / 2;
  const width = Math.PI * 2 * avgRadius;
  const margin = Math.max(params.strutWidthMm * 2, 4);
  const base = generateSeeds(
    params.cellCount,
    width,
    height,
    margin,
    params.seed,
  );
  const points = seedsWithWrap(base, width);
  const delaunay = delaunayFromFlat(points);
  const voronoi = delaunay.voronoi([0, 0, width, height]);

  const edges: VoronoiPreview["edges"] = [];
  const seen = new Set<string>();
  const seeds: Array<[number, number]> = [];
  for (let i = 0; i < base.length; i += 2) {
    seeds.push([base[i]!, base[i + 1]!]);
  }

  const pointCount = points.length / 2;
  for (let i = 0; i < pointCount; i += 1) {
    const poly = voronoi.cellPolygon(i);
    if (!poly || poly.length < 2) continue;
    for (let j = 0; j < poly.length; j += 1) {
      const a = poly[j]!;
      const b = poly[(j + 1) % poly.length]!;
      const key = edgeKey(a[0], a[1], b[0], b[1]);
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push([
        [a[0], a[1]],
        [b[0], b[1]],
      ]);
    }
  }

  return { width, height, edges, seeds };
}

function addStrut(
  writer: StlWriter,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  halfWidth: number,
  circumference: number,
  height: number,
  radiusBottom: number,
  radiusTop: number,
  wallMm: number,
) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return;

  const px = (-dy / len) * halfWidth;
  const py = (dx / len) * halfWidth;

  const corners = [
    [ax + px, ay + py],
    [ax - px, ay - py],
    [bx - px, by - py],
    [bx + px, by + py],
  ] as const;

  const outer = corners.map(([x, y]) =>
    mapUnwrapTo3D(x, y, circumference, height, radiusBottom, radiusTop, 1),
  );
  const inner = corners.map(([x, y]) =>
    mapUnwrapTo3D(
      x,
      y,
      circumference,
      height,
      radiusBottom,
      radiusTop,
      Math.max(1 - wallMm / radiusAt(y, height, radiusBottom, radiusTop), 0.55),
    ),
  );

  // Top face (outer)
  pushQuad(writer, outer[0]!, outer[1]!, outer[2]!, outer[3]!);
  // Bottom face (inner) — reverse winding
  pushQuad(writer, inner[0]!, inner[3]!, inner[2]!, inner[1]!);

  for (let i = 0; i < 4; i += 1) {
    const j = (i + 1) % 4;
    pushQuad(writer, outer[i]!, outer[j]!, inner[j]!, inner[i]!);
  }
}

function addRing(
  writer: StlWriter,
  z: number,
  radiusBottom: number,
  radiusTop: number,
  height: number,
  wallMm: number,
  segments: number,
) {
  const rOuter = radiusAt(z, height, radiusBottom, radiusTop);
  const rInner = Math.max(rOuter - wallMm, rOuter * 0.55);
  for (let i = 0; i < segments; i += 1) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const o0: Vec3 = [rOuter * Math.cos(a0), rOuter * Math.sin(a0), z];
    const o1: Vec3 = [rOuter * Math.cos(a1), rOuter * Math.sin(a1), z];
    const i0: Vec3 = [rInner * Math.cos(a0), rInner * Math.sin(a0), z];
    const i1: Vec3 = [rInner * Math.cos(a1), rInner * Math.sin(a1), z];
    if (z > 0) {
      pushQuad(writer, o0, o1, i1, i0);
    } else {
      pushQuad(writer, o0, i0, i1, o1);
    }
  }
}

function addDisk(
  writer: StlWriter,
  z: number,
  radiusBottom: number,
  radiusTop: number,
  height: number,
  segments: number,
  holeRadius: number,
) {
  const rOuter = radiusAt(z, height, radiusBottom, radiusTop);
  const rInner = Math.min(holeRadius, rOuter * 0.35);
  for (let i = 0; i < segments; i += 1) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const o0: Vec3 = [rOuter * Math.cos(a0), rOuter * Math.sin(a0), z];
    const o1: Vec3 = [rOuter * Math.cos(a1), rOuter * Math.sin(a1), z];
    const i0: Vec3 = [rInner * Math.cos(a0), rInner * Math.sin(a0), z];
    const i1: Vec3 = [rInner * Math.cos(a1), rInner * Math.sin(a1), z];
    if (z > 0) {
      pushQuad(writer, o0, o1, i1, i0);
    } else {
      pushQuad(writer, o0, i0, i1, o1);
    }
  }
}

export function generateVoronoiShade(params: VoronoiShadeParams): {
  buffer: ArrayBuffer;
  triangles: number;
  preview: VoronoiPreview;
} {
  const height = Math.max(20, params.heightMm);
  const radiusBottom = Math.max(15, params.radiusBottomMm);
  const radiusTop = Math.max(
    15,
    params.shape === "cone" ? params.radiusTopMm : params.radiusBottomMm,
  );
  const wall = Math.max(0.8, params.wallMm);
  const strutHalf = Math.max(0.4, params.strutWidthMm) / 2;
  const avgRadius = (radiusTop + radiusBottom) / 2;
  const circumference = Math.PI * 2 * avgRadius;
  const margin = Math.max(strutHalf * 3, 4);
  const cellCount = Math.max(12, Math.min(200, Math.round(params.cellCount)));

  const preview = buildVoronoiPreview({
    ...params,
    heightMm: height,
    radiusBottomMm: radiusBottom,
    radiusTopMm: radiusTop,
    wallMm: wall,
    cellCount,
  });

  const maxTris = preview.edges.length * 10 + 2048;
  const writer = new StlWriter(maxTris);
  const ringSegments = 72;

  for (const [[ax, ay], [bx, by]] of preview.edges) {
    addStrut(
      writer,
      ax,
      ay,
      bx,
      by,
      strutHalf,
      circumference,
      height,
      radiusBottom,
      radiusTop,
      wall,
    );
  }

  if (params.solidTop) {
    addRing(writer, height, radiusBottom, radiusTop, height, wall, ringSegments);
  }
  if (params.solidBottom) {
    addRing(writer, 0, radiusBottom, radiusTop, height, wall, ringSegments);
    addDisk(
      writer,
      0,
      radiusBottom,
      radiusTop,
      height,
      ringSegments,
      avgRadius * 0.45,
    );
  }

  const buffer = writer.finish();
  return {
    buffer,
    triangles: stlTriangleCount(buffer),
    preview,
  };
}

export function voronoiShadeFilename(shape: string): string {
  return `${slugifyLabel(shape) || "voronoi"}-shade.stl`;
}

export { downloadArrayBuffer, stlTriangleCount };
