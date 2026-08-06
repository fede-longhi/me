import type { LatLng, MapSelection } from "@/lib/map-stl";
import { mergeSelections } from "@/lib/map-stl";

export type ArJurisdiction = {
  id: string;
  /** Display name (ES). */
  nameEs: string;
  /** Display name (EN). */
  nameEn: string;
  /** Nominatim search query (Spanish OSM names work best for AR). */
  query: string;
  /** OSM relation id when known — denser geometry via lookup. */
  osmRelationId?: number;
  /** When true, merge Islas Malvinas into the returned selection. */
  includeMalvinas?: boolean;
};

/** OSM relation for Islas Malvinas / Falkland Islands. */
export const MALVINAS_OSM_RELATION_ID = 2185374;
/** OSM relation for Argentina (country). */
export const ARGENTINA_OSM_RELATION_ID = 286393;

/** Country-level Argentina (mainland + Malvinas geometry). */
export const AR_COUNTRY: ArJurisdiction = {
  id: "argentina",
  nameEs: "Argentina",
  nameEn: "Argentina",
  query: "Argentina",
  osmRelationId: ARGENTINA_OSM_RELATION_ID,
  includeMalvinas: true,
};

/** 23 provinces + CABA — curated Nominatim queries + verified OSM relation ids. */
export const AR_JURISDICTIONS: ArJurisdiction[] = [
  {
    id: "caba",
    nameEs: "CABA",
    nameEn: "CABA (Buenos Aires City)",
    query: "Ciudad Autónoma de Buenos Aires, Argentina",
    osmRelationId: 1224652,
  },
  {
    id: "ba",
    nameEs: "Buenos Aires",
    nameEn: "Buenos Aires Province",
    query: "Provincia de Buenos Aires, Argentina",
    osmRelationId: 1632167,
  },
  {
    id: "catamarca",
    nameEs: "Catamarca",
    nameEn: "Catamarca",
    query: "Provincia de Catamarca, Argentina",
    osmRelationId: 153545,
  },
  {
    id: "chaco",
    nameEs: "Chaco",
    nameEn: "Chaco",
    query: "Provincia del Chaco, Argentina",
  },
  {
    id: "chubut",
    nameEs: "Chubut",
    nameEn: "Chubut",
    query: "Provincia del Chubut, Argentina",
  },
  {
    id: "cordoba",
    nameEs: "Córdoba",
    nameEn: "Córdoba",
    query: "Provincia de Córdoba, Argentina",
  },
  {
    id: "corrientes",
    nameEs: "Corrientes",
    nameEn: "Corrientes",
    query: "Provincia de Corrientes, Argentina",
  },
  {
    id: "entrerios",
    nameEs: "Entre Ríos",
    nameEn: "Entre Ríos",
    query: "Provincia de Entre Ríos, Argentina",
  },
  {
    id: "formosa",
    nameEs: "Formosa",
    nameEn: "Formosa",
    query: "Provincia de Formosa, Argentina",
  },
  {
    id: "jujuy",
    nameEs: "Jujuy",
    nameEn: "Jujuy",
    query: "Provincia de Jujuy, Argentina",
  },
  {
    id: "lapampa",
    nameEs: "La Pampa",
    nameEn: "La Pampa",
    query: "Provincia de La Pampa, Argentina",
  },
  {
    id: "larioja",
    nameEs: "La Rioja",
    nameEn: "La Rioja",
    query: "Provincia de La Rioja, Argentina",
  },
  {
    id: "mendoza",
    nameEs: "Mendoza",
    nameEn: "Mendoza",
    query: "Provincia de Mendoza, Argentina",
  },
  {
    id: "misiones",
    nameEs: "Misiones",
    nameEn: "Misiones",
    query: "Provincia de Misiones, Argentina",
  },
  {
    id: "neuquen",
    nameEs: "Neuquén",
    nameEn: "Neuquén",
    query: "Provincia del Neuquén, Argentina",
  },
  {
    id: "rionegro",
    nameEs: "Río Negro",
    nameEn: "Río Negro",
    query: "Provincia de Río Negro, Argentina",
  },
  {
    id: "salta",
    nameEs: "Salta",
    nameEn: "Salta",
    query: "Provincia de Salta, Argentina",
  },
  {
    id: "sanjuan",
    nameEs: "San Juan",
    nameEn: "San Juan",
    query: "Provincia de San Juan, Argentina",
  },
  {
    id: "sanluis",
    nameEs: "San Luis",
    nameEn: "San Luis",
    query: "Provincia de San Luis, Argentina",
  },
  {
    id: "santacruz",
    nameEs: "Santa Cruz",
    nameEn: "Santa Cruz",
    query: "Provincia de Santa Cruz, Argentina",
  },
  {
    id: "santafe",
    nameEs: "Santa Fe",
    nameEn: "Santa Fe",
    query: "Provincia de Santa Fe, Argentina",
  },
  {
    id: "santiago",
    nameEs: "Santiago del Estero",
    nameEn: "Santiago del Estero",
    query: "Provincia de Santiago del Estero, Argentina",
  },
  {
    id: "tdf",
    nameEs: "Tierra del Fuego",
    nameEn: "Tierra del Fuego",
    query:
      "Provincia de Tierra del Fuego, Antártida e Islas del Atlántico Sur, Argentina",
    includeMalvinas: true,
  },
  {
    id: "tucuman",
    nameEs: "Tucumán",
    nameEn: "Tucumán",
    query: "Provincia de Tucumán, Argentina",
  },
];

