/** Geographic helpers + elevation sampling + STL mesh export for map terrain. */

export type LatLng = { lat: number; lng: number };

export type MapSelection =
  | {
      kind: "rectangle";
      south: number;
      west: number;
      north: number;
      east: number;
    }
  | {
      kind: "circle";
      center: LatLng;
      radiusM: number;
    }
  | {
      kind: "ellipse";
      center: LatLng;
      radiusXM: number;
      radiusYM: number;
    }
  | {
      kind: "polygon";
      name: string;
      /** Each polygon is [outerRing, ...holeRings]. */
      polygons: LatLng[][][];
    };

export type HeightGrid = {
  cols: number;
  rows: number;
  /** Row-major elevations in meters. NaN = outside selection mask. */
  values: Float32Array;
  min: number;
  max: number;
  /** Ground size in meters (width x depth of the sampled bbox). */
  widthM: number;
  depthM: number;
  /** Sampled geographic bbox (same mapping as the height grid). */
  bounds: { south: number; west: number; north: number; east: number };
  /** Original selection — used to snap the mesh silhouette to the true boundary. */
  selection: MapSelection;
};

const EARTH_RADIUS_M = 6378137;

export function latLngToMeters(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng + 180) / 360) * (2 * Math.PI * EARTH_RADIUS_M);
  const y =
    Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 180 / 2)) * EARTH_RADIUS_M;
  return { x, y };
}

export function metersPerDegreeLat(lat: number): number {
  return (
    (Math.PI / 180) *
    EARTH_RADIUS_M *
    (1 -
      0.00669438 * Math.sin((lat * Math.PI) / 180) ** 2) **
      1.5
  );
}

export function metersPerDegreeLng(lat: number): number {
  return (
    ((Math.PI / 180) * EARTH_RADIUS_M * Math.cos((lat * Math.PI) / 180)) /
    Math.sqrt(1 - 0.00669438 * Math.sin((lat * Math.PI) / 180) ** 2)
  );
}

export function selectionBounds(selection: MapSelection): {
  south: number;
  west: number;
  north: number;
  east: number;
} {
  if (selection.kind === "rectangle") {
    return {
      south: Math.min(selection.south, selection.north),
      west: Math.min(selection.west, selection.east),
      north: Math.max(selection.south, selection.north),
      east: Math.max(selection.west, selection.east),
    };
  }

  if (selection.kind === "polygon") {
    let south = Number.POSITIVE_INFINITY;
    let north = Number.NEGATIVE_INFINITY;
    let west = Number.POSITIVE_INFINITY;
    let east = Number.NEGATIVE_INFINITY;
    for (const polygon of selection.polygons) {
      for (const ring of polygon) {
        for (const p of ring) {
          if (p.lat < south) south = p.lat;
          if (p.lat > north) north = p.lat;
          if (p.lng < west) west = p.lng;
          if (p.lng > east) east = p.lng;
        }
      }
    }
    if (!Number.isFinite(south)) {
      return { south: 0, west: 0, north: 0, east: 0 };
    }
    return { south, west, north, east };
  }

  const { center } = selection;
  const mLat = metersPerDegreeLat(center.lat);
  const mLng = metersPerDegreeLng(center.lat);

  if (selection.kind === "circle") {
    const dLat = selection.radiusM / mLat;
    const dLng = selection.radiusM / mLng;
    return {
      south: center.lat - dLat,
      north: center.lat + dLat,
      west: center.lng - dLng,
      east: center.lng + dLng,
    };
  }

  const dLat = selection.radiusYM / mLat;
  const dLng = selection.radiusXM / mLng;
  return {
    south: center.lat - dLat,
    north: center.lat + dLat,
    west: center.lng - dLng,
    east: center.lng + dLng,
  };
}

export function selectionSpanKm(selection: MapSelection): {
  widthKm: number;
  depthKm: number;
} {
  const b = selectionBounds(selection);
  const midLat = (b.south + b.north) / 2;
  return {
    widthKm:
      (Math.abs(b.east - b.west) * metersPerDegreeLng(midLat)) / 1000,
    depthKm:
      (Math.abs(b.north - b.south) * metersPerDegreeLat(midLat)) / 1000,
  };
}

