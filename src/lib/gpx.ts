import type { LatLng } from "@/lib/map-stl";

export type GpxTrack = {
  name: string;
  points: LatLng[];
  /** Approximate 2D path length in meters. */
  lengthM: number;
};

function attr(el: Element, name: string): string | null {
  return el.getAttribute(name) ?? el.getAttribute(name.toLowerCase());
}

function parsePoint(el: Element): LatLng | null {
  const lat = Number.parseFloat(attr(el, "lat") ?? "");
  const lng = Number.parseFloat(attr(el, "lon") ?? attr(el, "lng") ?? "");
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function textOf(parent: Element, localName: string): string | null {
  const kids = parent.getElementsByTagName(localName);
  const node = kids.item(0);
  const text = node?.textContent?.trim();
  return text || null;
}

function haversineM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLng = (b.lng - a.lng) * toRad;
  const lat1 = a.lat * toRad;
  const lat2 = b.lat * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function pathLengthM(points: LatLng[]): number {
  let sum = 0;
  for (let i = 1; i < points.length; i += 1) {
    sum += haversineM(points[i - 1]!, points[i]!);
  }
  return sum;
}

/**
 * Decimate long tracks for Turf buffer / map drawing while keeping shape.
 * Keeps first/last and points spaced ~minStepM apart.
 */
export function decimatePath(points: LatLng[], minStepM: number): LatLng[] {
  if (points.length <= 2 || minStepM <= 0) return points;
  const out: LatLng[] = [points[0]!];
  let last = points[0]!;
  for (let i = 1; i < points.length - 1; i += 1) {
    const p = points[i]!;
    if (haversineM(last, p) >= minStepM) {
      out.push(p);
      last = p;
    }
  }
  const end = points[points.length - 1]!;
  if (out[out.length - 1] !== end) out.push(end);
  return out;
}

function collectPoints(parent: Element, tagNames: string[]): LatLng[] {
  const points: LatLng[] = [];
  for (const tag of tagNames) {
    const nodes = parent.getElementsByTagName(tag);
    for (let i = 0; i < nodes.length; i += 1) {
      const pt = parsePoint(nodes.item(i)!);
      if (pt) points.push(pt);
    }
  }
  return points;
}

/**
 * Parse a GPX 1.0/1.1 document. Prefers tracks; falls back to routes, then waypoints.
 */
export function parseGpx(xmlText: string): GpxTrack[] {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("Invalid GPX XML");
  }

  const tracks: GpxTrack[] = [];
  const trkNodes = doc.getElementsByTagName("trk");
  for (let i = 0; i < trkNodes.length; i += 1) {
    const trk = trkNodes.item(i)!;
    const name =
      textOf(trk, "name") ??
      textOf(doc.documentElement, "name") ??
      `Track ${i + 1}`;
    const points = collectPoints(trk, ["trkpt"]);
    if (points.length >= 2) {
      tracks.push({ name, points, lengthM: pathLengthM(points) });
    }
  }

  if (tracks.length > 0) return tracks;

  const rteNodes = doc.getElementsByTagName("rte");
  for (let i = 0; i < rteNodes.length; i += 1) {
    const rte = rteNodes.item(i)!;
    const name = textOf(rte, "name") ?? `Route ${i + 1}`;
    const points = collectPoints(rte, ["rtept"]);
    if (points.length >= 2) {
      tracks.push({ name, points, lengthM: pathLengthM(points) });
    }
  }

  if (tracks.length > 0) return tracks;

  const wpts = collectPoints(doc.documentElement, ["wpt"]);
  if (wpts.length >= 2) {
    tracks.push({
      name: textOf(doc.documentElement, "name") ?? "Waypoints",
      points: wpts,
      lengthM: pathLengthM(wpts),
    });
  }

  return tracks;
}

export function formatDistanceKm(meters: number, locale: "en" | "es"): string {
  const km = meters / 1000;
  if (km < 1) {
    return locale === "es"
      ? `${Math.round(meters)} m`
      : `${Math.round(meters)} m`;
  }
  return `${km.toFixed(km >= 100 ? 0 : 1)} km`;
}