type NominatimGeoJson =
  | {
      type: "Polygon";
      coordinates: number[][][];
    }
  | {
      type: "MultiPolygon";
      coordinates: number[][][][];
    };

type NominatimResult = {
  display_name: string;
  name?: string;
  addresstype?: string;
  geojson?: NominatimGeoJson;
  class?: string;
  type?: string;
  importance?: number;
  osm_type?: string;
  osm_id?: number;
};

const cache = new Map<string, MapSelection>();
/** Soft cap — Douglas-Peucker keeps corners, unlike stride decimation. */
const MAX_VERTICES = 40000;

const NOMINATIM_HEADERS = {
  Accept: "application/json",
};

export type BoundarySearchHit = {
  label: string;
  subtitle: string;
  kind: string;
  queryKey: string;
  selection: MapSelection;
};

function formatSearchHitMeta(result: NominatimResult): {
  label: string;
  subtitle: string;
  kind: string;
} {
  const label =
    result.name?.trim() ||
    result.display_name.split(",")[0]?.trim() ||
    "Boundary";
  const parts = result.display_name
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const rest = parts[0] === label ? parts.slice(1) : parts.slice(1);
  const subtitle = rest.slice(-3).join(" · ");
  const kind = (result.addresstype || result.type || result.class || "boundary")
    .replace(/_/g, " ");
  return { label, subtitle, kind };
}

function ringFromCoords(coords: number[][]): LatLng[] {
  const ring: LatLng[] = [];
  for (const c of coords) {
    const lng = c[0];
    const lat = c[1];
    if (lng === undefined || lat === undefined) continue;
    ring.push({ lat, lng });
  }
  return ring;
}

/** GeoJSON → list of polygons, each [outer, ...holes]. Keeps all MultiPolygon parts. */
function polygonsFromGeoJson(geojson: NominatimGeoJson): LatLng[][][] {
  if (geojson.type === "Polygon") {
    const rings = geojson.coordinates
      .map(ringFromCoords)
      .filter((r) => r.length >= 3);
    return rings.length > 0 ? [rings] : [];
  }

  const polygons: LatLng[][][] = [];
  for (const poly of geojson.coordinates) {
    const rings = poly.map(ringFromCoords).filter((r) => r.length >= 3);
    if (rings.length > 0) polygons.push(rings);
  }
  return polygons;
}

function perpendicularDistance(
  point: LatLng,
  start: LatLng,
  end: LatLng,
): number {
  const dx = end.lng - start.lng;
  const dy = end.lat - start.lat;
  if (dx === 0 && dy === 0) {
    return Math.hypot(point.lng - start.lng, point.lat - start.lat);
  }
  const t =
    ((point.lng - start.lng) * dx + (point.lat - start.lat) * dy) /
    (dx * dx + dy * dy);
  const projLng = start.lng + t * dx;
  const projLat = start.lat + t * dy;
  return Math.hypot(point.lng - projLng, point.lat - projLat);
}

