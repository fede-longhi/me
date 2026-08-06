import buffer from "@turf/buffer";
import difference from "@turf/difference";
import { featureCollection, lineString, multiPolygon, polygon } from "@turf/helpers";
import union from "@turf/union";
import type { Feature, MultiPolygon, Polygon, Position } from "geojson";
import {
  metersPerDegreeLat,
  metersPerDegreeLng,
  pointInPolygon,
  selectionDisplayName,
  selectionToPolygons,
  type LatLng,
  type MapSelection,
} from "@/lib/map-stl";

function polygonsToTurf(
  polygons: LatLng[][][],
): Feature<Polygon | MultiPolygon> | null {
  const coords: Position[][][] = [];
  for (const poly of polygons) {
    if (!poly[0] || poly[0].length < 4) continue;
    coords.push(poly.map((ring) => ring.map((p) => [p.lng, p.lat] as Position)));
  }
  if (coords.length === 0) return null;
  if (coords.length === 1) return polygon(coords[0]!);
  return multiPolygon(coords);
}

function turfToPolygons(geom: Polygon | MultiPolygon): LatLng[][][] {
  const polys: LatLng[][][] = [];
  const addPoly = (rings: Position[][]) => {
    const out: LatLng[][] = [];
    for (const ring of rings) {
      if (ring.length < 4) continue;
      const latLngRing: LatLng[] = ring.map(([lng, lat]) => ({
        lat: lat!,
        lng: lng!,
      }));
      const first = latLngRing[0]!;
      const last = latLngRing[latLngRing.length - 1]!;
      if (first.lat !== last.lat || first.lng !== last.lng) {
        latLngRing.push({ ...first });
      }
      if (latLngRing.length >= 4) out.push(latLngRing);
    }
    if (out[0] && out[0].length >= 4) polys.push(out);
  };

  if (geom.type === "Polygon") addPoly(geom.coordinates);
  else for (const poly of geom.coordinates) addPoly(poly);
  return polys;
}

function circlePolygon(
  center: LatLng,
  radiusM: number,
  steps = 20,
): Feature<Polygon> {
  const mLat = metersPerDegreeLat(center.lat);
  const mLng = Math.max(metersPerDegreeLng(center.lat), 1e-9);
  const ring: Position[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const a = (i / steps) * Math.PI * 2;
    ring.push([
      center.lng + (Math.cos(a) * radiusM) / mLng,
      center.lat + (Math.sin(a) * radiusM) / mLat,
    ]);
  }
  return polygon([ring]);
}

function asNamedPolygon(
  selection: MapSelection | null,
  polygons: LatLng[][][],
  fallbackName = "Brush",
): MapSelection {
  return {
    kind: "polygon",
    name: selection ? selectionDisplayName(selection) : fallbackName,
    polygons,
  };
}

/** Space stamp centers so consecutive stamps overlap (~half radius). */
export function densifyBrushCenters(
  centers: LatLng[],
  radiusM: number,
): LatLng[] {
  if (centers.length === 0) return [];
  const stepM = Math.max(radiusM * 0.55, 40);
  const out: LatLng[] = [{ ...centers[0]! }];
  for (let i = 1; i < centers.length; i += 1) {
    const a = out[out.length - 1]!;
    const b = centers[i]!;
    const mLat = metersPerDegreeLat((a.lat + b.lat) / 2);
    const mLng = Math.max(metersPerDegreeLng((a.lat + b.lat) / 2), 1e-9);
    const dx = (b.lng - a.lng) * mLng;
    const dy = (b.lat - a.lat) * mLat;
    const dist = Math.hypot(dx, dy);
    if (dist < stepM * 0.35) continue;
    const n = Math.max(1, Math.ceil(dist / stepM));
    for (let k = 1; k <= n; k += 1) {
      const u = k / n;
      out.push({
        lat: a.lat + (b.lat - a.lat) * u,
        lng: a.lng + (b.lng - a.lng) * u,
      });
    }
  }
  return out;
}

/**
 * Build one stroke polygon. Prefer line buffer (fast) over N circle unions.
 * Centers should already be spaced reasonably; we densify lightly for buffer quality.
 */
