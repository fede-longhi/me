"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useLanguage } from "@/components/LanguageProvider";
import { StlPreview } from "@/components/tools/StlPreview";
import { ToolChrome } from "@/components/tools/ToolChrome";
import {
  cancelTerrainJob,
  generateTerrain,
  terminateTerrainWorker,
} from "@/lib/terrain-client";
import {
  downloadArrayBuffer,
  printDimensionsFromGrid,
  SampleAbortedError,
  selectionBounds,
  selectionSpanKm,
  stlFilenameFromLabels,
  stlTriangleCount,
  type MapSelection,
} from "@/lib/map-stl";
import { corridorSelectionFromPath } from "@/lib/selection-edit";
import {
  decimatePath,
  formatDistanceKm,
  parseGpx,
  type GpxTrack,
} from "@/lib/gpx";
import type { Locale } from "@/lib/types";

const copy: Record<
  Locale,
  {
    eyebrow: string;
    title: string;
    lead: string;
    upload: string;
    track: string;
    corridor: string;
    corridorHint: string;
    verticalScale: string;
    modelSize: string;
    baseMm: string;
    generate: string;
    generating: string;
    cancel: string;
    download: string;
    hint: string;
    emptyPreview: string;
    controlsHint: string;
    noFile: string;
    tooShort: string;
    parseError: string;
    dims: string;
    triangles: string;
    pathLength: string;
    span: string;
    points: string;
    mapEmpty: string;
    progress: string;
    ready: string;
    cancelled: string;
    error: string;
  }
> = {
  en: {
    eyebrow: "3D / Map",
    title: "GPX to STL",
    lead: "Upload a GPS track, buffer a corridor around the path, and download a closed terrain STL for 3D printing.",
    upload: "Choose GPX file",
    track: "Track",
    corridor: "Corridor half-width (m)",
    corridorHint: "Distance from the path to each side of the printable strip.",
    verticalScale: "Vertical scale",
    modelSize: "Max size (mm)",
    baseMm: "Base (mm)",
    generate: "Generate STL",
    generating: "Generating…",
    cancel: "Cancel",
    download: "Download STL",
    hint: "GPX tracks and routes. Elevation comes from public DEM tiles — nothing is uploaded to a server.",
    emptyPreview: "Load a GPX and generate to preview the terrain.",
    controlsHint: "Drag to orbit · scroll to zoom · double-click to reset",
    noFile: "Load a GPX file first.",
    tooShort: "Need at least two points on the track.",
    parseError: "Could not parse that GPX file.",
    dims: "Print size",
    triangles: "Triangles",
    pathLength: "Path length",
    span: "Corridor span",
    points: "Points",
    mapEmpty: "Load a GPX to see the route on the map.",
    progress: "Sampling terrain…",
    ready: "Ready",
    cancelled: "Cancelled",
    error: "Terrain generation failed. Try a wider corridor or shorter track.",
  },
  es: {
    eyebrow: "3D / Mapa",
    title: "GPX a STL",
    lead: "Subí un track GPS, definí un corredor alrededor del camino y descargá un STL cerrado del terreno para impresión 3D.",
    upload: "Elegir archivo GPX",
    track: "Track",
    corridor: "Semi-ancho del corredor (m)",
    corridorHint: "Distancia desde el camino hasta cada lado de la franja imprimible.",
    verticalScale: "Escala vertical",
    modelSize: "Tamaño máx. (mm)",
    baseMm: "Base (mm)",
    generate: "Generar STL",
    generating: "Generando…",
    cancel: "Cancelar",
    download: "Descargar STL",
    hint: "Tracks y rutas GPX. La elevación sale de tiles DEM públicos — no se sube nada a un server.",
    emptyPreview: "Cargá un GPX y generá para ver el terreno.",
    controlsHint: "Arrastrá para orbitar · scroll para zoom · doble clic para reset",
    noFile: "Cargá un GPX primero.",
    tooShort: "Hacen falta al menos dos puntos en el track.",
    parseError: "No se pudo leer ese GPX.",
    dims: "Tamaño de impresión",
    triangles: "Triángulos",
    pathLength: "Largo del camino",
    span: "Extensión del corredor",
    points: "Puntos",
    mapEmpty: "Cargá un GPX para ver la ruta en el mapa.",
    progress: "Muestreando terreno…",
    ready: "Listo",
    cancelled: "Cancelado",
    error: "Falló la generación. Probá un corredor más ancho o un track más corto.",
  },
};

