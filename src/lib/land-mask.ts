/**
 * Clip political boundaries to real coastlines using a Natural Earth land template
 * (static GeoJSON under /geo/land-americas.geojson).
 */

import bbox from "@turf/bbox";
import bboxClip from "@turf/bbox-clip";
import booleanIntersects from "@turf/boolean-intersects";
import flatten from "@turf/flatten";
import { featureCollection, multiPolygon, polygon } from "@turf/helpers";
import intersect from "@turf/intersect";
import simplify from "@turf/simplify";
import type {
  Feature,
  FeatureCollection,
  MultiPolygon,
  Polygon,
  Position,
} from "geojson";
import type { LatLng, MapSelection } from "@/lib/map-stl";
import {
  selectionBounds,
  selectionDisplayName,
  selectionToPolygons,
} from "@/lib/map-stl";

type LandPoly = Feature<Polygon | MultiPolygon>;

let landCache: FeatureCollection<Polygon | MultiPolygon> | null = null;
let landLoad: Promise<FeatureCollection<Polygon | MultiPolygon>> | null = null;

const LAND_URL = "/geo/land-americas.geojson";

async function loadLandTemplate(): Promise<
  FeatureCollection<Polygon | MultiPolygon>
> {
  if (landCache) return landCache;
  if (!landLoad) {
    landLoad = (async () => {
      const res = await fetch(LAND_URL);
      if (!res.ok) {
        throw new Error(`Land template failed (${res.status})`);
      }
      const raw = (await res.json()) as FeatureCollection;
      const features: LandPoly[] = [];
      for (const f of raw.features) {
        if (!f.geometry) continue;
        if (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon") {
          features.push(f as LandPoly);
        }
      }
      landCache = featureCollection(features) as FeatureCollection<
        Polygon | MultiPolygon
      >;
      return landCache;
    })().catch((err) => {
      landLoad = null;
      throw err;
    });
  }
  return landLoad;
}

function selectionToTurf(
  selection: Extract<MapSelection, { kind: "polygon" }>,
): Feature<Polygon | MultiPolygon> | null {
  const coords: Position[][][] = [];
  for (const poly of selection.polygons) {
    if (!poly[0] || poly[0].length < 4) continue;
    const rings = poly.map((ring) =>
      ring.map((p) => [p.lng, p.lat] as Position),
    );
    coords.push(rings);
  }
  if (coords.length === 0) return null;
  if (coords.length === 1) return polygon(coords[0]!);
  return multiPolygon(coords);
}

function turfToPolygons(
  geom: Polygon | MultiPolygon,
): LatLng[][][] {
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

  if (geom.type === "Polygon") {
    addPoly(geom.coordinates);
  } else {
    for (const poly of geom.coordinates) addPoly(poly);
  }
  return polys;
}

function landFeaturesNearBounds(
  land: FeatureCollection<Polygon | MultiPolygon>,
  bounds: { south: number; west: number; north: number; east: number },
  padDeg = 0.15,
): LandPoly[] {
  const clipBox: [number, number, number, number] = [
    bounds.west - padDeg,
    bounds.south - padDeg,
    bounds.east + padDeg,
    bounds.north + padDeg,
  ];
  const out: LandPoly[] = [];
  for (const f of land.features) {
    try {
      const fb = bbox(f);
      if (
        fb[0]! > clipBox[2] ||
        fb[2]! < clipBox[0] ||
        fb[1]! > clipBox[3] ||
        fb[3]! < clipBox[1]
      ) {
        continue;
      }
      const clipped = bboxClip(f, clipBox) as LandPoly;
      if (!clipped.geometry) continue;
      const flat = flatten(clipped);
      for (const part of flat.features) {
        if (
          part.geometry?.type === "Polygon" ||
          part.geometry?.type === "MultiPolygon"
        ) {
          out.push(part as LandPoly);
        }
      }
    } catch {
      // skip invalid pieces
    }
  }
  return out;
}

/**
 * Intersect any selection with the land template so the silhouette follows
 * the coastline (no bays/sea). Shapes are converted to polygons first.
 */
export async function clipSelectionToLand(
  selection: MapSelection,
): Promise<MapSelection> {
  const asPoly: Extract<MapSelection, { kind: "polygon" }> =
    selection.kind === "polygon"
      ? selection
      : {
          kind: "polygon",
          name: selectionDisplayName(selection),
          polygons: selectionToPolygons(selection),
        };

  const admin = selectionToTurf(asPoly);
  if (!admin) return selection;

  const land = await loadLandTemplate();
  const bounds = selectionBounds(asPoly);
  const nearby = landFeaturesNearBounds(land, bounds);
  if (nearby.length === 0) return selection;

  const resultPolys: LatLng[][][] = [];

  for (const landFeat of nearby) {
    try {
      if (!booleanIntersects(admin, landFeat)) continue;
      const hit = intersect(featureCollection([admin, landFeat]));
      if (!hit?.geometry) continue;
      let geom = hit.geometry;
      if (geom.type !== "Polygon" && geom.type !== "MultiPolygon") continue;
      try {
        const simplified = simplify(hit, {
          tolerance: 0.00015,
          highQuality: true,
        });
        if (
          simplified.geometry?.type === "Polygon" ||
          simplified.geometry?.type === "MultiPolygon"
        ) {
          geom = simplified.geometry;
        }
      } catch {
        // keep unsimplified
      }
      resultPolys.push(...turfToPolygons(geom));
    } catch {
      // skip failed intersections
    }
  }

  if (resultPolys.length === 0) return selection;

  return {
    kind: "polygon",
    name: asPoly.name,
    polygons: resultPolys,
  };
}