function unionStampCenters(
  centers: LatLng[],
  radiusM: number,
): Feature<Polygon | MultiPolygon> | null {
  if (centers.length === 0 || radiusM <= 0) return null;
  if (centers.length === 1) return circlePolygon(centers[0]!, radiusM, 24);

  const path = densifyBrushCenters(centers, radiusM);
  if (path.length === 1) return circlePolygon(path[0]!, radiusM, 24);

  try {
    const line = lineString(path.map((c) => [c.lng, c.lat]));
    const buffered = buffer(line, radiusM / 1000, {
      units: "kilometers",
      steps: 8,
    });
    if (buffered?.geometry) {
      return buffered as Feature<Polygon | MultiPolygon>;
    }
  } catch {
    // fall through to circle union
  }

  // Fallback: pairwise union of end-cap circles only (sparse)
  const stamps = path.map((c) => circlePolygon(c, radiusM, 16));
  let merged: Feature<Polygon | MultiPolygon> | null = stamps[0] ?? null;
  for (let i = 1; i < stamps.length; i += 1) {
    if (!merged) break;
    try {
      const next = union(featureCollection([merged, stamps[i]!]));
      if (next?.geometry) {
        merged = next as Feature<Polygon | MultiPolygon>;
      }
    } catch {
      // skip failed stamp
    }
  }
  return merged;
}

/** Apply a whole paint stroke in one boolean op (fast path for live brushing). */
export function paintBrushStrokeToSelection(
  selection: MapSelection | null,
  centers: LatLng[],
  radiusM: number,
): MapSelection | null {
  if (radiusM <= 0 || centers.length === 0) return selection;
  const stamp = unionStampCenters(centers, radiusM);
  if (!stamp?.geometry) return selection;

  if (!selection) {
    return asNamedPolygon(null, turfToPolygons(stamp.geometry));
  }

  const subject = polygonsToTurf(selectionToPolygons(selection));
  if (!subject) {
    return asNamedPolygon(selection, turfToPolygons(stamp.geometry));
  }

  try {
    const merged = union(featureCollection([subject, stamp]));
    if (!merged?.geometry) return selection;
    const next = turfToPolygons(merged.geometry);
    if (next.length === 0) return selection;
    return asNamedPolygon(selection, next);
  } catch {
    return asNamedPolygon(selection, [
      ...selectionToPolygons(selection),
      ...turfToPolygons(stamp.geometry),
    ]);
  }
}

/** Apply a whole erase stroke in one boolean op. */
export function eraseBrushStrokeFromSelection(
  selection: MapSelection,
  centers: LatLng[],
  radiusM: number,
): MapSelection | null {
  if (radiusM <= 0 || centers.length === 0) return selection;
  const stamp = unionStampCenters(centers, radiusM);
  if (!stamp) return selection;

  const subject = polygonsToTurf(selectionToPolygons(selection));
  if (!subject) return null;

  try {
    const cut = difference(featureCollection([subject, stamp]));
    if (!cut?.geometry) return null;
    const next = turfToPolygons(cut.geometry);
    if (next.length === 0) return null;
    return asNamedPolygon(selection, next);
  } catch {
    return selection;
  }
}

/** Add a circular brush stamp to the current selection (or start a new one). */
export function paintBrushToSelection(
  selection: MapSelection | null,
  center: LatLng,
  radiusM: number,
): MapSelection | null {
  return paintBrushStrokeToSelection(selection, [center], radiusM);
}

/** Subtract a circular brush stamp from the current selection. */
export function eraseBrushFromSelection(
  selection: MapSelection,
  center: LatLng,
  radiusM: number,
): MapSelection | null {
  return eraseBrushStrokeFromSelection(selection, [center], radiusM);
}

/** Remove the closed polygon that contains this point (last-added first). */
export function removePolygonAtPoint(
  selection: MapSelection,
  point: LatLng,
): MapSelection | null {
  const polygons = selectionToPolygons(selection);
  let hit = -1;
  for (let i = polygons.length - 1; i >= 0; i -= 1) {
    const poly = polygons[i];
    if (!poly?.[0] || poly[0].length < 3) continue;
    if (pointInPolygon(point.lat, point.lng, [poly])) {
      hit = i;
      break;
    }
  }
  if (hit < 0) return selection;
  const next = polygons.filter((_, i) => i !== hit);
  if (next.length === 0) return null;
  return asNamedPolygon(selection, next);
}