function formatMm(n: number) {
  return `${n.toFixed(1)} mm`;
}

export function GpxTerrainTool() {
  const { locale } = useLanguage();
  const t = copy[locale];

  const [tracks, setTracks] = useState<GpxTrack[]>([]);
  const [trackIndex, setTrackIndex] = useState(0);
  const [fileLabel, setFileLabel] = useState("gpx-route");
  const [halfWidthM, setHalfWidthM] = useState(400);
  const [verticalScale, setVerticalScale] = useState(2);
  const [modelSizeMm, setModelSizeMm] = useState(160);
  const [baseMm, setBaseMm] = useState(2);
  const [stlBuffer, setStlBuffer] = useState<ArrayBuffer | null>(null);
  const [previewMeta, setPreviewMeta] = useState<{
    widthMm: number;
    depthMm: number;
    heightMm: number;
    triangles: number;
  } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mapHostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);
  const jobIdRef = useRef<number | null>(null);
  const cancelRef = useRef(false);

  const activeTrack = tracks[trackIndex] ?? null;

  const workPoints = useMemo(() => {
    if (!activeTrack) return [];
    // Cap for buffer + mesh mask; densify is handled inside corridor builder.
    const step = Math.max(halfWidthM * 0.4, 40);
    return decimatePath(activeTrack.points, step);
  }, [activeTrack, halfWidthM]);

  const selection = useMemo((): MapSelection | null => {
    if (workPoints.length < 2) return null;
    return corridorSelectionFromPath(
      workPoints,
      halfWidthM,
      activeTrack?.name ?? fileLabel,
    );
  }, [workPoints, halfWidthM, activeTrack?.name, fileLabel]);

  const span = selection ? selectionSpanKm(selection) : null;

  useEffect(() => {
    return () => {
      terminateTerrainWorker();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const host = mapHostRef.current;
    if (!host || mapRef.current) return;
    const map = L.map(host, { zoomControl: true, attributionControl: true });
    L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
      maxZoom: 17,
      attribution:
        '&copy; <a href="https://opentopomap.org" target="_blank" rel="noreferrer">OpenTopoMap</a>',
    }).addTo(map);
    const group = L.layerGroup().addTo(map);
    layersRef.current = group;
    map.setView([-34.6, -58.4], 10);
    mapRef.current = map;
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const group = layersRef.current;
    if (!map || !group) return;
    group.clearLayers();

    if (!activeTrack || workPoints.length < 2) return;

    const latLngs: L.LatLngExpression[] = workPoints.map((p) => [p.lat, p.lng]);
    const line = L.polyline(latLngs, {
      color: "#0b5fff",
      weight: 3,
      opacity: 0.95,
    }).addTo(group);

    if (selection?.kind === "polygon") {
      for (const poly of selection.polygons) {
        const rings = poly.map((ring) =>
          ring.map((p) => [p.lat, p.lng] as L.LatLngExpression),
        );
        L.polygon(rings, {
          color: "#1a8f5a",
          weight: 1.5,
          fillColor: "#1a8f5a",
          fillOpacity: 0.22,
        }).addTo(group);
      }
    }

    const bounds = line.getBounds();
    if (selection) {
      const b = selectionBounds(selection);
      bounds.extend([b.south, b.west]);
      bounds.extend([b.north, b.east]);
    }
    map.fitBounds(bounds.pad(0.12));
  }, [activeTrack, workPoints, selection]);

  function onFileChange(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const parsed = parseGpx(text);
        if (parsed.length === 0) {
          setError(t.tooShort);
          setTracks([]);
          return;
        }
        setTracks(parsed);
        setTrackIndex(0);
        setFileLabel(file.name.replace(/\.[^.]+$/, "") || "gpx-route");
        setStlBuffer(null);
        setPreviewMeta(null);
        setError(null);
        setProgress(null);
      } catch {
        setError(t.parseError);
        setTracks([]);
      }
    };
    reader.onerror = () => setError(t.parseError);
    reader.readAsText(file);
  }

  function cancelJob() {
    cancelRef.current = true;
    if (jobIdRef.current != null) cancelTerrainJob(jobIdRef.current);
  }

  async function runGenerate() {
    if (!selection) {
      setError(tracks.length ? t.tooShort : t.noFile);
      return;
    }
    cancelRef.current = false;
    if (jobIdRef.current != null) cancelTerrainJob(jobIdRef.current);

    const stlOpts = { verticalScale, modelSizeMm, baseMm };
    // Long corridors: aim ~100 m/cell with a hard cap.
    const sample = {
      resolution: 160,
      metersPerCell: 100,
      maxCells: 140_000,
      terrainSmooth: 1,
      zoom: 13,
      waterMode: "keep" as const,
    };

    setGenerating(true);
    setError(null);
    setProgress(t.progress);

    const { id, promise } = generateTerrain(
      { selection, sample, stl: stlOpts },
      (done, total, phase) => {
        if (phase) {
          setProgress(phase);
          return;
        }
        setProgress(`${t.progress} ${Math.round((done / total) * 100)}%`);
      },
    );
    jobIdRef.current = id;

    try {
      const result = await promise;
      if (cancelRef.current) throw new SampleAbortedError();
      setStlBuffer(result.buffer);
      const dims = printDimensionsFromGrid(result.grid, stlOpts);
      setPreviewMeta({
        widthMm: dims.widthMm,
        depthMm: dims.depthMm,
        heightMm: dims.heightMm,
        triangles: stlTriangleCount(result.buffer),
      });
      setProgress(t.ready);
    } catch (err) {
      if (
        err instanceof SampleAbortedError ||
        (err instanceof DOMException && err.name === "AbortError") ||
        cancelRef.current
      ) {
        setProgress(t.cancelled);
      } else {
        setError(t.error);
        setProgress(null);
      }
    } finally {
      setGenerating(false);
      jobIdRef.current = null;
    }
  }

  function onDownload() {
    if (!stlBuffer) return;
    const name = stlFilenameFromLabels([
      activeTrack?.name ?? fileLabel,
      "gpx-terrain",
    ]);
    downloadArrayBuffer(stlBuffer, name);
  }

  const inputClass =
    "mt-2 w-full border border-line bg-white/70 px-3 py-2 text-sm text-ink outline-none focus:border-blue";

  return (
    <ToolChrome eyebrow={t.eyebrow} title={t.title} lead={t.lead} wide>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="space-y-5 border border-line bg-surface/50 p-5 sm:p-6">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
              {t.upload}
            </span>
            <input
              type="file"
              accept=".gpx,application/gpx+xml,text/xml,application/xml"
              onChange={(e) => onFileChange(e.target.files?.[0])}
              className="mt-3 block w-full cursor-pointer text-sm text-ink-muted file:mr-4 file:cursor-pointer file:border-0 file:bg-blue-deep file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:file:bg-blue"
            />
          </label>

          {tracks.length > 1 ? (
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
                {t.track}
              </span>
              <select
                value={trackIndex}
                onChange={(e) => {
                  setTrackIndex(Number(e.target.value));
                  setStlBuffer(null);
                  setPreviewMeta(null);
                }}
                className={inputClass}
              >
                {tracks.map((trk, i) => (
                  <option key={`${trk.name}-${i}`} value={i}>
                    {trk.name} ({formatDistanceKm(trk.lengthM, locale)})
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {activeTrack ? (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
                  {t.pathLength}
                </dt>
                <dd className="mt-1 text-ink">
                  {formatDistanceKm(activeTrack.lengthM, locale)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
                  {t.points}
                </dt>
                <dd className="mt-1 text-ink">
                  {activeTrack.points.length.toLocaleString(locale)}
                  {workPoints.length !== activeTrack.points.length
                    ? ` → ${workPoints.length.toLocaleString(locale)}`
                    : ""}
                </dd>
              </div>
              {span ? (
                <div className="col-span-2">
                  <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
                    {t.span}
                  </dt>
                  <dd className="mt-1 text-ink">
                    {span.widthKm.toFixed(1)} × {span.depthKm.toFixed(1)} km
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <label className="col-span-2 block">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
                {t.corridor}
              </span>
              <input
                type="number"
                min={50}
                max={5000}
                step={50}
                value={halfWidthM}
                onChange={(e) => {
                  setHalfWidthM(Number(e.target.value) || 400);
                  setStlBuffer(null);
                  setPreviewMeta(null);
                }}
                className={inputClass}
              />
              <span className="mt-1 block text-xs text-ink-muted">
                {t.corridorHint}
              </span>
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
                {t.verticalScale}
              </span>
              <input
                type="number"
                min={0.5}
                max={20}
                step={0.5}
                value={verticalScale}
                onChange={(e) => setVerticalScale(Number(e.target.value) || 2)}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
                {t.modelSize}
              </span>
              <input
                type="number"
                min={40}
                max={300}
                step={5}
                value={modelSizeMm}
                onChange={(e) => setModelSizeMm(Number(e.target.value) || 160)}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
                {t.baseMm}
              </span>
              <input
                type="number"
                min={0.5}
                max={20}
                step={0.5}
                value={baseMm}
                onChange={(e) => setBaseMm(Number(e.target.value) || 2)}
                className={inputClass}
              />
            </label>
          </div>

          <p className="text-xs leading-relaxed text-ink-muted">{t.hint}</p>

          {error ? (
            <p className="text-sm font-medium text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          {progress ? (
            <p className="text-sm text-ink-muted">{progress}</p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={runGenerate}
              disabled={generating || !selection}
              className="bg-blue-deep px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generating ? t.generating : t.generate}
            </button>
            {generating ? (
              <button
                type="button"
                onClick={cancelJob}
                className="border border-line bg-white/70 px-4 py-2.5 text-sm font-bold text-ink"
              >
                {t.cancel}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onDownload}
              disabled={!stlBuffer || generating}
              className="border border-line bg-white/70 px-4 py-2.5 text-sm font-bold text-ink transition hover:border-blue disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t.download}
            </button>
          </div>

          {previewMeta ? (
            <dl className="grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
                  {t.dims}
                </dt>
                <dd className="mt-1 text-ink">
                  {formatMm(previewMeta.widthMm)} × {formatMm(previewMeta.depthMm)} ×{" "}
                  {formatMm(previewMeta.heightMm)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
                  {t.triangles}
                </dt>
                <dd className="mt-1 text-ink">
                  {previewMeta.triangles.toLocaleString(locale)}
                </dd>
              </div>
            </dl>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="relative h-72 overflow-hidden border border-line bg-surface/40 sm:h-80">
            <div ref={mapHostRef} className="absolute inset-0 z-0" />
            {!activeTrack ? (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-surface/50 text-sm text-ink-muted">
                {t.mapEmpty}
              </div>
            ) : null}
          </div>
          <div className="min-h-[280px] border border-line bg-surface/40 sm:min-h-[320px]">
            <StlPreview
              buffer={stlBuffer}
              emptyLabel={t.emptyPreview}
              controlsHint={t.controlsHint}
            />
          </div>
        </div>
      </div>
    </ToolChrome>
  );
}