function ringAreaM2(ring: LatLng[]): number {
  if (ring.length < 3) return 0;
  const lat0 = ring[0]!.lat;
  const mLat = metersPerDegreeLat(lat0);
  const mLng = metersPerDegreeLng(lat0);
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const a = ring[i]!;
    const b = ring[i + 1]!;
    const x1 = a.lng * mLng;
    const y1 = a.lat * mLat;
    const x2 = b.lng * mLng;
    const y2 = b.lat * mLat;
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

/** Approximate selection area in km² (planar at local latitude). */
export function selectionAreaKm2(selection: MapSelection): number {
  if (selection.kind === "circle") {
    return Math.PI * (selection.radiusM / 1000) ** 2;
  }
  if (selection.kind === "ellipse") {
    return Math.PI * (selection.radiusXM / 1000) * (selection.radiusYM / 1000);
  }
  if (selection.kind === "rectangle") {
    const span = selectionSpanKm(selection);
    return span.widthKm * span.depthKm;
  }
  let areaM2 = 0;
  for (const poly of selection.polygons) {
    const outer = poly[0];
    if (!outer) continue;
    areaM2 += Math.abs(ringAreaM2(outer));
    for (let i = 1; i < poly.length; i += 1) {
      areaM2 -= Math.abs(ringAreaM2(poly[i]!));
    }
  }
  return areaM2 / 1e6;
}

/** Ray-casting PIP for one ring (outer or hole). */
function pointInRing(lat: number, lng: number, ring: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const yi = ring[i]!.lat;
    const xi = ring[i]!.lng;
    const yj = ring[j]!.lat;
    const xj = ring[j]!.lng;
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** True if inside any polygon’s outer and not inside that polygon’s holes. */
export function pointInPolygon(
  lat: number,
  lng: number,
  polygons: LatLng[][][],
): boolean {
  for (const polygon of polygons) {
    const outer = polygon[0];
    if (!outer || outer.length < 3) continue;
    if (!pointInRing(lat, lng, outer)) continue;
    let inHole = false;
    for (let i = 1; i < polygon.length; i += 1) {
      const hole = polygon[i];
      if (hole && hole.length >= 3 && pointInRing(lat, lng, hole)) {
        inHole = true;
        break;
      }
    }
    if (!inHole) return true;
  }
  return false;
}

export function pointInSelection(
  lat: number,
  lng: number,
  selection: MapSelection,
): boolean {
  if (selection.kind === "rectangle") {
    const b = selectionBounds(selection);
    return lat >= b.south && lat <= b.north && lng >= b.west && lng <= b.east;
  }

  if (selection.kind === "polygon") {
    return pointInPolygon(lat, lng, selection.polygons);
  }

  const { center } = selection;
  const mLat = metersPerDegreeLat(center.lat);
  const mLng = metersPerDegreeLng(center.lat);
  const dx = (lng - center.lng) * mLng;
  const dy = (lat - center.lat) * mLat;

  if (selection.kind === "circle") {
    return dx * dx + dy * dy <= selection.radiusM * selection.radiusM;
  }

  const nx = dx / selection.radiusXM;
  const ny = dy / selection.radiusYM;
  return nx * nx + ny * ny <= 1;
}

export function selectionDisplayName(selection: MapSelection): string {
  if (selection.kind === "polygon") return selection.name;
  if (selection.kind === "rectangle") return "Rectangle";
  if (selection.kind === "circle") return "Circle";
  return "Ellipse";
}

/** Approximate any selection as polygon rings (for unions / freehand merge). */
export function selectionToPolygons(selection: MapSelection): LatLng[][][] {
  if (selection.kind === "polygon") return selection.polygons;

  if (selection.kind === "rectangle") {
    const b = selectionBounds(selection);
    return [
      [
        [
          { lat: b.south, lng: b.west },
          { lat: b.south, lng: b.east },
          { lat: b.north, lng: b.east },
          { lat: b.north, lng: b.west },
          { lat: b.south, lng: b.west },
        ],
      ],
    ];
  }

  const ring: LatLng[] = [];
  const steps = 64;
  const { center } = selection;
  const mLat = metersPerDegreeLat(center.lat);
  const mLng = metersPerDegreeLng(center.lat);
  const rx =
    selection.kind === "circle" ? selection.radiusM : selection.radiusXM;
  const ry =
    selection.kind === "circle" ? selection.radiusM : selection.radiusYM;
  for (let i = 0; i <= steps; i += 1) {
    const a = (i / steps) * Math.PI * 2;
    ring.push({
      lat: center.lat + (Math.sin(a) * ry) / mLat,
      lng: center.lng + (Math.cos(a) * rx) / mLng,
    });
  }
  return [[ring]];
}

/** Union two selections into one multipolygon (OR mask). */
export function mergeSelections(
  a: MapSelection,
  b: MapSelection,
  name?: string,
): MapSelection {
  const polygons = [
    ...selectionToPolygons(a),
    ...selectionToPolygons(b),
  ];
  return {
    kind: "polygon",
    name:
      name ??
      `${selectionDisplayName(a)} + ${selectionDisplayName(b)}`,
    polygons,
  };
}

export function expandBoundsByKm(
  bounds: { south: number; west: number; north: number; east: number },
  km: number,
): { south: number; west: number; north: number; east: number } {
  const midLat = (bounds.south + bounds.north) / 2;
  const dLat = (km * 1000) / metersPerDegreeLat(midLat);
  const dLng = (km * 1000) / metersPerDegreeLng(midLat);
  return {
    south: bounds.south - dLat,
    north: bounds.north + dLat,
    west: bounds.west - dLng,
    east: bounds.east + dLng,
  };
}

export type WaterMode = "keep" | "exclude" | "include";

/** Remove seas/oceans connected to the grid border (elev ≤ seaLevel). */
export function excludeExteriorWater(
  values: Float32Array,
  cols: number,
  rows: number,
  seaLevel = 0.5,
): Float32Array {
  const out = new Float32Array(values);
  const isWater = (i: number) => {
    const v = out[i];
    return v !== undefined && !Number.isNaN(v) && v <= seaLevel;
  };

  const visited = new Uint8Array(out.length);
  const queue: number[] = [];
  const push = (col: number, row: number) => {
    if (col < 0 || col >= cols || row < 0 || row >= rows) return;
    const i = row * cols + col;
    if (visited[i] || !isWater(i)) return;
    visited[i] = 1;
    queue.push(i);
  };

  for (let col = 0; col < cols; col += 1) {
    push(col, 0);
    push(col, rows - 1);
  }
  for (let row = 0; row < rows; row += 1) {
    push(0, row);
    push(cols - 1, row);
  }

  while (queue.length > 0) {
    const i = queue.pop()!;
    out[i] = Number.NaN;
    const row = Math.floor(i / cols);
    const col = i - row * cols;
    push(col - 1, row);
    push(col + 1, row);
    push(col, row - 1);
    push(col, row + 1);
  }
  return out;
}

export class SampleAbortedError extends Error {
  constructor() {
    super("Sampling aborted");
    this.name = "SampleAbortedError";
  }
}

/** Web mercator tile helpers for AWS Terrarium elevation tiles. */
export function latLngToTile(lat: number, lng: number, zoom: number) {
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );
  return { x, y, z: zoom };
}

export function terrariumToElevation(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

type TileCache = Map<string, ImageData>;

async function loadTerrariumTile(
  z: number,
  x: number,
  y: number,
  cache: TileCache,
  signal?: AbortSignal,
): Promise<ImageData> {
  const key = `${z}/${x}/${y}`;
  const hit = cache.get(key);
  if (hit) return hit;

  if (signal?.aborted) throw new SampleAbortedError();

  const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Elevation tile failed (${res.status})`);
  }
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  cache.set(key, data);
  bitmap.close();
  return data;
}

async function elevationAtGlobalPixel(
  zoom: number,
  gx: number,
  gy: number,
  cache: TileCache,
  signal?: AbortSignal,
): Promise<number> {
  const n = 2 ** zoom;
  const tileSize = 256;
  let tx = Math.floor(gx / tileSize);
  let ty = Math.floor(gy / tileSize);
  let px = gx - tx * tileSize;
  let py = gy - ty * tileSize;

  tx = ((tx % n) + n) % n;
  ty = Math.min(n - 1, Math.max(0, ty));
  px = Math.min(tileSize - 1, Math.max(0, px));
  py = Math.min(tileSize - 1, Math.max(0, py));

  const tile = await loadTerrariumTile(zoom, tx, ty, cache, signal);
  const i = (py * tile.width + px) * 4;
  return terrariumToElevation(
    tile.data[i] ?? 0,
    tile.data[i + 1] ?? 0,
    tile.data[i + 2] ?? 0,
  );
}

/** Bilinear sample in elevación (suaviza el escalonado por píxel). */
async function elevationAtLatLng(
  lat: number,
  lng: number,
  zoom: number,
  cache: TileCache,
  signal?: AbortSignal,
): Promise<number> {
  const n = 2 ** zoom;
  const x = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  const gx = x * 256;
  const gy = y * 256;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const fx = gx - x0;
  const fy = gy - y0;

  const z00 = await elevationAtGlobalPixel(zoom, x0, y0, cache, signal);
  const z10 = await elevationAtGlobalPixel(zoom, x1, y0, cache, signal);
  const z01 = await elevationAtGlobalPixel(zoom, x0, y1, cache, signal);
  const z11 = await elevationAtGlobalPixel(zoom, x1, y1, cache, signal);

  const z0 = z00 * (1 - fx) + z10 * fx;
  const z1 = z01 * (1 - fx) + z11 * fx;
  return z0 * (1 - fy) + z1 * fy;
}

/** 3×3 weighted blur on finite cells (reduces DEM terrace artifacts). */
function smoothHeightGrid(
  values: Float32Array,
  cols: number,
  rows: number,
  passes: number,
): Float32Array {
  let src = values;
  for (let pass = 0; pass < passes; pass += 1) {
    const dst = new Float32Array(src.length);
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const index = row * cols + col;
        const center = src[index];
        if (center === undefined || Number.isNaN(center)) {
          dst[index] = Number.NaN;
          continue;
        }
        let sum = 0;
        let weight = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const rr = row + dy;
            const cc = col + dx;
            if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) continue;
            const v = src[rr * cols + cc];
            if (v === undefined || Number.isNaN(v)) continue;
            const w = dx === 0 && dy === 0 ? 4 : dx === 0 || dy === 0 ? 2 : 1;
            sum += v * w;
            weight += w;
          }
        }
        dst[index] = weight > 0 ? sum / weight : center;
      }
    }
    src = dst;
  }
  return src;
}

export type SampleOptions = {
  resolution: number;
  zoom?: number;
  /** Elevation surface blur passes (independent from verticalScale). */
  terrainSmooth?: number;
  /** How to treat exterior seas/oceans in the model. */
  waterMode?: WaterMode;
  /** Offshore pad when waterMode is "include" (km). */
  waterBufferKm?: number;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
};

export async function sampleElevationGrid(
  selection: MapSelection,
  resolutionOrOptions: number | SampleOptions,
  zoomArg = 12,
  onProgressArg?: (done: number, total: number) => void,
): Promise<HeightGrid> {
  const options: SampleOptions =
    typeof resolutionOrOptions === "number"
      ? {
          resolution: resolutionOrOptions,
          zoom: zoomArg,
          onProgress: onProgressArg,
        }
      : resolutionOrOptions;

  const resolution = options.resolution;
  const zoom = options.zoom ?? 12;
  const terrainSmooth =
    options.terrainSmooth ??
    (resolution < 80 ? 3 : resolution < 140 ? 2 : 1);
  const waterMode = options.waterMode ?? "keep";
  const waterBufferKm = options.waterBufferKm ?? 40;
  const signal = options.signal;
  const onProgress = options.onProgress;
  const seaLevel = 0.5;

  const landBounds = selectionBounds(selection);
  const bounds =
    waterMode === "include"
      ? expandBoundsByKm(landBounds, waterBufferKm)
      : landBounds;
  const cols = resolution;
  const rows = resolution;
  const values = new Float32Array(cols * rows);
  const cache: TileCache = new Map();

  const midLat = (bounds.south + bounds.north) / 2;
  const widthM =
    Math.abs(bounds.east - bounds.west) * metersPerDegreeLng(midLat);
  const depthM =
    Math.abs(bounds.north - bounds.south) * metersPerDegreeLat(midLat);

  const total = cols * rows;
  let done = 0;

  for (let row = 0; row < rows; row += 1) {
    if (signal?.aborted) throw new SampleAbortedError();
    const v = rows === 1 ? 0.5 : row / (rows - 1);
    const lat = bounds.north - v * (bounds.north - bounds.south);

    for (let col = 0; col < cols; col += 1) {
      const u = cols === 1 ? 0.5 : col / (cols - 1);
      const lng = bounds.west + u * (bounds.east - bounds.west);
      const index = row * cols + col;
      const inLand = pointInSelection(lat, lng, selection);

      try {
        if (waterMode === "include") {
          const elev = await elevationAtLatLng(lat, lng, zoom, cache, signal);
          if (inLand) {
            values[index] = elev;
          } else if (elev <= seaLevel) {
            values[index] = Math.min(elev, 0);
          } else {
            values[index] = Number.NaN;
          }
        } else if (!inLand) {
          values[index] = Number.NaN;
        } else {
          values[index] = await elevationAtLatLng(
            lat,
            lng,
            zoom,
            cache,
            signal,
          );
        }
      } catch (err) {
        if (
          signal?.aborted ||
          (err instanceof DOMException && err.name === "AbortError") ||
          err instanceof SampleAbortedError
        ) {
          throw new SampleAbortedError();
        }
        throw err;
      }

      done += 1;
      if (onProgress && (done % 32 === 0 || done === total)) {
        onProgress(done, total);
      }
    }
  }

  let processed =
    waterMode === "exclude"
      ? excludeExteriorWater(values, cols, rows, seaLevel)
      : values;
  const smoothed = smoothHeightGrid(processed, cols, rows, terrainSmooth);

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < smoothed.length; i += 1) {
    const elev = smoothed[i];
    if (elev === undefined || Number.isNaN(elev)) continue;
    if (elev < min) min = elev;
    if (elev > max) max = elev;
  }

  if (!Number.isFinite(min)) {
    min = 0;
    max = 0;
  }

  return {
    cols,
    rows,
    values: smoothed,
    min,
    max,
    widthM,
    depthM,
    bounds,
    selection,
  };
}

function cross(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
): [number, number, number] {
  return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
}

function normalize(x: number, y: number, z: number): [number, number, number] {
  const len = Math.hypot(x, y, z) || 1;
  return [x / len, y / len, z / len];
}

export type StlOptions = {
  /** Vertical exaggeration multiplier on elevation deltas. */
  verticalScale: number;
  /** Target max horizontal size of the model in mm. */
  modelSizeMm: number;
  /** Extra base thickness under the lowest terrain point, in mm. */
  baseMm: number;
};

export type PrintSizeEstimate = {
  widthMm: number;
  depthMm: number;
  heightMm: number;
  reliefMm: number;
  scaleXY: number;
  elevRangeM: number;
  approximateHeight: boolean;
  triangleHint: number;
};

const DEFAULT_ELEV_RANGE_M = 1200;

/** Horizontal print size from geography; height uses a known or typical elev span. */
export function estimatePrintDimensions(
  selection: MapSelection,
  options: StlOptions & {
    waterMode?: WaterMode;
    waterBufferKm?: number;
    resolution?: number;
    elevRangeM?: number | null;
  },
): PrintSizeEstimate {
  const landBounds = selectionBounds(selection);
  const bounds =
    options.waterMode === "include"
      ? expandBoundsByKm(landBounds, options.waterBufferKm ?? 40)
      : landBounds;
  const midLat = (bounds.south + bounds.north) / 2;
  const widthM =
    Math.abs(bounds.east - bounds.west) * metersPerDegreeLng(midLat);
  const depthM =
    Math.abs(bounds.north - bounds.south) * metersPerDegreeLat(midLat);
  const maxHoriz = Math.max(widthM, depthM, 1);
  const scaleXY = options.modelSizeMm / maxHoriz;
  const widthMm = widthM * scaleXY;
  const depthMm = depthM * scaleXY;
  const approximateHeight =
    options.elevRangeM == null || !Number.isFinite(options.elevRangeM);
  const elevRangeM = approximateHeight
    ? DEFAULT_ELEV_RANGE_M
    : Math.max(0, options.elevRangeM);
  const reliefMm = elevRangeM * scaleXY * options.verticalScale;
  const resolution = options.resolution ?? 120;
  return {
    widthMm,
    depthMm,
    heightMm: reliefMm + options.baseMm,
    reliefMm,
    scaleXY,
    elevRangeM,
    approximateHeight,
    triangleHint: Math.round(3.2 * resolution * resolution),
  };
}

export function printDimensionsFromGrid(
  grid: HeightGrid,
  options: StlOptions,
): Omit<PrintSizeEstimate, "approximateHeight" | "triangleHint" | "elevRangeM"> & {
  elevRangeM: number;
} {
  const maxHoriz = Math.max(grid.widthM, grid.depthM, 1);
  const scaleXY = options.modelSizeMm / maxHoriz;
  const elevRangeM = Math.max(0, grid.max - grid.min);
  const reliefMm = elevRangeM * scaleXY * options.verticalScale;
  return {
    widthMm: grid.widthM * scaleXY,
    depthMm: grid.depthM * scaleXY,
    heightMm: reliefMm + options.baseMm,
    reliefMm,
    scaleXY,
    elevRangeM,
  };
}

export function stlTriangleCount(buffer: ArrayBuffer): number {
  if (buffer.byteLength < 84) return 0;
  return new DataView(buffer).getUint32(80, true);
}

export function slugifyLabel(label: string): string {
  const slug = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "map";
}

export function stlFilenameFromLabels(labels: string[]): string {
  const parts = [...new Set(labels.map(slugifyLabel).filter(Boolean))];
  const joined = parts.join("-").replace(/-+/g, "-").slice(0, 80);
  return `${joined || "map-terrain"}.stl`;
}

/**
 * Build a closed terrain mesh (top + walls + bottom) as binary STL.
 * X = east, Y = north, Z = up (print orientation).
 *
 * Boundary cells use marching squares with edge crossings snapped to the
 * true selection outline (not grid stairs), so political borders stay faithful.
 */
export function heightGridToStl(
  grid: HeightGrid,
  options: StlOptions,
): ArrayBuffer {
  const { cols, rows, values, min, widthM, depthM, bounds, selection } = grid;
  const { verticalScale, modelSizeMm, baseMm } = options;

  const maxHoriz = Math.max(widthM, depthM, 1);
  const scaleXY = modelSizeMm / maxHoriz;
  const widthMm = widthM * scaleXY;
  const depthMm = depthM * scaleXY;
  const elevToMm = scaleXY * verticalScale;

  const heightAt = (col: number, row: number): number | null => {
    if (col < 0 || col >= cols || row < 0 || row >= rows) return null;
    const v = values[row * cols + col];
    if (v === undefined || Number.isNaN(v)) return null;
    return (v - min) * elevToMm + baseMm;
  };

  const solidAt = (col: number, row: number) => heightAt(col, row) !== null;

  type Vert = { x: number; y: number; z: number };
  type Tri = {
    ax: number;
    ay: number;
    az: number;
    bx: number;
    by: number;
    bz: number;
    cx: number;
    cy: number;
    cz: number;
  };
  const tris: Tri[] = [];

  const pushTri = (
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    cx: number,
    cy: number,
    cz: number,
  ) => {
    tris.push({ ax, ay, az, bx, by, bz, cx, cy, cz });
  };

  const xOf = (col: number) => (cols === 1 ? 0 : (col / (cols - 1)) * widthMm);
  const yOf = (row: number) =>
    rows === 1 ? 0 : ((rows - 1 - row) / (rows - 1)) * depthMm;

  const latLngOf = (col: number, row: number) => {
    const u = cols === 1 ? 0.5 : col / (cols - 1);
    const v = rows === 1 ? 0.5 : row / (rows - 1);
    return {
      lat: bounds.north - v * (bounds.north - bounds.south),
      lng: bounds.west + u * (bounds.east - bounds.west),
    };
  };

  /** Find where the selection / mask boundary crosses a grid edge. */
  const edgeCrossing = (
    c0: number,
    r0: number,
    c1: number,
    r1: number,
  ): Vert => {
    const p0 = latLngOf(c0, r0);
    const p1 = latLngOf(c1, r1);
    const g0 = pointInSelection(p0.lat, p0.lng, selection);
    const g1 = pointInSelection(p1.lat, p1.lng, selection);

    const s0 = solidAt(c0, r0);
    const s1 = solidAt(c1, r1);
    let t = 0.5;
    // Snap to the political/land outline only when leaving empty space.
    // If both corners are solid (land + sea buffer), keep a continuous surface.
    if (g0 !== g1 && s0 !== s1) {
      let lo = 0;
      let hi = 1;
      const inside0 = g0;
      for (let i = 0; i < 16; i += 1) {
        const mid = (lo + hi) / 2;
        const col = c0 + (c1 - c0) * mid;
        const row = r0 + (r1 - r0) * mid;
        const p = latLngOf(col, row);
        if (pointInSelection(p.lat, p.lng, selection) === inside0) lo = mid;
        else hi = mid;
      }
      t = (lo + hi) / 2;
    }

    const col = c0 + (c1 - c0) * t;
    const row = r0 + (r1 - r0) * t;
    const h0 = heightAt(c0, r0);
    const h1 = heightAt(c1, r1);
    let z: number;
    if (h0 !== null && h1 !== null) z = h0 + (h1 - h0) * t;
    else z = h0 ?? h1 ?? baseMm;
    return { x: xOf(col), y: yOf(row), z };
  };

  const pushTopFan = (poly: Vert[]) => {
    if (poly.length < 3) return;
    const a = poly[0]!;
    for (let i = 1; i < poly.length - 1; i += 1) {
      const b = poly[i]!;
      const c = poly[i + 1]!;
      const crossZ = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      if (crossZ >= 0) {
        pushTri(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      } else {
        pushTri(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z);
      }
    }
  };

  const pushBottomFan = (poly: Vert[]) => {
    if (poly.length < 3) return;
    const a = poly[0]!;
    for (let i = 1; i < poly.length - 1; i += 1) {
      const b = poly[i]!;
      const c = poly[i + 1]!;
      const crossZ = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      // Bottom face normals point −Z (opposite of top)
      if (crossZ >= 0) {
        pushTri(a.x, a.y, 0, c.x, c.y, 0, b.x, b.y, 0);
      } else {
        pushTri(a.x, a.y, 0, b.x, b.y, 0, c.x, c.y, 0);
      }
    }
  };

  const pushWall = (
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    outwardX: number,
    outwardY: number,
  ) => {
    const ex = bx - ax;
    const ey = by - ay;
    const matchesLeftPerp = -ey * outwardX + ex * outwardY > 0;
    if (matchesLeftPerp) {
      pushTri(ax, ay, az, bx, by, bz, bx, by, 0);
      pushTri(ax, ay, az, bx, by, 0, ax, ay, 0);
    } else {
      pushTri(ax, ay, az, bx, by, 0, bx, by, bz);
      pushTri(ax, ay, az, ax, ay, 0, bx, by, 0);
    }
  };

  const pushWallSeg = (a: Vert, b: Vert, solidCx: number, solidCy: number) => {
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    // Outward = away from the solid side of this cell
    pushWall(a.x, a.y, a.z, b.x, b.y, b.z, midX - solidCx, midY - solidCy);
  };

  /**
   * Marching-squares solid polygons per cell.
   * Corner bits: 1=(col,row) 2=(col+1,row) 4=(col+1,row+1) 8=(col,row+1)
   * Returns CCW-ish vertex rings in mesh space + iso wall segments.
   */
  for (let row = 0; row < rows - 1; row += 1) {
    for (let col = 0; col < cols - 1; col += 1) {
      const s0 = solidAt(col, row);
      const s1 = solidAt(col + 1, row);
      const s2 = solidAt(col + 1, row + 1);
      const s3 = solidAt(col, row + 1);
      const mask =
        (s0 ? 1 : 0) | (s1 ? 2 : 0) | (s2 ? 4 : 0) | (s3 ? 8 : 0);
      if (mask === 0) continue;

      const z0 = heightAt(col, row);
      const z1 = heightAt(col + 1, row);
      const z2 = heightAt(col + 1, row + 1);
      const z3 = heightAt(col, row + 1);
      const c0: Vert | null = z0 === null ? null : { x: xOf(col), y: yOf(row), z: z0 };
      const c1: Vert | null =
        z1 === null ? null : { x: xOf(col + 1), y: yOf(row), z: z1 };
      const c2: Vert | null =
        z2 === null ? null : { x: xOf(col + 1), y: yOf(row + 1), z: z2 };
      const c3: Vert | null =
        z3 === null ? null : { x: xOf(col), y: yOf(row + 1), z: z3 };

      const e0v = !(s0 && s1) && (s0 || s1) ? edgeCrossing(col, row, col + 1, row) : null;
      const e1v =
        !(s1 && s2) && (s1 || s2)
          ? edgeCrossing(col + 1, row, col + 1, row + 1)
          : null;
      const e2v =
        !(s2 && s3) && (s2 || s3)
          ? edgeCrossing(col + 1, row + 1, col, row + 1)
          : null;
      const e3v =
        !(s3 && s0) && (s3 || s0)
          ? edgeCrossing(col, row + 1, col, row)
          : null;

      const cellCx = (xOf(col) + xOf(col + 1)) / 2;
      const cellCy = (yOf(row) + yOf(row + 1)) / 2;
      let solidCx = 0;
      let solidCy = 0;
      let solidN = 0;
      for (const c of [c0, c1, c2, c3]) {
        if (!c) continue;
        solidCx += c.x;
        solidCy += c.y;
        solidN += 1;
      }
      if (solidN > 0) {
        solidCx /= solidN;
        solidCy /= solidN;
      } else {
        solidCx = cellCx;
        solidCy = cellCy;
      }

      let polys: Vert[][] = [];
      let walls: Array<[Vert, Vert]> = [];

      switch (mask) {
        case 15:
          polys = [[c0!, c1!, c2!, c3!]];
          break;
        case 1:
          polys = [[c0!, e0v!, e3v!]];
          walls = [[e0v!, e3v!]];
          break;
        case 2:
          polys = [[c1!, e1v!, e0v!]];
          walls = [[e1v!, e0v!]];
          break;
        case 3:
          polys = [[c0!, c1!, e1v!, e3v!]];
          walls = [[e1v!, e3v!]];
          break;
        case 4:
          polys = [[c2!, e2v!, e1v!]];
          walls = [[e2v!, e1v!]];
          break;
        case 5:
          polys = [
            [c0!, e0v!, e3v!],
            [c2!, e2v!, e1v!],
          ];
          walls = [
            [e0v!, e3v!],
            [e2v!, e1v!],
          ];
          break;
        case 6:
          polys = [[c1!, c2!, e2v!, e0v!]];
          walls = [[e2v!, e0v!]];
          break;
        case 7:
          polys = [[c0!, c1!, c2!, e2v!, e3v!]];
          walls = [[e2v!, e3v!]];
          break;
        case 8:
          polys = [[c3!, e3v!, e2v!]];
          walls = [[e3v!, e2v!]];
          break;
        case 9:
          polys = [[c0!, e0v!, e2v!, c3!]];
          walls = [[e0v!, e2v!]];
          break;
        case 10:
          polys = [
            [c1!, e1v!, e0v!],
            [c3!, e3v!, e2v!],
          ];
          walls = [
            [e1v!, e0v!],
            [e3v!, e2v!],
          ];
          break;
        case 11:
          polys = [[c0!, c1!, e1v!, e2v!, c3!]];
          walls = [[e1v!, e2v!]];
          break;
        case 12:
          polys = [[c2!, c3!, e3v!, e1v!]];
          walls = [[e3v!, e1v!]];
          break;
        case 13:
          polys = [[c0!, e0v!, e1v!, c2!, c3!]];
          walls = [[e0v!, e1v!]];
          break;
        case 14:
          polys = [[c1!, c2!, c3!, e3v!, e0v!]];
          walls = [[e3v!, e0v!]];
          break;
        default:
          break;
      }

      // When the selection fills the sample bbox (typical rectangle), every
      // cell is solid and marching squares never sees an empty neighbor — so
      // drop skirts on the outer grid edges or the mesh stays an open shell.
      if (row === 0 && s0 && s1 && c0 && c1) walls.push([c0, c1]);
      if (col === cols - 2 && s1 && s2 && c1 && c2) walls.push([c1, c2]);
      if (row === rows - 2 && s2 && s3 && c2 && c3) walls.push([c2, c3]);
      if (col === 0 && s3 && s0 && c3 && c0) walls.push([c3, c0]);

      for (const poly of polys) {
        pushTopFan(poly);
        pushBottomFan(poly);
      }
      for (const [a, b] of walls) {
        pushWallSeg(a, b, solidCx, solidCy);
      }
    }
  }

  // Binary STL
  const header = new ArrayBuffer(80);
  const buffer = new ArrayBuffer(84 + tris.length * 50);
  const view = new DataView(buffer);
  new Uint8Array(buffer, 0, 80).set(new Uint8Array(header));
  view.setUint32(80, tris.length, true);

  let offset = 84;
  for (const t of tris) {
    const [nx, ny, nz] = normalize(
      ...cross(
        t.bx - t.ax,
        t.by - t.ay,
        t.bz - t.az,
        t.cx - t.ax,
        t.cy - t.ay,
        t.cz - t.az,
      ),
    );
    view.setFloat32(offset, nx, true);
    view.setFloat32(offset + 4, ny, true);
    view.setFloat32(offset + 8, nz, true);
    offset += 12;
    for (const p of [
      [t.ax, t.ay, t.az],
      [t.bx, t.by, t.bz],
      [t.cx, t.cy, t.cz],
    ] as const) {
      view.setFloat32(offset, p[0], true);
      view.setFloat32(offset + 4, p[1], true);
      view.setFloat32(offset + 8, p[2], true);
      offset += 12;
    }
    view.setUint16(offset, 0, true);
    offset += 2;
  }

  return buffer;
}

export function downloadArrayBuffer(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], { type: "model/stl" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