/** Douglas–Peucker (iterative) — preserves sharp corners better than stride sampling. */
function douglasPeucker(points: LatLng[], epsilon: number): LatLng[] {
  if (points.length < 3) return points.slice();

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];

  while (stack.length > 0) {
    const segment = stack.pop();
    if (!segment) break;
    const [start, end] = segment;
    const startP = points[start]!;
    const endP = points[end]!;
    let maxDist = 0;
    let maxIndex = start;
    for (let i = start + 1; i < end; i += 1) {
      const d = perpendicularDistance(points[i]!, startP, endP);
      if (d > maxDist) {
        maxDist = d;
        maxIndex = i;
      }
    }
    if (maxDist > epsilon) {
      keep[maxIndex] = 1;
      if (maxIndex - start > 1) stack.push([start, maxIndex]);
      if (end - maxIndex > 1) stack.push([maxIndex, end]);
    }
  }

  const out: LatLng[] = [];
  for (let i = 0; i < points.length; i += 1) {
    if (keep[i]) out.push(points[i]!);
  }
  return out;
}

function simplifyRingToBudget(ring: LatLng[], maxVertices: number): LatLng[] {
  if (ring.length <= maxVertices) return ring;

  let lo = 0;
  let hi = 0.05;
  let best = ring;
  for (let iter = 0; iter < 14; iter += 1) {
    const mid = (lo + hi) / 2;
    const simplified = douglasPeucker(ring, mid);
    if (simplified.length > maxVertices) {
      lo = mid;
    } else {
      best = simplified;
      hi = mid;
    }
  }

  const first = ring[0];
  const last = best[best.length - 1];
  if (
    first &&
    best.length >= 2 &&
    (!last || last.lat !== first.lat || last.lng !== first.lng)
  ) {
    best = [...best, first];
  }
  return best.length >= 3 ? best : ring;
}

export function simplifyPolygons(
  polygons: LatLng[][][],
  maxVertices = MAX_VERTICES,
): LatLng[][][] {
  const total = polygons.reduce(
    (n, poly) => n + poly.reduce((m, ring) => m + ring.length, 0),
    0,
  );
  if (total <= maxVertices) return polygons;

  const ratio = maxVertices / total;
  return polygons.map((poly) =>
    poly.map((ring) =>
      simplifyRingToBudget(
        ring,
        Math.max(32, Math.ceil(ring.length * ratio)),
      ),
    ),
  );
}

function selectionFromResult(
  result: NominatimResult,
  nameOverride?: string,
): MapSelection | null {
  if (!result.geojson) return null;
  if (
    result.geojson.type !== "Polygon" &&
    result.geojson.type !== "MultiPolygon"
  ) {
    return null;
  }
  const polygons = simplifyPolygons(polygonsFromGeoJson(result.geojson));
  if (!polygons[0]?.[0] || polygons[0][0].length < 3) return null;
  return {
    kind: "polygon",
    name: nameOverride ?? result.display_name.split(",")[0]?.trim() ?? "Boundary",
    polygons,
  };
}

async function nominatimSearchRaw(
  query: string,
  opts?: { countrycodes?: string; limit?: number },
): Promise<NominatimResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    polygon_geojson: "1",
    // 0 = no extra server-side simplification
    polygon_threshold: "0",
    limit: String(opts?.limit ?? 5),
  });
  if (opts?.countrycodes) params.set("countrycodes", opts.countrycodes);

  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    { headers: NOMINATIM_HEADERS },
  );
  if (!res.ok) {
    throw new Error(`Nominatim error (${res.status})`);
  }
  return (await res.json()) as NominatimResult[];
}

async function nominatimLookupRelation(
  osmId: number,
): Promise<NominatimResult | null> {
  const params = new URLSearchParams({
    osm_ids: `R${osmId}`,
    format: "json",
    polygon_geojson: "1",
    polygon_threshold: "0",
  });
  const res = await fetch(
    `https://nominatim.openstreetmap.org/lookup?${params.toString()}`,
    { headers: NOMINATIM_HEADERS },
  );
  if (!res.ok) return null;
  const results = (await res.json()) as NominatimResult[];
  return results[0] ?? null;
}

function preferAdminResult(results: NominatimResult[]): NominatimResult | null {
  const ranked = [...results].sort((a, b) => {
    const score = (r: NominatimResult) => {
      let s = r.importance ?? 0;
      if (r.class === "boundary" || r.class === "place") s += 2;
      if (
        r.type === "administrative" ||
        r.type === "country" ||
        r.type === "state" ||
        r.type === "province"
      ) {
        s += 3;
      }
      if (r.geojson?.type === "Polygon" || r.geojson?.type === "MultiPolygon") {
        s += 5;
      }
      return s;
    };
    return score(b) - score(a);
  });
  return ranked.find((r) => r.geojson) ?? null;
}

async function fetchMalvinasSelection(): Promise<MapSelection | null> {
  const key = "v4:malvinas";
  const hit = cache.get(key);
  if (hit) return hit;
  const looked = await nominatimLookupRelation(MALVINAS_OSM_RELATION_ID);
  const selection = looked
    ? selectionFromResult(looked, "Islas Malvinas")
    : null;
  if (selection) cache.set(key, selection);
  return selection;
}

async function withMalvinasIfNeeded(
  selection: MapSelection,
  include: boolean | undefined,
  name: string,
): Promise<MapSelection> {
  if (!include) return selection;
  const malvinas = await fetchMalvinasSelection();
  if (!malvinas) return selection;
  // Avoid duplicating if Malvinas geometry is already present (rough bbox check)
  const merged = mergeSelections(selection, malvinas, name);
  return merged;
}

function looksLikeArgentinaQuery(query: string): boolean {
  const q = query.trim().toLowerCase();
  return (
    q === "argentina" ||
    q === "argentine republic" ||
    q === "república argentina" ||
    q === "republica argentina"
  );
}

/** Fetch a boundary polygon for a free-text query (countries / regions). */
export async function fetchBoundaryByQuery(
  query: string,
  nameOverride?: string,
): Promise<MapSelection> {
  const trimmed = query.trim();
  if (looksLikeArgentinaQuery(trimmed)) {
    return fetchArJurisdiction(AR_COUNTRY);
  }

  const key = `v4:q:${trimmed.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const results = await nominatimSearchRaw(trimmed, { limit: 8 });
  const best = preferAdminResult(results);
  if (!best) {
    throw new Error("No boundary polygon found");
  }
  const selection = selectionFromResult(best, nameOverride);
  if (!selection) {
    throw new Error("No boundary polygon found");
  }
  cache.set(key, selection);
  return selection;
}

/** Fetch a curated Argentine jurisdiction boundary. */
export async function fetchArJurisdiction(
  jurisdiction: ArJurisdiction,
): Promise<MapSelection> {
  const key = `v4:ar:${jurisdiction.id}`;
  const hit = cache.get(key);
  if (hit) return hit;

  let selection: MapSelection | null = null;

  // Prefer OSM relation id when known (fuller geometry)
  if (jurisdiction.osmRelationId) {
    const looked = await nominatimLookupRelation(jurisdiction.osmRelationId);
    selection = looked
      ? selectionFromResult(looked, jurisdiction.nameEs)
      : null;
  }

  if (!selection) {
    const results = await nominatimSearchRaw(jurisdiction.query, {
      countrycodes: jurisdiction.id === "argentina" ? undefined : "ar",
      limit: 5,
    });
    const best = preferAdminResult(results);
    if (!best) {
      throw new Error("No boundary polygon found");
    }

    // If search returned a relation, re-fetch via lookup for denser geometry
    if (best.osm_type === "relation" && typeof best.osm_id === "number") {
      const looked = await nominatimLookupRelation(best.osm_id);
      selection = looked
        ? selectionFromResult(looked, jurisdiction.nameEs)
        : null;
    }
    if (!selection) {
      selection = selectionFromResult(best, jurisdiction.nameEs);
    }
  }

  if (!selection) {
    throw new Error("No boundary polygon found");
  }

  selection = await withMalvinasIfNeeded(
    selection,
    jurisdiction.includeMalvinas,
    jurisdiction.nameEs,
  );

  cache.set(key, selection);
  return selection;
}

/** Search Nominatim and return selectable hits that have polygons. */
export async function searchBoundaries(
  query: string,
): Promise<BoundarySearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  if (looksLikeArgentinaQuery(q)) {
    const selection = await fetchArJurisdiction(AR_COUNTRY);
    const queryKey = "v4:ar:argentina";
    cache.set(queryKey, selection);
    return [
      {
        label: selection.name,
        subtitle: "Argentina",
        kind: "country",
        queryKey,
        selection,
      },
    ];
  }

  const results = await nominatimSearchRaw(q, { limit: 8 });
  const hits: BoundarySearchHit[] = [];

  for (const r of results) {
    const selection = selectionFromResult(r);
    if (!selection) continue;
    const meta = formatSearchHitMeta(r);
    const queryKey = `v4:hit:${r.display_name}`;
    cache.set(queryKey, selection);
    hits.push({
      ...meta,
      queryKey,
      selection,
    });
  }
  return hits;
}

export function getCachedBoundary(queryKey: string): MapSelection | null {
  return cache.get(queryKey) ?? null;
}
