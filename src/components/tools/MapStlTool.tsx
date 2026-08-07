"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useLanguage } from "@/components/LanguageProvider";
import { ToolChrome } from "@/components/tools/ToolChrome";
import { StlPreview } from "@/components/tools/StlPreview";
import {
  downloadArrayBuffer,
  estimatePrintDimensions,
  heightGridToStl,
  mergeSelections,
  metersPerDegreeLat,
  metersPerDegreeLng,
  pointInSelection,
  printDimensionsFromGrid,
  SampleAbortedError,
  sampleElevationGrid,
  selectionAreaKm2,
  selectionBounds,
  selectionDisplayName,
  selectionSpanKm,
  stlFilenameFromLabels,
  stlTriangleCount,
  type HeightGrid,
  type MapSelection,
} from "@/lib/map-stl";
import { clipSelectionToLand } from "@/lib/land-mask";
import {
  eraseBrushStrokeFromSelection,
  paintBrushStrokeToSelection,
  removePolygonAtPoint,
} from "@/lib/selection-edit";
import {
  AR_COUNTRY,
  AR_JURISDICTIONS,
  fetchArJurisdiction,
  searchBoundaries,
  type ArJurisdiction,
  type BoundarySearchHit,
} from "@/lib/political-boundaries";
import type { Locale } from "@/lib/types";
import {
  IconAdd,
  IconBoundary,
  IconBrush,
  IconCancel,
  IconCircle,
  IconClear,
  IconDownload,
  IconEllipse,
  IconEraser,
  IconFit,
  IconFreehand,
  IconGenerate,
  IconPan,
  IconRect,
  IconRedo,
  IconReplace,
  IconUndo,
} from "@/components/tools/MapStlIcons";
import { ToolTip } from "@/components/tools/ToolTip";

type EditorTool =
  | "pan"
  | "rectangle"
  | "circle"
  | "ellipse"
  | "brush"
  | "freehand"
  | "boundary"
  | "deletePiece";
type BrushMode = "paint" | "erase";
type ComposeMode = "add" | "replace";
type BasemapStyle = "hybrid" | "color";

type SelectionPiece = {
  id: string;
  name: string;
  selection: MapSelection;
  sourceSelection?: MapSelection;
  arId?: string;
};

type DetailLevel = "low" | "medium" | "high";

const DETAIL_PRESETS: Record<
  DetailLevel,
  { resolution: number; terrainSmooth: number }
> = {
  low: { resolution: 60, terrainSmooth: 3 },
  medium: { resolution: 120, terrainSmooth: 2 },
  high: { resolution: 180, terrainSmooth: 1 },
};

const copy: Record<
  Locale,
  {
    eyebrow: string;
    title: string;
    lead: string;
    pan: string;
    rectangle: string;
    circle: string;
    ellipse: string;
    brush: string;
    freehand: string;
    boundary: string;
    deletePiece: string;
    brushPaint: string;
    brushErase: string;
    brushRadius: string;
    composeAdd: string;
    composeReplace: string;
    composeMode: string;
    undo: string;
    redo: string;
    clearSelection: string;
    fitSelection: string;
    pieces: string;
    pieceSummary: string;
    previewStale: string;
    editedSelection: string;
    basemap: string;
    basemapRelief: string;
    basemapColor: string;
    exportSettings: string;
    shapeEdit: string;
    shapeEditEmpty: string;
    shapeEditPick: string;
    shapeEditUnsupported: string;
    vertices: string;
    sides: string;
    vertexNW: string;
    vertexNE: string;
    vertexSW: string;
    vertexSE: string;
    boundarySearch: string;
    boundarySearchPlaceholder: string;
    boundaryAr: string;
    boundaryCountry: string;
    boundaryLoading: string;
    boundaryClipping: string;
    boundaryEmpty: string;
    boundaryHint: string;
    boundaryError: string;
    silhouette: string;
    clipToCoast: string;
    clipToCoastHint: string;
    clipToCoastApply: string;
    north: string;
    south: string;
    east: string;
    west: string;
    widthM: string;
    heightM: string;
    centerLat: string;
    centerLng: string;
    radiusM: string;
    radiusXM: string;
    radiusYM: string;
    detail: string;
    detailLow: string;
    detailMedium: string;
    detailHigh: string;
    detailHint: string;
    detailSpeedLow: string;
    detailSpeedMedium: string;
    detailSpeedHigh: string;
    relief: string;
    modelSize: string;
    base: string;
    sizeEstimate: string;
    sizeApprox: string;
    triangles: string;
    previewMeta: string;
    needsGenerate: string;
    generate: string;
    cancel: string;
    download: string;
    preview: string;
    previewEmpty: string;
    hint: string;
    toolHintPan: string;
    toolHintDraw: string;
    toolHintBrush: string;
    toolHintFreehand: string;
    toolHintBoundary: string;
    toolHintDelete: string;
    toolHintMobile: string;
    sampling: string;
    cancelled: string;
    ready: string;
    error: string;
  }
> = {
  en: {
    eyebrow: "3D / Map",
    title: "Map to STL",
    lead: "Select terrain on the map and download a closed STL for 3D printing.",
    pan: "Pan",
    rectangle: "Rectangle",
    circle: "Circle",
    ellipse: "Ellipse",
    brush: "Brush",
    freehand: "Freehand",
    boundary: "Region",
    deletePiece: "Delete piece",
    brushPaint: "Paint",
    brushErase: "Erase",
    brushRadius: "Radius (m)",
    composeAdd: "Add",
    composeReplace: "Replace",
    composeMode: "Combine",
    undo: "Undo",
    redo: "Redo",
    clearSelection: "Clear",
    fitSelection: "Fit",
    pieces: "Selection",
    pieceSummary: "pieces",
    previewStale: "Preview is from the previous selection. Generate again to update it.",
    editedSelection: "Edited selection",
    basemap: "Basemap",
    basemapRelief: "Relief",
    basemapColor: "Color relief",
    exportSettings: "Export",
    shapeEdit: "Fine-tune",
    shapeEditEmpty: "Draw a shape to edit its values.",
    shapeEditPick: "Select a piece below to edit it.",
    shapeEditUnsupported: "This piece has no numeric handles (brush / region).",
    vertices: "Vertices",
    sides: "Sides",
    vertexNW: "NW",
    vertexNE: "NE",
    vertexSW: "SW",
    vertexSE: "SE",
    boundarySearch: "Search country / region",
    boundarySearchPlaceholder: "e.g. Chile, Uruguay, Mendoza…",
    boundaryAr: "Argentina provinces",
    boundaryCountry: "Country",
    boundaryLoading: "Loading region…",
    boundaryClipping: "Clipping to coastline…",
    boundaryEmpty: "Pick a province or search for a country/region.",
    boundaryHint:
      "Search OSM regions. Use Clip to coastline under Silhouette to drop bays and sea from the current selection.",
    boundaryError: "Could not load that region. Try another name.",
    silhouette: "Silhouette",
    clipToCoast: "Clip to coastline",
    clipToCoastHint:
      "Applies once to the current selection and keeps the result. New brush strokes or shapes are not clipped until you press again.",
    clipToCoastApply: "Apply coast clip",
    north: "North (°)",
    south: "South (°)",
    east: "East (°)",
    west: "West (°)",
    widthM: "Width (m)",
    heightM: "Height (m)",
    centerLat: "Center lat (°)",
    centerLng: "Center lng (°)",
    radiusM: "Radius (m)",
    radiusXM: "Radius X (m)",
    radiusYM: "Radius Y (m)",
    detail: "Detail",
    detailLow: "Low",
    detailMedium: "Medium",
    detailHigh: "High",
    detailHint: "Outline and relief fidelity. Higher is slower to generate.",
    detailSpeedLow: "faster",
    detailSpeedMedium: "balanced",
    detailSpeedHigh: "slower",
    relief: "Relief exaggeration",
    modelSize: "Model size (mm)",
    base: "Base (mm)",
    sizeEstimate: "Estimated print size",
    sizeApprox: "approx.",
    triangles: "triangles",
    previewMeta: "Model",
    needsGenerate: "Generate again to update the mesh (detail or water changed).",
    generate: "Build STL",
    cancel: "Cancel",
    download: "Download STL",
    preview: "Preview",
    previewEmpty: "Generate an STL to preview it here.",
    hint: "Elevation comes from SRTM tiles. Middle-drag always pans the map.",
    toolHintPan: "Drag to pan. Click a piece to select it. Space or middle-click also pan.",
    toolHintDraw: "Drag to draw. Esc cancels, Space pans, Delete clears.",
    toolHintBrush:
      "Drag to paint or erase. [ ] or Alt+scroll change radius. Esc cancels the stroke.",
    toolHintFreehand: "Drag a path; release to close start→end. Esc cancels.",
    toolHintBoundary: "Pick a country or province, or search another region.",
    toolHintDelete: "Hover a piece to highlight it, then click to remove it.",
    toolHintMobile: "On touch: one finger draws, two fingers pan the map.",
    sampling: "Sampling elevation…",
    cancelled: "Cancelled",
    ready: "STL ready",
    error: "Could not build the STL. Try a smaller area or lower resolution.",
  },
  es: {
    eyebrow: "3D / Mapa",
    title: "Mapa a STL",
    lead: "Seleccioná terreno en el mapa y descargá un STL cerrado para impresión 3D.",
    pan: "Mover",
    rectangle: "Rectángulo",
    circle: "Círculo",
    ellipse: "Elipse",
    brush: "Pincel",
    freehand: "Mano alzada",
    boundary: "Región",
    deletePiece: "Borrar pieza",
    brushPaint: "Pintar",
    brushErase: "Borrar",
    brushRadius: "Radio (m)",
    composeAdd: "Agregar",
    composeReplace: "Reemplazar",
    composeMode: "Combinar",
    undo: "Deshacer",
    redo: "Rehacer",
    clearSelection: "Limpiar",
    fitSelection: "Ajustar",
    pieces: "Selección",
    pieceSummary: "piezas",
    previewStale: "La vista es de la selección anterior. Generá de nuevo para actualizarla.",
    editedSelection: "Selección editada",
    basemap: "Mapa base",
    basemapRelief: "Relieve",
    basemapColor: "Relieve color",
    exportSettings: "Exportar",
    shapeEdit: "Ajustar",
    shapeEditEmpty: "Dibujá una forma para editar sus valores.",
    shapeEditPick: "Elegí una pieza abajo para ajustarla.",
    shapeEditUnsupported: "Esta pieza no tiene controles numéricos (pincel / región).",
    vertices: "Vértices",
    sides: "Lados",
    vertexNW: "NO",
    vertexNE: "NE",
    vertexSW: "SO",
    vertexSE: "SE",
    boundarySearch: "Buscar país / región",
    boundarySearchPlaceholder: "ej. Chile, Uruguay, Mendoza…",
    boundaryAr: "Provincias de Argentina",
    boundaryCountry: "País",
    boundaryLoading: "Cargando región…",
    boundaryClipping: "Recortando a la costa…",
    boundaryEmpty: "Elegí una provincia o buscá un país/región.",
    boundaryHint:
      "Buscá regiones OSM. Usá Recortar a la costa en Silueta para sacar bahías y mar de la selección actual.",
    boundaryError: "No se pudo cargar esa región. Probá con otro nombre.",
    silhouette: "Silueta",
    clipToCoast: "Recortar a la costa",
    clipToCoastHint:
      "Se aplica una vez a la selección actual y queda el resultado. Trazos o formas nuevas no se recortan hasta que lo pulses de nuevo.",
    clipToCoastApply: "Aplicar recorte",
    north: "Norte (°)",
    south: "Sur (°)",
    east: "Este (°)",
    west: "Oeste (°)",
    widthM: "Ancho (m)",
    heightM: "Alto (m)",
    centerLat: "Lat. centro (°)",
    centerLng: "Lng. centro (°)",
    radiusM: "Radio (m)",
    radiusXM: "Radio X (m)",
    radiusYM: "Radio Y (m)",
    detail: "Detalle",
    detailLow: "Bajo",
    detailMedium: "Medio",
    detailHigh: "Alto",
    detailHint: "Fidelidad de contorno y relieve. Más alto tarda más.",
    detailSpeedLow: "más rápido",
    detailSpeedMedium: "equilibrado",
    detailSpeedHigh: "más lento",
    relief: "Exageración del relieve",
    modelSize: "Tamaño del modelo (mm)",
    base: "Base (mm)",
    sizeEstimate: "Tamaño estimado de impresión",
    sizeApprox: "aprox.",
    triangles: "triángulos",
    previewMeta: "Modelo",
    needsGenerate: "Generá de nuevo para actualizar la malla (cambió detalle o agua).",
    generate: "Generar STL",
    cancel: "Cancelar",
    download: "Descargar STL",
    preview: "Previsualización",
    previewEmpty: "Generá un STL para previsualizarlo acá.",
    hint: "La elevación viene de tiles SRTM. El arrastre con la rueda siempre mueve el mapa.",
    toolHintPan: "Arrastrá para mover el mapa. Clic en una pieza para seleccionarla. Espacio o clic medio también panean.",
    toolHintDraw: "Arrastrá para dibujar. Esc cancela, Espacio panea, Supr limpia.",
    toolHintBrush:
      "Arrastrá para pintar o borrar. [ ] o Alt+rueda cambian el radio. Esc cancela el trazo.",
    toolHintFreehand: "Trazá un camino; al soltar se cierra inicio→fin. Esc cancela.",
    toolHintBoundary: "Elegí un país o provincia, o buscá otra región.",
    toolHintDelete: "Pasá el mouse sobre una pieza para resaltarla y hacé clic para borrarla.",
    toolHintMobile: "En táctil: un dedo dibuja, dos dedos mueven el mapa.",
    sampling: "Muestreando elevación…",
    cancelled: "Cancelado",
    ready: "STL listo",
    error: "No se pudo armar el STL. Probá un área más chica o menos resolución.",
  },
};

const inputClass =
  "mt-1 w-full border border-line bg-white/70 px-2 py-1 text-xs text-ink outline-none focus:border-blue";
const fieldLabelClass =
  "text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted";
const sectionLabelClass =
  "text-[10px] font-semibold uppercase tracking-[0.14em] text-green";

function newPieceId() {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function mergePieces(pieces: SelectionPiece[]): MapSelection | null {
  if (pieces.length === 0) return null;
  let acc = pieces[0]!.selection;
  for (let i = 1; i < pieces.length; i += 1) {
    acc = mergeSelections(acc, pieces[i]!.selection);
  }
  if (acc.kind === "polygon") {
    return { ...acc, name: pieces.map((p) => p.name).join(" + ") };
  }
  return acc;
}

function clonePieces(pieces: SelectionPiece[]): SelectionPiece[] {
  return pieces.map((p) => ({ ...p }));
}

type HistoryEntry = {
  pieces: SelectionPiece[];
};

export function MapStlTool() {
  const { locale } = useLanguage();
  const t = copy[locale];

  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObj = useRef<L.Map | null>(null);
  const shapeLayer = useRef<L.Layer | null>(null);
  const freehandDraftLayer = useRef<L.Layer | null>(null);
  const brushPreviewLayer = useRef<L.Circle | null>(null);
  const brushStrokeLayer = useRef<L.Polyline | null>(null);
  const brushStrokeCenters = useRef<{ lat: number; lng: number }[]>([]);
  const brushStrokeBase = useRef<MapSelection | null>(null);
  const baseLayer = useRef<L.TileLayer | null>(null);
  const reliefOverlay = useRef<L.TileLayer | null>(null);
  const dragStart = useRef<L.LatLng | null>(null);
  const shapeDragMoved = useRef(false);
  const hoverPieceId = useRef<string | null>(null);
  const lastBrushPt = useRef<L.LatLng | null>(null);
  const middlePan = useRef<{ x: number; y: number } | null>(null);
  const freehandPts = useRef<L.LatLng[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const cancelFlagRef = useRef(false);
  const historyRef = useRef<HistoryEntry[]>([{ pieces: [] }]);
  const historyIndexRef = useRef(0);
  const strokeWorking = useRef<MapSelection | null>(null);
  const clipJobIdRef = useRef(0);

  const [tool, setTool] = useState<EditorTool>("pan");
  const [brushMode, setBrushMode] = useState<BrushMode>("paint");
  const [composeMode, setComposeMode] = useState<ComposeMode>("add");
  const [brushRadiusM, setBrushRadiusM] = useState(3000);
  const [basemap, setBasemap] = useState<BasemapStyle>("hybrid");
  const [pieces, setPieces] = useState<SelectionPiece[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [clipBusy, setClipBusy] = useState(false);
  const [detail, setDetail] = useState<DetailLevel>("medium");
  const [verticalScale, setVerticalScale] = useState(2);
  const [modelSizeMm, setModelSizeMm] = useState(120);
  const [baseMm, setBaseMm] = useState(2);
  const [progress, setProgress] = useState<string | null>(null);
  const [heightGrid, setHeightGrid] = useState<HeightGrid | null>(null);
  const [sampledKey, setSampledKey] = useState<string | null>(null);
  const [stlBuffer, setStlBuffer] = useState<ArrayBuffer | null>(null);
  const [stlStale, setStlStale] = useState(false);
  const [previewMeta, setPreviewMeta] = useState<{
    widthMm: number;
    depthMm: number;
    heightMm: number;
    triangles: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [exportOpen, setExportOpen] = useState(true);
  const [mapZoom, setMapZoom] = useState(11);
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [boundaryQuery, setBoundaryQuery] = useState("");
  const [boundaryHits, setBoundaryHits] = useState<BoundarySearchHit[]>([]);
  const [boundaryLoading, setBoundaryLoading] = useState(false);
  const [jobProgress, setJobProgress] = useState<{
    label: string;
    done: number;
    total: number;
    indeterminate?: boolean;
  } | null>(null);

  const toolRef = useRef(tool);
  const brushModeRef = useRef(brushMode);
  const composeModeRef = useRef(composeMode);
  const brushRadiusRef = useRef(brushRadiusM);
  const piecesRef = useRef(pieces);
  const selectedPieceIdRef = useRef(selectedPieceId);
  const selectionRef = useRef<MapSelection | null>(null);
  const editedLabelRef = useRef(t.editedSelection);
  const spacePanRef = useRef(false);
  const touchPanRef = useRef<{ x: number; y: number } | null>(null);
  const cancelDraftRef = useRef<() => void>(() => {});
  const restoreCursorRef = useRef<() => void>(() => {});
  const hasPreviewRef = useRef(false);
  const undoRef = useRef<() => void>(() => {});
  const redoRef = useRef<() => void>(() => {});
  const clearSelectionRef = useRef<() => void>(() => {});
  const fitSelectionRef = useRef<() => void>(() => {});
  const nudgeBrushRef = useRef<(dir: 1 | -1) => void>(() => {});
  const commitDrawnRef = useRef<(drawn: MapSelection, name: string) => void>(
    () => {},
  );
  const commitMergedEditRef = useRef<(merged: MapSelection | null) => void>(
    () => {},
  );
  toolRef.current = tool;
  brushModeRef.current = brushMode;
  composeModeRef.current = composeMode;
  brushRadiusRef.current = brushRadiusM;
  piecesRef.current = pieces;
  selectedPieceIdRef.current = selectedPieceId;
  editedLabelRef.current = t.editedSelection;

  const selection = useMemo(() => mergePieces(pieces), [pieces]);
  selectionRef.current = selection;

  const syncHistoryButtons = () => {
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  };

  const applyPieces = (
    next: SelectionPiece[],
    recordHistory: boolean,
    fit = false,
    selectId?: string | null,
  ) => {
    setPieces(next);
    piecesRef.current = next;
    const merged = mergePieces(next);
    selectionRef.current = merged;

    let nextSelected =
      selectId !== undefined ? selectId : selectedPieceIdRef.current;
    if (nextSelected && !next.some((p) => p.id === nextSelected)) {
      nextSelected = next[next.length - 1]?.id ?? null;
    }
    if (!nextSelected && next.length === 1) nextSelected = next[0]!.id;
    selectedPieceIdRef.current = nextSelected;
    setSelectedPieceId(nextSelected);

    if (hasPreviewRef.current) setStlStale(true);
    const map = mapObj.current;
    if (map) {
      drawPieces(map, next, nextSelected, shapeLayer);
      hoverPieceId.current = null;
      if (fit && merged) {
        const b = selectionBounds(merged);
        map.fitBounds(
          [
            [b.south, b.west],
            [b.north, b.east],
          ],
          { padding: [24, 24], maxZoom: 11 },
        );
      }
    }
    if (recordHistory) {
      const trimmed = historyRef.current.slice(0, historyIndexRef.current + 1);
      trimmed.push({ pieces: clonePieces(next) });
      if (trimmed.length > 60) trimmed.shift();
      historyRef.current = trimmed;
      historyIndexRef.current = trimmed.length - 1;
      syncHistoryButtons();
    }
  };

  const restoreHistoryEntry = (entry: HistoryEntry) => {
    applyPieces(clonePieces(entry.pieces), false);
  };

  const commitDrawn = (drawn: MapSelection, name: string) => {
    const piece = materializePiece(drawn, name);
    const next =
      composeModeRef.current === "add" && piecesRef.current.length > 0
        ? [...piecesRef.current, piece]
        : [piece];
    applyPieces(next, true, false, piece.id);
  };

  const commitMergedEdit = (merged: MapSelection | null) => {
    if (!merged) {
      applyPieces([], true, false, null);
      return;
    }
    const name =
      piecesRef.current.length === 1
        ? piecesRef.current[0]!.name
        : editedLabelRef.current;
    const piece = materializePiece(merged, name);
    applyPieces([piece], true, false, piece.id);
  };

  commitDrawnRef.current = commitDrawn;
  commitMergedEditRef.current = commitMergedEdit;

  function materializePiece(
    source: MapSelection,
    name: string,
    arId?: string,
  ): SelectionPiece {
    return {
      id: newPieceId(),
      name: selectionDisplayName(source) || name,
      selection: source,
      sourceSelection: source,
      arId,
    };
  }

  const undo = () => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    restoreHistoryEntry(historyRef.current[historyIndexRef.current]!);
    syncHistoryButtons();
  };

  const redo = () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    restoreHistoryEntry(historyRef.current[historyIndexRef.current]!);
    syncHistoryButtons();
  };

  const fitSelection = () => {
    const map = mapObj.current;
    const sel = selectionRef.current;
    if (!map || !sel) return;
    const b = selectionBounds(sel);
    map.fitBounds(
      [
        [b.south, b.west],
        [b.north, b.east],
      ],
      { padding: [28, 28], maxZoom: 12 },
    );
  };

  const nudgeBrushRadius = (dir: 1 | -1) => {
    setBrushRadiusM((r) => {
      const next = Math.round((r * (dir > 0 ? 1.25 : 0.8)) / 100) * 100;
      return Math.min(50000, Math.max(200, next));
    });
  };

  const cancelActiveJob = () => {
    cancelFlagRef.current = true;
    abortRef.current?.abort();
  };

  undoRef.current = undo;
  redoRef.current = redo;
  fitSelectionRef.current = fitSelection;
  nudgeBrushRef.current = nudgeBrushRadius;

  useEffect(() => {
    if (!mapRef.current || mapObj.current) return;

    const map = L.map(mapRef.current, {
      center: [-34.55, -58.5],
      zoom: 11,
      dragging: true,
    });
    mapObj.current = map;
    setMapZoom(map.getZoom());
    applyBasemap(map, "hybrid", baseLayer, reliefOverlay);

    const onZoom = () => setMapZoom(map.getZoom());
    map.on("zoom", onZoom);
    map.on("zoomend", onZoom);
    const container = map.getContainer();

    const restoreCursor = () => {
      if (spacePanRef.current) {
        container.style.cursor = "grab";
        return;
      }
      const current = toolRef.current;
      if (current === "pan") container.style.cursor = "";
      else if (current === "deletePiece" || current === "boundary") {
        container.style.cursor = current === "deletePiece" ? "pointer" : "default";
      } else container.style.cursor = "crosshair";
    };
    restoreCursorRef.current = restoreCursor;

    let lockedOverflow: { html: string; body: string } | null = null;
    const lockPageScroll = () => {
      if (lockedOverflow) return;
      lockedOverflow = {
        html: document.documentElement.style.overflow,
        body: document.body.style.overflow,
      };
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    };
    const unlockPageScroll = () => {
      if (!lockedOverflow) return;
      document.documentElement.style.overflow = lockedOverflow.html;
      document.body.style.overflow = lockedOverflow.body;
      lockedOverflow = null;
    };
    const blockPageScroll = (e: Event) => {
      if (middlePan.current) e.preventDefault();
    };

    const onMiddleDown = (e: MouseEvent) => {
      if (e.button !== 1) return;
      e.preventDefault();
      e.stopPropagation();
      middlePan.current = { x: e.clientX, y: e.clientY };
      dragStart.current = null;
      container.style.cursor = "grabbing";
      lockPageScroll();
    };
    const onMiddleMove = (e: MouseEvent) => {
      if (!middlePan.current) return;
      e.preventDefault();
      const dx = e.clientX - middlePan.current.x;
      const dy = e.clientY - middlePan.current.y;
      middlePan.current = { x: e.clientX, y: e.clientY };
      map.panBy([-dx, -dy], { animate: false });
    };
    const onMiddleUp = (e: MouseEvent) => {
      if (e.button !== 1 || !middlePan.current) return;
      middlePan.current = null;
      unlockPageScroll();
      restoreCursor();
    };
    const preventMiddleAutoScroll = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault();
    };

    const clearFreehandDraft = () => {
      if (freehandDraftLayer.current) {
        map.removeLayer(freehandDraftLayer.current);
        freehandDraftLayer.current = null;
      }
    };

    const drawFreehandDraft = (pts: L.LatLng[]) => {
      clearFreehandDraft();
      if (pts.length < 2) {
        if (pts[0]) {
          freehandDraftLayer.current = L.circleMarker(pts[0], {
            radius: 4,
            color: "#0c3d6e",
            weight: 2,
            fillColor: "#1f8f6a",
            fillOpacity: 1,
          }).addTo(map);
        }
        return;
      }
      const group = L.layerGroup();
      L.polyline(
        pts.map((p) => [p.lat, p.lng] as [number, number]),
        {
          color: "#0c3d6e",
          weight: 3,
          opacity: 0.95,
          lineCap: "round",
          lineJoin: "round",
        },
      ).addTo(group);
      const first = pts[0]!;
      const last = pts[pts.length - 1]!;
      L.polyline(
        [
          [last.lat, last.lng],
          [first.lat, first.lng],
        ],
        { color: "#1f8f6a", weight: 2, opacity: 0.7, dashArray: "6 6" },
      ).addTo(group);
      L.circleMarker(first, {
        radius: 5,
        color: "#1f8f6a",
        weight: 2,
        fillColor: "#ffffff",
        fillOpacity: 1,
      }).addTo(group);
      freehandDraftLayer.current = group.addTo(map);
    };

    const finishFreehand = (endLatLng?: L.LatLng) => {
      const pts = freehandPts.current;
      if (endLatLng) {
        const last = pts[pts.length - 1];
        if (!last || last.lat !== endLatLng.lat || last.lng !== endLatLng.lng) {
          pts.push(endLatLng);
        }
      }
      clearFreehandDraft();
      dragStart.current = null;
      if (pts.length >= 3) {
        const first = pts[0]!;
        const ring = pts.map((p) => ({ lat: p.lat, lng: p.lng }));
        const last = ring[ring.length - 1]!;
        if (last.lat !== first.lat || last.lng !== first.lng) {
          ring.push({ lat: first.lat, lng: first.lng });
        }
        commitDrawnRef.current(
          { kind: "polygon", name: "Freehand", polygons: [[ring]] },
          "Freehand",
        );
      } else {
        drawPieces(map, piecesRef.current, selectedPieceIdRef.current, shapeLayer);
      }
      freehandPts.current = [];
      if (toolRef.current === "pan") map.dragging.enable();
      else map.dragging.disable();
    };

    const clearBrushStrokePreview = () => {
      if (brushStrokeLayer.current) {
        map.removeLayer(brushStrokeLayer.current);
        brushStrokeLayer.current = null;
      }
      brushStrokeCenters.current = [];
      brushStrokeBase.current = null;
    };

    const brushStrokeStyle = (at: L.LatLng) => {
      const erase = brushModeRef.current === "erase";
      const radiusM = brushRadiusRef.current;
      const east = L.latLng(
        at.lat,
        at.lng + radiusM / Math.max(metersPerDegreeLng(at.lat), 1e-9),
      );
      const radiusPx = map
        .latLngToContainerPoint(at)
        .distanceTo(map.latLngToContainerPoint(east));
      return {
        color: erase ? "#f04438" : "#1f8f6a",
        weight: Math.max(4, radiusPx * 2),
        opacity: erase ? 0.4 : 0.45,
        lineCap: "round" as const,
        lineJoin: "round" as const,
        interactive: false,
      };
    };

    const syncBrushStrokePreview = () => {
      const pts = brushStrokeCenters.current;
      if (pts.length === 0) return;
      const latlngs =
        pts.length === 1
          ? [L.latLng(pts[0]!.lat, pts[0]!.lng), L.latLng(pts[0]!.lat, pts[0]!.lng)]
          : pts.map((p) => L.latLng(p.lat, p.lng));
      const style = brushStrokeStyle(latlngs[latlngs.length - 1]!);
      if (!brushStrokeLayer.current) {
        brushStrokeLayer.current = L.polyline(latlngs, style).addTo(map);
        return;
      }
      brushStrokeLayer.current.setLatLngs(latlngs);
      brushStrokeLayer.current.setStyle(style);
    };

    const appendBrushCenter = (latlng: L.LatLng) => {
      const center = { lat: latlng.lat, lng: latlng.lng };
      const pts = brushStrokeCenters.current;
      const last = pts[pts.length - 1];
      if (last) {
        const a = map.latLngToContainerPoint(L.latLng(last.lat, last.lng));
        const b = map.latLngToContainerPoint(latlng);
        // Keep path dense enough for a continuous stroke look.
        if (a.distanceTo(b) < 2.5) return false;
      }
      pts.push(center);
      syncBrushStrokePreview();
      return true;
    };

    const appendBrushAlong = (from: L.LatLng, to: L.LatLng) => {
      const a = map.latLngToContainerPoint(from);
      const b = map.latLngToContainerPoint(to);
      const distPx = a.distanceTo(b);
      const n = Math.max(1, Math.ceil(distPx / 4));
      for (let i = 1; i <= n; i += 1) {
        const u = i / n;
        appendBrushCenter(
          L.latLng(
            from.lat + (to.lat - from.lat) * u,
            from.lng + (to.lng - from.lng) * u,
          ),
        );
      }
    };

    const finishBrushStroke = () => {
      if (!dragStart.current || toolRef.current !== "brush") return;
      dragStart.current = null;
      lastBrushPt.current = null;
      const centers = brushStrokeCenters.current.slice();
      const radius = brushRadiusRef.current;
      const base = brushStrokeBase.current;
      clearBrushStrokePreview();
      if (centers.length === 0) {
        strokeWorking.current = null;
        map.dragging.disable();
        return;
      }
      const next =
        brushModeRef.current === "erase"
          ? base
            ? eraseBrushStrokeFromSelection(base, centers, radius)
            : null
          : paintBrushStrokeToSelection(base, centers, radius);
      strokeWorking.current = null;
      commitMergedEditRef.current(next);
      map.dragging.disable();
    };

    const updateBrushPreview = (latlng: L.LatLng) => {
      if (toolRef.current !== "brush") {
        if (brushPreviewLayer.current) {
          map.removeLayer(brushPreviewLayer.current);
          brushPreviewLayer.current = null;
        }
        return;
      }
      const erase = brushModeRef.current === "erase";
      const color = erase ? "#b42318" : "#0c3d6e";
      const fill = erase ? "#f04438" : "#1f8f6a";
      if (!brushPreviewLayer.current) {
        brushPreviewLayer.current = L.circle(latlng, {
          radius: brushRadiusRef.current,
          color,
          weight: 2,
          fillColor: fill,
          fillOpacity: 0.18,
          interactive: false,
        }).addTo(map);
        return;
      }
      brushPreviewLayer.current.setLatLng(latlng);
      brushPreviewLayer.current.setRadius(brushRadiusRef.current);
      brushPreviewLayer.current.setStyle({ color, fillColor: fill });
    };

    const cancelDraft = () => {
      const hadDraft =
        Boolean(dragStart.current) ||
        freehandPts.current.length > 0 ||
        brushStrokeCenters.current.length > 0 ||
        Boolean(strokeWorking.current);
      dragStart.current = null;
      lastBrushPt.current = null;
      strokeWorking.current = null;
      freehandPts.current = [];
      clearFreehandDraft();
      clearBrushStrokePreview();
      drawPieces(map, piecesRef.current, selectedPieceIdRef.current, shapeLayer);
      if (spacePanRef.current || toolRef.current === "pan") map.dragging.enable();
      else map.dragging.disable();
      restoreCursor();
      return hadDraft;
    };
    cancelDraftRef.current = cancelDraft;

    const selectPieceAt = (latlng: L.LatLng) => {
      const list = piecesRef.current;
      for (let i = list.length - 1; i >= 0; i -= 1) {
        const piece = list[i]!;
        if (pointInSelection(latlng.lat, latlng.lng, piece.selection)) {
          selectedPieceIdRef.current = piece.id;
          setSelectedPieceId(piece.id);
          hoverPieceId.current = null;
          drawPieces(map, list, piece.id, shapeLayer);
          return true;
        }
      }
      return false;
    };

    const hitPieceIdAt = (latlng: L.LatLng) => {
      const list = piecesRef.current;
      for (let i = list.length - 1; i >= 0; i -= 1) {
        const piece = list[i]!;
        if (pointInSelection(latlng.lat, latlng.lng, piece.selection)) {
          return piece.id;
        }
      }
      return null;
    };

    const redrawPieces = (draft?: MapSelection | null) => {
      drawPieces(
        map,
        piecesRef.current,
        selectedPieceIdRef.current,
        shapeLayer,
        {
          hoverId: hoverPieceId.current,
          draft: draft ?? null,
        },
      );
    };

    const onClickSelect = (e: L.LeafletMouseEvent) => {
      if (toolRef.current !== "pan") return;
      if (middlePan.current || spacePanRef.current || touchPanRef.current) return;
      selectPieceAt(e.latlng);
    };

    const onDown = (e: L.LeafletMouseEvent) => {
      if (e.originalEvent.button !== 0 || middlePan.current || spacePanRef.current || touchPanRef.current) return;
      const currentTool = toolRef.current;
      if (currentTool === "pan" || currentTool === "boundary") return;

      if (currentTool === "deletePiece") {
        const list = piecesRef.current;
        if (list.length === 0) return;
        if (list.length === 1) {
          const only = list[0]!;
          const trimmed = removePolygonAtPoint(only.selection, {
            lat: e.latlng.lat,
            lng: e.latlng.lng,
          });
          if (trimmed === only.selection) return;
          if (!trimmed) applyPieces([], true);
          else
            applyPieces(
              [
                {
                  ...only,
                  selection: trimmed,
                  sourceSelection: trimmed,
                },
              ],
              true,
            );
        } else {
          let hit = -1;
          for (let i = list.length - 1; i >= 0; i -= 1) {
            if (pointInSelection(e.latlng.lat, e.latlng.lng, list[i]!.selection)) {
              hit = i;
              break;
            }
          }
          if (hit < 0) return;
          applyPieces(
            list.filter((_, i) => i !== hit),
            true,
          );
        }
        hoverPieceId.current = null;
        L.DomEvent.stop(e.originalEvent);
        return;
      }

      if (currentTool === "brush") {
        dragStart.current = e.latlng;
        lastBrushPt.current = e.latlng;
        clearBrushStrokePreview();
        brushStrokeBase.current = selectionRef.current;
        map.dragging.disable();
        appendBrushCenter(e.latlng);
        updateBrushPreview(e.latlng);
        L.DomEvent.stop(e.originalEvent);
        return;
      }

      if (currentTool === "freehand") {
        freehandPts.current = [e.latlng];
        dragStart.current = e.latlng;
        shapeDragMoved.current = false;
        map.dragging.disable();
        drawFreehandDraft(freehandPts.current);
        L.DomEvent.stop(e.originalEvent);
        return;
      }

      dragStart.current = e.latlng;
      shapeDragMoved.current = false;
      map.dragging.disable();
      L.DomEvent.stop(e.originalEvent);
    };

    const appendFreehandPoint = (latlng: L.LatLng) => {
      const pts = freehandPts.current;
      const last = pts[pts.length - 1];
      if (!last) {
        pts.push(latlng);
        drawFreehandDraft(pts);
        return;
      }
      const a = map.latLngToContainerPoint(last);
      const b = map.latLngToContainerPoint(latlng);
      if (a.distanceTo(b) < 4) return;
      pts.push(latlng);
      drawFreehandDraft(pts);
    };

    const onMove = (e: L.LeafletMouseEvent) => {
      if (middlePan.current || spacePanRef.current || touchPanRef.current) return;

      if (toolRef.current === "deletePiece") {
        const hit = hitPieceIdAt(e.latlng);
        if (hit !== hoverPieceId.current) {
          hoverPieceId.current = hit;
          redrawPieces();
        }
        return;
      }

      if (toolRef.current === "brush") {
        updateBrushPreview(e.latlng);
        return;
      }
      if (!dragStart.current) {
        if (hoverPieceId.current) {
          hoverPieceId.current = null;
          redrawPieces();
        }
        return;
      }
      if (toolRef.current === "freehand") return;
      if (
        toolRef.current === "rectangle" ||
        toolRef.current === "circle" ||
        toolRef.current === "ellipse"
      ) {
        const a = map.latLngToContainerPoint(dragStart.current);
        const b = map.latLngToContainerPoint(e.latlng);
        if (a.distanceTo(b) >= 5) shapeDragMoved.current = true;
        if (!shapeDragMoved.current) return;
        const next = selectionFromDrag(
          toolRef.current,
          dragStart.current,
          e.latlng,
        );
        redrawPieces(next);
      }
    };

    const onUp = (e: L.LeafletMouseEvent) => {
      if (e.originalEvent.button !== 0 || !dragStart.current) return;
      if (toolRef.current === "freehand" || toolRef.current === "brush") return;
      if (
        toolRef.current === "rectangle" ||
        toolRef.current === "circle" ||
        toolRef.current === "ellipse"
      ) {
        const start = dragStart.current;
        dragStart.current = null;
        if (!shapeDragMoved.current) {
          selectPieceAt(e.latlng);
          redrawPieces();
        } else {
          const drawn = selectionFromDrag(toolRef.current, start, e.latlng);
          commitDrawnRef.current(drawn, selectionDisplayName(drawn));
        }
        shapeDragMoved.current = false;
        if (toolRef.current === "pan") map.dragging.enable();
        else map.dragging.disable();
        return;
      }
      dragStart.current = null;
      shapeDragMoved.current = false;
      if (toolRef.current === "pan") map.dragging.enable();
      else map.dragging.disable();
    };

    const onWindowMove = (e: MouseEvent) => {
      if (middlePan.current || spacePanRef.current || touchPanRef.current) return;
      const rect = container.getBoundingClientRect();
      const point = L.point(e.clientX - rect.left, e.clientY - rect.top);
      const latlng = map.containerPointToLatLng(point);

      if (toolRef.current === "brush") {
        const overMap =
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom;
        if (!dragStart.current && !overMap) {
          if (brushPreviewLayer.current) {
            map.removeLayer(brushPreviewLayer.current);
            brushPreviewLayer.current = null;
          }
          return;
        }
        updateBrushPreview(latlng);
        if (!dragStart.current || !lastBrushPt.current) return;
        appendBrushAlong(lastBrushPt.current, latlng);
        lastBrushPt.current = latlng;
        return;
      }

      if (toolRef.current !== "freehand" || !dragStart.current) return;
      appendFreehandPoint(latlng);
    };

    const onWindowUp = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (toolRef.current === "brush" && dragStart.current) {
        finishBrushStroke();
        return;
      }
      if (toolRef.current !== "freehand" || !dragStart.current) return;
      const rect = container.getBoundingClientRect();
      const point = L.point(e.clientX - rect.left, e.clientY - rect.top);
      finishFreehand(map.containerPointToLatLng(point));
    };

    const latlngFromClient = (clientX: number, clientY: number) => {
      const rect = container.getBoundingClientRect();
      return map.containerPointToLatLng(
        L.point(clientX - rect.left, clientY - rect.top),
      );
    };

    const touchMid = (touches: TouchList) => {
      const a = touches[0]!;
      const b = touches[1] ?? a;
      return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        cancelDraft();
        touchPanRef.current = touchMid(e.touches);
        lockPageScroll();
        return;
      }
      if (toolRef.current === "brush" && e.touches[0]) {
        updateBrushPreview(
          latlngFromClient(e.touches[0].clientX, e.touches[0].clientY),
        );
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (touchPanRef.current && e.touches.length >= 2) {
        e.preventDefault();
        const mid = touchMid(e.touches);
        map.panBy(
          [touchPanRef.current.x - mid.x, touchPanRef.current.y - mid.y],
          { animate: false },
        );
        touchPanRef.current = mid;
        return;
      }
      if (toolRef.current === "brush" && e.touches[0]) {
        updateBrushPreview(
          latlngFromClient(e.touches[0].clientX, e.touches[0].clientY),
        );
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        touchPanRef.current = null;
        unlockPageScroll();
      }
      if (e.touches.length === 0 && toolRef.current === "brush" && !dragStart.current) {
        if (brushPreviewLayer.current) {
          map.removeLayer(brushPreviewLayer.current);
          brushPreviewLayer.current = null;
        }
      }
    };

    const onWheelBrush = (e: WheelEvent) => {
      if (toolRef.current !== "brush" || (!e.altKey && !e.ctrlKey)) return;
      e.preventDefault();
      e.stopPropagation();
      nudgeBrushRef.current(e.deltaY < 0 ? 1 : -1);
    };

    const onMapMouseLeave = () => {
      if (toolRef.current !== "deletePiece") return;
      if (!hoverPieceId.current) return;
      hoverPieceId.current = null;
      redrawPieces();
    };

    container.addEventListener("mousedown", onMiddleDown, true);
    window.addEventListener("mousemove", onMiddleMove, { passive: false });
    window.addEventListener("mouseup", onMiddleUp);
    window.addEventListener("mousemove", onWindowMove);
    window.addEventListener("mouseup", onWindowUp);
    window.addEventListener("wheel", blockPageScroll, { passive: false });
    window.addEventListener("scroll", blockPageScroll, { passive: false });
    container.addEventListener("auxclick", preventMiddleAutoScroll);
    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchmove", onTouchMove, { passive: false });
    container.addEventListener("touchend", onTouchEnd);
    container.addEventListener("touchcancel", onTouchEnd);
    container.addEventListener("wheel", onWheelBrush, { passive: false });
    container.addEventListener("mouseleave", onMapMouseLeave);
    map.on("mousedown", onDown);
    map.on("mousemove", onMove);
    map.on("mouseup", onUp);
    map.on("click", onClickSelect);

    return () => {
      unlockPageScroll();
      container.removeEventListener("mousedown", onMiddleDown, true);
      window.removeEventListener("mousemove", onMiddleMove);
      window.removeEventListener("mouseup", onMiddleUp);
      window.removeEventListener("mousemove", onWindowMove);
      window.removeEventListener("mouseup", onWindowUp);
      window.removeEventListener("wheel", blockPageScroll);
      window.removeEventListener("scroll", blockPageScroll);
      container.removeEventListener("auxclick", preventMiddleAutoScroll);
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
      container.removeEventListener("touchcancel", onTouchEnd);
      container.removeEventListener("wheel", onWheelBrush);
      container.removeEventListener("mouseleave", onMapMouseLeave);
      map.off("mousedown", onDown);
      map.off("mousemove", onMove);
      map.off("mouseup", onUp);
      map.off("click", onClickSelect);
      map.off("zoom", onZoom);
      map.off("zoomend", onZoom);
      if (freehandDraftLayer.current) map.removeLayer(freehandDraftLayer.current);
      if (brushPreviewLayer.current) map.removeLayer(brushPreviewLayer.current);
      if (brushStrokeLayer.current) map.removeLayer(brushStrokeLayer.current);
      map.remove();
      mapObj.current = null;
      shapeLayer.current = null;
      baseLayer.current = null;
      reliefOverlay.current = null;
      middlePan.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapObj.current;
    if (!map) return;
    applyBasemap(map, basemap, baseLayer, reliefOverlay);
  }, [basemap]);

  useEffect(() => {
    const map = mapObj.current;
    if (!map) return;
    if (tool === "pan" || tool === "boundary") {
      map.dragging.enable();
      map.getContainer().style.cursor = tool === "boundary" ? "default" : "";
    } else {
      map.dragging.disable();
      map.getContainer().style.cursor =
        tool === "deletePiece" ? "pointer" : "crosshair";
    }
    if (tool !== "brush" && brushPreviewLayer.current) {
      map.removeLayer(brushPreviewLayer.current);
      brushPreviewLayer.current = null;
    }
    if (tool !== "brush" && brushStrokeLayer.current) {
      map.removeLayer(brushStrokeLayer.current);
      brushStrokeLayer.current = null;
      brushStrokeCenters.current = [];
      brushStrokeBase.current = null;
    }
    if (tool !== "deletePiece" && hoverPieceId.current) {
      hoverPieceId.current = null;
      drawPieces(map, piecesRef.current, selectedPieceIdRef.current, shapeLayer);
    }
  }, [tool]);

  useEffect(() => {
    if (brushPreviewLayer.current) {
      brushPreviewLayer.current.setRadius(brushRadiusM);
    }
    const map = mapObj.current;
    const stroke = brushStrokeLayer.current;
    const pts = brushStrokeCenters.current;
    if (!map || !stroke || pts.length === 0) return;
    const at = pts[pts.length - 1]!;
    const east = L.latLng(
      at.lat,
      at.lng + brushRadiusM / Math.max(metersPerDegreeLng(at.lat), 1e-9),
    );
    const radiusPx = map
      .latLngToContainerPoint(L.latLng(at.lat, at.lng))
      .distanceTo(map.latLngToContainerPoint(east));
    stroke.setStyle({ weight: Math.max(4, radiusPx * 2) });
  }, [brushRadiusM]);

  useEffect(() => {
    const map = mapObj.current;
    if (!map) return;
    drawPieces(map, pieces, selectedPieceId, shapeLayer, {
      hoverId: tool === "deletePiece" ? hoverPieceId.current : null,
    });
  }, [pieces, selectedPieceId, tool]);

  useEffect(() => {
    if (tool !== "boundary") {
      setBoundaryHits([]);
      return;
    }
    const q = boundaryQuery.trim();
    if (q.length < 2) {
      setBoundaryHits([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const hits = await searchBoundaries(q);
        if (!cancelled) setBoundaryHits(hits);
      } catch {
        if (!cancelled) setBoundaryHits([]);
      }
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [boundaryQuery, tool]);

  useEffect(() => {
    const typing = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        el.isContentEditable
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (typing(e.target)) return;
      const map = mapObj.current;
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undoRef.current();
        return;
      }
      if (mod && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault();
        redoRef.current();
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        if (e.repeat || spacePanRef.current) return;
        spacePanRef.current = true;
        cancelDraftRef.current();
        map?.dragging.enable();
        const container = map?.getContainer();
        if (container) container.style.cursor = "grab";
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        cancelDraftRef.current();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        clearSelectionRef.current();
        return;
      }
      if (e.key === "[") {
        e.preventDefault();
        nudgeBrushRef.current(-1);
        return;
      }
      if (e.key === "]") {
        e.preventDefault();
        nudgeBrushRef.current(1);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space" || !spacePanRef.current) return;
      spacePanRef.current = false;
      const map = mapObj.current;
      if (!map) return;
      if (toolRef.current === "pan") map.dragging.enable();
      else map.dragging.disable();
      restoreCursorRef.current();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  async function addBoundaryPiece(next: MapSelection, arId?: string) {
    setError(null);
    if (cancelFlagRef.current) return;
    const piece = materializePiece(next, selectionDisplayName(next), arId);
    const adding =
      composeModeRef.current === "add" && piecesRef.current.length > 0;
    if (adding && arId && piecesRef.current.some((p) => p.arId === arId)) return;
    applyPieces(
      adding ? [...piecesRef.current, piece] : [piece],
      true,
      true,
      piece.id,
    );
  }

  /** Bake land-only outline into the current selection (one-shot; not a sticky mode). */
  async function applyCoastClip() {
    if (clipBusy) return;
    const current = piecesRef.current;
    if (current.length === 0) return;

    cancelFlagRef.current = false;
    const jobId = ++clipJobIdRef.current;
    setClipBusy(true);
    setError(null);
    const label = t.boundaryClipping;
    setProgress(label);
    setJobProgress({
      label,
      done: 0,
      total: Math.max(current.length, 1),
    });
    try {
      const updated: SelectionPiece[] = [];
      let done = 0;
      for (const piece of current) {
        if (cancelFlagRef.current || clipJobIdRef.current !== jobId) {
          setProgress(t.cancelled);
          return;
        }
        const clipped = await clipSelectionToLand(piece.selection);
        updated.push({
          ...piece,
          selection: clipped,
          sourceSelection: clipped,
          name:
            selectionDisplayName(clipped) ||
            selectionDisplayName(piece.selection) ||
            piece.name,
        });
        done += 1;
        setJobProgress({ label, done, total: current.length });
      }
      if (cancelFlagRef.current || clipJobIdRef.current !== jobId) {
        setProgress(t.cancelled);
        return;
      }
      applyPieces(updated, true, true);
    } catch {
      setError(t.boundaryError);
    } finally {
      if (clipJobIdRef.current === jobId) {
        setClipBusy(false);
        setProgress(null);
        setJobProgress(null);
      }
    }
  }

  async function selectArJurisdiction(jurisdiction: ArJurisdiction) {
    if (
      composeMode === "add" &&
      pieces.some((p) => p.arId === jurisdiction.id)
    ) {
      return;
    }
    cancelFlagRef.current = false;
    setBoundaryLoading(true);
    setError(null);
    setJobProgress({
      label: t.boundaryLoading,
      done: 0,
      total: 1,
      indeterminate: true,
    });
    try {
      if (cancelFlagRef.current) {
        setProgress(t.cancelled);
        return;
      }
      const next = await fetchArJurisdiction(jurisdiction);
      await addBoundaryPiece(next, jurisdiction.id);
    } catch {
      setError(t.boundaryError);
    } finally {
      setBoundaryLoading(false);
      setJobProgress(null);
    }
  }

  async function selectSearchHit(hit: BoundarySearchHit) {
    cancelFlagRef.current = false;
    setBoundaryLoading(true);
    setError(null);
    setJobProgress({
      label: t.boundaryLoading,
      done: 0,
      total: 1,
      indeterminate: true,
    });
    try {
      await addBoundaryPiece(hit.selection);
    } catch {
      setError(t.boundaryError);
    } finally {
      setBoundaryLoading(false);
      setJobProgress(null);
    }
  }

  function clearSelection() {
    applyPieces([], true, false, null);
    setError(null);
    freehandPts.current = [];
      if (mapObj.current && freehandDraftLayer.current) {
      mapObj.current.removeLayer(freehandDraftLayer.current);
      freehandDraftLayer.current = null;
    }
  }
  clearSelectionRef.current = clearSelection;

  function removePiece(id: string) {
    applyPieces(
      piecesRef.current.filter((p) => p.id !== id),
      true,
    );
  }

  function updateSelectedPiece(next: MapSelection) {
    const id = selectedPieceIdRef.current;
    if (!id) return;
    const existing = piecesRef.current.find((p) => p.id === id);
    if (!existing) return;
    applyPieces(
      piecesRef.current.map((p) =>
        p.id === id
          ? {
              ...p,
              selection: next,
              sourceSelection: next,
              name: selectionDisplayName(next) || p.name,
            }
          : p,
      ),
      true,
      false,
      id,
    );
  }

  async function buildStl() {
    if (!selection) {
      setError(t.toolHintDraw);
      return;
    }
    abortRef.current?.abort();
    cancelFlagRef.current = false;
    const controller = new AbortController();
    abortRef.current = controller;
    const preset = DETAIL_PRESETS[detail];
    const key = `${detail}|keep`;
    setError(null);
    setGenerating(true);
    setProgress(t.sampling);
    setJobProgress({ label: t.sampling, done: 0, total: 1, indeterminate: true });
    try {
      const zoom = Math.min(14, Math.max(11, mapObj.current?.getZoom() ?? 13));
      const grid = await sampleElevationGrid(selection, {
        resolution: preset.resolution,
        zoom,
        terrainSmooth: preset.terrainSmooth,
        waterMode: "keep",
        signal: controller.signal,
        onProgress: (done, total) => {
          setProgress(`${t.sampling} ${Math.round((done / total) * 100)}%`);
          setJobProgress({ label: t.sampling, done, total });
        },
      });
      if (controller.signal.aborted) throw new SampleAbortedError();
      setHeightGrid(grid);
      setSampledKey(key);
      setStlStale(false);
      setProgress(t.ready);
    } catch (err) {
      if (
        err instanceof SampleAbortedError ||
        (err instanceof DOMException && err.name === "AbortError") ||
        controller.signal.aborted
      ) {
        setProgress(t.cancelled);
      } else {
        setError(t.error);
        setProgress(null);
      }
    } finally {
      setGenerating(false);
      setJobProgress(null);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  useEffect(() => {
    if (!heightGrid || stlStale) return;
    const buffer = heightGridToStl(heightGrid, {
      verticalScale,
      modelSizeMm,
      baseMm,
    });
    setStlBuffer(buffer);
    hasPreviewRef.current = true;
    const dims = printDimensionsFromGrid(heightGrid, {
      verticalScale,
      modelSizeMm,
      baseMm,
    });
    setPreviewMeta({
      widthMm: dims.widthMm,
      depthMm: dims.depthMm,
      heightMm: dims.heightMm,
      triangles: stlTriangleCount(buffer),
    });
  }, [heightGrid, verticalScale, modelSizeMm, baseMm, stlStale]);

  const sampleKey = `${detail}|keep`;
  const gridMatchesSettings = Boolean(heightGrid && sampledKey === sampleKey);
  const sizeEstimate = useMemo(() => {
    if (!selection) return null;
    const preset = DETAIL_PRESETS[detail];
    const printOpts = { verticalScale, modelSizeMm, baseMm };
    if (heightGrid && gridMatchesSettings && !stlStale) {
      const exact = printDimensionsFromGrid(heightGrid, printOpts);
      return {
        ...exact,
        approximateHeight: false,
        triangleHint: stlBuffer
          ? stlTriangleCount(stlBuffer)
          : Math.round(3.2 * preset.resolution * preset.resolution),
      };
    }
    return estimatePrintDimensions(selection, {
      ...printOpts,
      waterMode: "keep",
      resolution: preset.resolution,
      elevRangeM: heightGrid ? heightGrid.max - heightGrid.min : null,
    });
  }, [
    selection,
    detail,
    verticalScale,
    modelSizeMm,
    baseMm,
    heightGrid,
    gridMatchesSettings,
    stlStale,
    stlBuffer,
  ]);
  const downloadName = stlFilenameFromLabels(
    pieces.length > 0
      ? pieces.map((p) => p.name)
      : selection
        ? [selectionDisplayName(selection)]
        : ["map-terrain"],
  );

  const selectedPiece =
    selectedPieceId != null
      ? pieces.find((p) => p.id === selectedPieceId) ?? null
      : null;
  const editableSelection = selectedPiece?.selection ?? null;
  const editLat =
    editableSelection?.kind === "rectangle"
      ? (editableSelection.north + editableSelection.south) / 2
      : editableSelection && editableSelection.kind !== "polygon"
        ? editableSelection.center.lat
        : selection
          ? (selectionBounds(selection).north +
              selectionBounds(selection).south) /
            2
          : -34.55;
  const shapeSteps = shapeInputSteps(mapZoom, editLat);
  const rectMetrics =
    editableSelection?.kind === "rectangle"
      ? rectangleMetrics(editableSelection)
      : null;

  const selectionSummary = useMemo(() => {
    if (!selection) return null;
    const span = selectionSpanKm(selection);
    const area = selectionAreaKm2(selection);
    return {
      pieces: pieces.length,
      areaLabel:
        area >= 100 ? `${Math.round(area).toLocaleString()} km²` : `${area.toFixed(1)} km²`,
      spanLabel: `${span.widthKm >= 100 ? Math.round(span.widthKm) : span.widthKm.toFixed(1)} × ${
        span.depthKm >= 100 ? Math.round(span.depthKm) : span.depthKm.toFixed(1)
      } km`,
    };
  }, [selection, pieces.length]);

  const toolHint =
    tool === "pan"
      ? t.toolHintPan
      : tool === "brush"
        ? t.toolHintBrush
        : tool === "freehand"
          ? t.toolHintFreehand
          : tool === "boundary"
            ? t.toolHintBoundary
            : tool === "deletePiece"
              ? t.toolHintDelete
              : t.toolHintDraw;

  const tools: Array<[EditorTool, string, string, typeof IconPan]> = [
    ["pan", t.pan, t.toolHintPan, IconPan],
    ["rectangle", t.rectangle, t.toolHintDraw, IconRect],
    ["circle", t.circle, t.toolHintDraw, IconCircle],
    ["ellipse", t.ellipse, t.toolHintDraw, IconEllipse],
    ["brush", t.brush, t.toolHintBrush, IconBrush],
    ["freehand", t.freehand, t.toolHintFreehand, IconFreehand],
    ["boundary", t.boundary, t.toolHintBoundary, IconBoundary],
    ["deletePiece", t.deletePiece, t.toolHintDelete, IconEraser],
  ];

  const toolbarBtn =
    "inline-flex cursor-pointer items-center gap-1.5 px-2 py-1.5 text-sm font-bold tracking-wide transition disabled:cursor-not-allowed disabled:opacity-40";

  const showBrushOptions = tool === "brush";
  const showBoundaryOptions = tool === "boundary";
  const showPieceEditor =
    !showBrushOptions &&
    !showBoundaryOptions &&
    (pieces.length > 0 ||
      tool === "rectangle" ||
      tool === "circle" ||
      tool === "ellipse");
  const showToolOptions =
    showBrushOptions || showBoundaryOptions || showPieceEditor;

  return (
    <ToolChrome eyebrow={t.eyebrow} title={t.title} lead={t.lead} wide>
      <div className="space-y-4">
        <div className="border border-line bg-surface/50">
          <div className="flex flex-wrap items-end gap-x-5 gap-y-3 p-3">
            <div className="flex flex-wrap gap-1.5">
              {tools.map(([value, label, tip, Icon]) => (
                <ToolTip key={value} label={tip}>
                  <button
                    type="button"
                    aria-label={label}
                    onClick={() => setTool(value)}
                    className={`${toolbarBtn} ${
                      tool === value
                        ? "bg-blue-deep text-white"
                        : "border border-line text-ink-muted hover:text-ink"
                    }`}
                  >
                    <Icon />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                </ToolTip>
              ))}
            </div>

            <div className="flex flex-col gap-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-green">
                {t.composeMode}
              </p>
              <div className="flex flex-wrap gap-1.5 border border-line bg-white/40 p-1">
                <ToolTip label={t.composeAdd}>
                  <button
                    type="button"
                    aria-label={t.composeAdd}
                    onClick={() => setComposeMode("add")}
                    className={`${toolbarBtn} ${
                      composeMode === "add"
                        ? "bg-ink text-white"
                        : "text-ink-muted hover:text-ink"
                    }`}
                  >
                    <IconAdd />
                    <span>{t.composeAdd}</span>
                  </button>
                </ToolTip>
                <ToolTip label={t.composeReplace}>
                  <button
                    type="button"
                    aria-label={t.composeReplace}
                    onClick={() => setComposeMode("replace")}
                    className={`${toolbarBtn} ${
                      composeMode === "replace"
                        ? "bg-ink text-white"
                        : "text-ink-muted hover:text-ink"
                    }`}
                  >
                    <IconReplace />
                    <span>{t.composeReplace}</span>
                  </button>
                </ToolTip>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <ToolTip label={t.undo}>
                <button
                  type="button"
                  aria-label={t.undo}
                  onClick={undo}
                  disabled={!canUndo}
                  className={`${toolbarBtn} border border-line text-ink-muted hover:text-ink`}
                >
                  <IconUndo />
                </button>
              </ToolTip>
              <ToolTip label={t.redo}>
                <button
                  type="button"
                  aria-label={t.redo}
                  onClick={redo}
                  disabled={!canRedo}
                  className={`${toolbarBtn} border border-line text-ink-muted hover:text-ink`}
                >
                  <IconRedo />
                </button>
              </ToolTip>
              <ToolTip label={t.clearSelection}>
                <button
                  type="button"
                  aria-label={t.clearSelection}
                  onClick={clearSelection}
                  disabled={pieces.length === 0}
                  className={`${toolbarBtn} border border-line text-ink-muted hover:text-ink`}
                >
                  <IconClear />
                </button>
              </ToolTip>
              <ToolTip label={t.fitSelection}>
                <button
                  type="button"
                  aria-label={t.fitSelection}
                  onClick={fitSelection}
                  disabled={!selection}
                  className={`${toolbarBtn} border border-line text-ink-muted hover:text-ink`}
                >
                  <IconFit />
                </button>
              </ToolTip>
            </div>
          </div>

          {showToolOptions ? (
            <div className="border-t border-line bg-white/50 px-3 py-2">
              {showBrushOptions ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-6 sm:gap-y-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-green">
                      {t.brush}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {(
                        [
                          ["paint", t.brushPaint],
                          ["erase", t.brushErase],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setBrushMode(value)}
                          className={`${toolbarBtn} ${
                            brushMode === value
                              ? "bg-ink text-white"
                              : "border border-line text-ink-muted hover:text-ink"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="block min-w-[min(100%,220px)] flex-1">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-green">
                      {t.brushRadius}:{" "}
                      {brushRadiusM >= 1000
                        ? `${(brushRadiusM / 1000).toFixed(1)} km`
                        : `${brushRadiusM} m`}
                    </span>
                    <input
                      type="range"
                      min={200}
                      max={50000}
                      step={100}
                      value={brushRadiusM}
                      onChange={(e) => setBrushRadiusM(Number(e.target.value))}
                      className="mt-2 w-full cursor-pointer"
                    />
                  </label>
                </div>
              ) : null}

              {showBoundaryOptions ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-green">
                        {t.boundaryCountry}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={boundaryLoading}
                          onClick={() => selectArJurisdiction(AR_COUNTRY)}
                          className={`cursor-pointer px-2.5 py-1.5 text-xs font-bold tracking-wide transition disabled:cursor-wait disabled:opacity-50 ${
                            pieces.some((p) => p.arId === AR_COUNTRY.id)
                              ? "bg-green text-white"
                              : "border border-line text-ink-muted hover:text-ink"
                          }`}
                        >
                          {locale === "es"
                            ? AR_COUNTRY.nameEs
                            : AR_COUNTRY.nameEn}
                        </button>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-green">
                        {t.boundaryAr}
                      </p>
                      <div className="mt-1.5 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                        {AR_JURISDICTIONS.map((j) => (
                          <button
                            key={j.id}
                            type="button"
                            disabled={boundaryLoading}
                            onClick={() => selectArJurisdiction(j)}
                            className={`cursor-pointer px-2.5 py-1.5 text-xs font-bold tracking-wide transition disabled:cursor-wait disabled:opacity-50 ${
                              pieces.some((p) => p.arId === j.id)
                                ? "bg-green text-white"
                                : "border border-line text-ink-muted hover:text-ink"
                            }`}
                          >
                            {locale === "es" ? j.nameEs : j.nameEn}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                    <label className="block">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-green">
                        {t.boundarySearch}
                      </span>
                      <input
                        type="search"
                        value={boundaryQuery}
                        onChange={(e) => setBoundaryQuery(e.target.value)}
                        placeholder={t.boundarySearchPlaceholder}
                        className={inputClass}
                      />
                    </label>
                    <div className="max-h-28 overflow-y-auto">
                      {boundaryHits.length > 0 ? (
                        <div className="space-y-1">
                          {boundaryHits.map((hit) => (
                            <button
                              key={hit.queryKey}
                              type="button"
                              onClick={() => selectSearchHit(hit)}
                              className="block w-full cursor-pointer border border-line bg-white/70 px-2.5 py-1.5 text-left hover:bg-white"
                            >
                              <span className="flex items-baseline justify-between gap-2">
                                <span className="text-sm font-semibold text-ink">
                                  {hit.label}
                                </span>
                                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                                  {hit.kind}
                                </span>
                              </span>
                              {hit.subtitle ? (
                                <span className="mt-0.5 block text-xs text-ink-muted">
                                  {hit.subtitle}
                                </span>
                              ) : null}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="pt-2 text-xs text-ink-muted">
                          {t.boundaryEmpty}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed text-ink-muted">
                    {t.boundaryHint}
                  </p>
                </div>
              ) : null}

              {showPieceEditor ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className={sectionLabelClass}>
                      {t.shapeEdit}
                      {selectedPiece ? ` · ${selectedPiece.name}` : ""}
                    </p>
                    {!selectedPiece && pieces.length > 0 ? (
                      <p className="text-xs text-ink-muted">{t.shapeEditPick}</p>
                    ) : null}
                  </div>

                  {!selectedPiece ? (
                    <p className="text-xs text-ink-muted">{t.shapeEditEmpty}</p>
                  ) : editableSelection?.kind === "rectangle" &&
                    rectMetrics ? (
                    <div className="space-y-2">
                      <div>
                        <p className={fieldLabelClass}>{t.sides}</p>
                        <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <label className="block">
                            <span className={fieldLabelClass}>{t.widthM}</span>
                            <input
                              type="number"
                              min={1}
                              step={shapeSteps.stepRadius}
                              value={roundToStep(
                                rectMetrics.widthM,
                                shapeSteps.stepRadius,
                              )}
                              onChange={(e) => {
                                const n = Number(e.target.value);
                                if (Number.isNaN(n) || n < 1) return;
                                updateSelectedPiece(
                                  rectangleFromCenterSize(
                                    rectMetrics.center,
                                    n,
                                    rectMetrics.heightM,
                                  ),
                                );
                              }}
                              className={inputClass}
                            />
                          </label>
                          <label className="block">
                            <span className={fieldLabelClass}>{t.heightM}</span>
                            <input
                              type="number"
                              min={1}
                              step={shapeSteps.stepRadius}
                              value={roundToStep(
                                rectMetrics.heightM,
                                shapeSteps.stepRadius,
                              )}
                              onChange={(e) => {
                                const n = Number(e.target.value);
                                if (Number.isNaN(n) || n < 1) return;
                                updateSelectedPiece(
                                  rectangleFromCenterSize(
                                    rectMetrics.center,
                                    rectMetrics.widthM,
                                    n,
                                  ),
                                );
                              }}
                              className={inputClass}
                            />
                          </label>
                          <label className="block">
                            <span className={fieldLabelClass}>{t.centerLat}</span>
                            <input
                              type="number"
                              step={shapeSteps.stepLat}
                              value={rectMetrics.center.lat}
                              onChange={(e) => {
                                const n = Number(e.target.value);
                                if (Number.isNaN(n)) return;
                                updateSelectedPiece(
                                  rectangleFromCenterSize(
                                    { lat: n, lng: rectMetrics.center.lng },
                                    rectMetrics.widthM,
                                    rectMetrics.heightM,
                                  ),
                                );
                              }}
                              className={inputClass}
                            />
                          </label>
                          <label className="block">
                            <span className={fieldLabelClass}>{t.centerLng}</span>
                            <input
                              type="number"
                              step={shapeSteps.stepLng}
                              value={rectMetrics.center.lng}
                              onChange={(e) => {
                                const n = Number(e.target.value);
                                if (Number.isNaN(n)) return;
                                updateSelectedPiece(
                                  rectangleFromCenterSize(
                                    { lat: rectMetrics.center.lat, lng: n },
                                    rectMetrics.widthM,
                                    rectMetrics.heightM,
                                  ),
                                );
                              }}
                              className={inputClass}
                            />
                          </label>
                        </div>
                      </div>
                      <div>
                        <p className={fieldLabelClass}>{t.vertices}</p>
                        <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {(
                            [
                              ["nw", t.vertexNW],
                              ["ne", t.vertexNE],
                              ["sw", t.vertexSW],
                              ["se", t.vertexSE],
                            ] as const
                          ).map(([corner, label]) => {
                            const v = rectangleVertex(
                              editableSelection,
                              corner,
                            );
                            return (
                              <div key={corner} className="space-y-1">
                                <p className={fieldLabelClass}>{label}</p>
                                <input
                                  type="number"
                                  step={shapeSteps.stepLat}
                                  aria-label={`${label} lat`}
                                  value={v.lat}
                                  onChange={(e) => {
                                    const n = Number(e.target.value);
                                    if (Number.isNaN(n)) return;
                                    updateSelectedPiece(
                                      setRectangleVertex(
                                        editableSelection,
                                        corner,
                                        n,
                                        v.lng,
                                      ),
                                    );
                                  }}
                                  className={inputClass}
                                />
                                <input
                                  type="number"
                                  step={shapeSteps.stepLng}
                                  aria-label={`${label} lng`}
                                  value={v.lng}
                                  onChange={(e) => {
                                    const n = Number(e.target.value);
                                    if (Number.isNaN(n)) return;
                                    updateSelectedPiece(
                                      setRectangleVertex(
                                        editableSelection,
                                        corner,
                                        v.lat,
                                        n,
                                      ),
                                    );
                                  }}
                                  className={inputClass}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : editableSelection?.kind === "circle" ? (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <label className="block">
                        <span className={fieldLabelClass}>{t.centerLat}</span>
                        <input
                          type="number"
                          step={shapeSteps.stepLat}
                          value={editableSelection.center.lat}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            if (Number.isNaN(n)) return;
                            updateSelectedPiece({
                              ...editableSelection,
                              center: {
                                ...editableSelection.center,
                                lat: n,
                              },
                            });
                          }}
                          className={inputClass}
                        />
                      </label>
                      <label className="block">
                        <span className={fieldLabelClass}>{t.centerLng}</span>
                        <input
                          type="number"
                          step={shapeSteps.stepLng}
                          value={editableSelection.center.lng}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            if (Number.isNaN(n)) return;
                            updateSelectedPiece({
                              ...editableSelection,
                              center: {
                                ...editableSelection.center,
                                lng: n,
                              },
                            });
                          }}
                          className={inputClass}
                        />
                      </label>
                      <label className="col-span-2 block sm:col-span-1">
                        <span className={fieldLabelClass}>{t.radiusM}</span>
                        <input
                          type="number"
                          min={1}
                          step={shapeSteps.stepRadius}
                          value={roundToStep(
                            editableSelection.radiusM,
                            shapeSteps.stepRadius,
                          )}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            if (Number.isNaN(n) || n < 1) return;
                            updateSelectedPiece({
                              ...editableSelection,
                              radiusM: n,
                            });
                          }}
                          className={inputClass}
                        />
                      </label>
                    </div>
                  ) : editableSelection?.kind === "ellipse" ? (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <label className="block">
                        <span className={fieldLabelClass}>{t.centerLat}</span>
                        <input
                          type="number"
                          step={shapeSteps.stepLat}
                          value={editableSelection.center.lat}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            if (Number.isNaN(n)) return;
                            updateSelectedPiece({
                              ...editableSelection,
                              center: {
                                ...editableSelection.center,
                                lat: n,
                              },
                            });
                          }}
                          className={inputClass}
                        />
                      </label>
                      <label className="block">
                        <span className={fieldLabelClass}>{t.centerLng}</span>
                        <input
                          type="number"
                          step={shapeSteps.stepLng}
                          value={editableSelection.center.lng}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            if (Number.isNaN(n)) return;
                            updateSelectedPiece({
                              ...editableSelection,
                              center: {
                                ...editableSelection.center,
                                lng: n,
                              },
                            });
                          }}
                          className={inputClass}
                        />
                      </label>
                      <label className="block">
                        <span className={fieldLabelClass}>{t.radiusXM}</span>
                        <input
                          type="number"
                          min={1}
                          step={shapeSteps.stepRadius}
                          value={roundToStep(
                            editableSelection.radiusXM,
                            shapeSteps.stepRadius,
                          )}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            if (Number.isNaN(n) || n < 1) return;
                            updateSelectedPiece({
                              ...editableSelection,
                              radiusXM: n,
                            });
                          }}
                          className={inputClass}
                        />
                      </label>
                      <label className="block">
                        <span className={fieldLabelClass}>{t.radiusYM}</span>
                        <input
                          type="number"
                          min={1}
                          step={shapeSteps.stepRadius}
                          value={roundToStep(
                            editableSelection.radiusYM,
                            shapeSteps.stepRadius,
                          )}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            if (Number.isNaN(n) || n < 1) return;
                            updateSelectedPiece({
                              ...editableSelection,
                              radiusYM: n,
                            });
                          }}
                          className={inputClass}
                        />
                      </label>
                    </div>
                  ) : (
                    <p className="text-xs text-ink-muted">
                      {t.shapeEditUnsupported}
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.75fr)]">
          <div className="space-y-3">
            <div
              ref={mapRef}
              className="h-[min(70vh,680px)] w-full border border-line z-0"
            />
            <p className="text-xs text-ink-muted">{toolHint}</p>
            <p className="text-xs text-ink-muted">{t.toolHintMobile}</p>
            {jobProgress ? (
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                    <span>{jobProgress.label}</span>
                    {!jobProgress.indeterminate ? (
                      <span>
                        {jobProgress.done}/{jobProgress.total}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden bg-line">
                    <div
                      className={`h-full bg-green transition-[width] ${
                        jobProgress.indeterminate ? "w-1/3 animate-pulse" : ""
                      }`}
                      style={
                        jobProgress.indeterminate
                          ? undefined
                          : {
                              width: `${Math.max(
                                6,
                                Math.round(
                                  (jobProgress.done /
                                    Math.max(jobProgress.total, 1)) *
                                    100,
                                ),
                              )}%`,
                            }
                      }
                    />
                  </div>
                </div>
                <ToolTip label={t.cancel}>
                  <button
                  type="button"
                  aria-label={t.cancel}
                  onClick={cancelActiveJob}
                  className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center border border-line text-ink-muted transition hover:border-red-700 hover:text-red-700"
                >
                  <IconCancel />
                </button>
                </ToolTip>
              </div>
            ) : null}
            {pieces.length > 0 ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                  {t.pieces}
                  {selectionSummary
                    ? ` · ${selectionSummary.pieces} ${t.pieceSummary} · ${selectionSummary.areaLabel} · ${selectionSummary.spanLabel}`
                    : ""}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {pieces.map((piece) => {
                    const selected = piece.id === selectedPieceId;
                    return (
                      <span
                        key={piece.id}
                        className={`inline-flex items-center gap-1 border px-2 py-1 text-xs font-semibold transition ${
                          selected
                            ? "border-blue-deep bg-blue-deep text-white"
                            : "border-line bg-white/70 text-ink"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            selectedPieceIdRef.current = piece.id;
                            setSelectedPieceId(piece.id);
                          }}
                          className={`cursor-pointer ${
                            selected ? "text-white" : "hover:text-ink"
                          }`}
                        >
                          {piece.name}
                        </button>
                        <button
                          type="button"
                          onClick={() => removePiece(piece.id)}
                          className={`cursor-pointer ${
                            selected
                              ? "text-white/80 hover:text-white"
                              : "text-ink-muted hover:text-ink"
                          }`}
                          aria-label={`Remove ${piece.name}`}
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
                {t.preview}
              </p>
              <div className="mt-3">
                <StlPreview buffer={stlBuffer} emptyLabel={t.previewEmpty} />
              </div>
              {stlBuffer && previewMeta ? (
                <p className="mt-2 text-xs text-ink-muted">
                  {t.previewMeta}: {formatMm(previewMeta.widthMm)} ×{" "}
                  {formatMm(previewMeta.depthMm)} × {formatMm(previewMeta.heightMm)} mm
                  · {previewMeta.triangles.toLocaleString()} {t.triangles}
                </p>
              ) : null}
              {stlStale && stlBuffer ? (
                <p className="mt-2 text-xs font-medium text-amber-800">{t.previewStale}</p>
              ) : null}
              {!stlStale && heightGrid && !gridMatchesSettings ? (
                <p className="mt-2 text-xs font-medium text-ink-muted">
                  {t.needsGenerate}
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-4 border border-line bg-surface/50 p-4">
            <fieldset>
              <legend className={sectionLabelClass}>
                {t.basemap}
              </legend>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(
                  [
                    ["hybrid", t.basemapRelief],
                    ["color", t.basemapColor],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setBasemap(value)}
                    className={`cursor-pointer px-2.5 py-1.5 text-xs font-bold tracking-wide transition ${
                      basemap === value
                        ? "bg-green text-white"
                        : "border border-line text-ink-muted hover:text-ink"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className={sectionLabelClass}>
                {t.silhouette}
              </legend>
              <div className="mt-2 space-y-2">
                <div>
                  <p className="text-sm font-semibold text-ink">{t.clipToCoast}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{t.clipToCoastHint}</p>
                  {clipBusy ? (
                    <p className="mt-1 text-xs font-medium text-green">
                      {t.boundaryClipping}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  aria-busy={clipBusy}
                  aria-label={t.clipToCoastApply}
                  disabled={
                    clipBusy || boundaryLoading || pieces.length === 0
                  }
                  onClick={() => void applyCoastClip()}
                  className="cursor-pointer border border-green bg-green px-2.5 py-1.5 text-xs font-bold tracking-wide text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {clipBusy ? t.boundaryClipping : t.clipToCoastApply}
                </button>
              </div>
            </fieldset>

            <div className="border-t border-line pt-4">
              <button
                type="button"
                onClick={() => setExportOpen((v) => !v)}
                className="flex w-full cursor-pointer items-center justify-between gap-3 text-left"
              >
                <span className="text-base font-bold tracking-wide text-ink">
                  {t.exportSettings}
                </span>
                <span className="text-sm font-semibold text-ink-muted">
                  {exportOpen ? "−" : "+"}
                </span>
              </button>
              {exportOpen ? (
                <div className="mt-3 space-y-3">
                  <div>
                    <p className={sectionLabelClass}>
                      {t.detail}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {(
                        [
                          ["low", t.detailLow, t.detailSpeedLow],
                          ["medium", t.detailMedium, t.detailSpeedMedium],
                          ["high", t.detailHigh, t.detailSpeedHigh],
                        ] as const
                      ).map(([value, label, speed]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setDetail(value)}
                          className={`cursor-pointer px-2.5 py-1.5 text-xs font-bold tracking-wide transition ${
                            detail === value
                              ? "bg-green text-white"
                              : "border border-line text-ink-muted hover:text-ink"
                          }`}
                        >
                          {label}
                          <span className="ml-1 text-[10px] font-semibold opacity-80">
                            {speed}
                          </span>
                        </button>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-ink-muted">{t.detailHint}</p>
                  </div>
                  <label className="block">
                    <span className={sectionLabelClass}>
                      {t.relief}:{" "}
                      {verticalScale >= 10
                        ? `${verticalScale.toFixed(0)}×`
                        : `${verticalScale.toFixed(1)}×`}
                      {sizeEstimate
                        ? ` · ~${formatMm(sizeEstimate.reliefMm)} mm`
                        : ""}
                    </span>
                    <input
                      type="range"
                      min={0.5}
                      max={100}
                      step={0.5}
                      value={verticalScale}
                      onChange={(e) => setVerticalScale(Number(e.target.value))}
                      className="mt-1.5 w-full cursor-pointer"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className={sectionLabelClass}>
                        {t.modelSize}
                      </span>
                      <input
                        type="number"
                        min={20}
                        step={1}
                        value={modelSizeMm}
                        onChange={(e) => setModelSizeMm(Number(e.target.value))}
                        className={inputClass}
                      />
                    </label>
                    <label className="block">
                      <span className={sectionLabelClass}>
                        {t.base}
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={baseMm}
                        onChange={(e) => setBaseMm(Number(e.target.value))}
                        className={inputClass}
                      />
                    </label>
                  </div>
                  {sizeEstimate ? (
                    <p className="border border-line bg-white/50 px-3 py-2 text-xs leading-relaxed text-ink">
                      <span className="font-semibold">{t.sizeEstimate}</span>
                      {sizeEstimate.approximateHeight ? ` (${t.sizeApprox})` : ""}
                      : {formatMm(sizeEstimate.widthMm)} ×{" "}
                      {formatMm(sizeEstimate.depthMm)} ×{" "}
                      {formatMm(sizeEstimate.heightMm)} mm
                      <span className="mt-1 block text-ink-muted">
                        ~{sizeEstimate.triangleHint.toLocaleString()} {t.triangles}
                      </span>
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={buildStl}
                disabled={generating || !selection}
                className="inline-flex cursor-pointer items-center justify-center gap-2 bg-blue-deep px-5 py-3 text-sm font-bold tracking-wide text-white transition hover:bg-blue disabled:cursor-not-allowed disabled:opacity-40"
              >
                <IconGenerate />
                {t.generate}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!stlBuffer) return;
                  downloadArrayBuffer(stlBuffer, downloadName);
                }}
                disabled={!stlBuffer}
                className="inline-flex cursor-pointer items-center justify-center gap-2 border border-blue/50 px-5 py-3 text-sm font-bold tracking-wide text-blue-deep transition hover:border-blue-deep hover:bg-blue/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <IconDownload />
                {t.download}
              </button>
            </div>
            <p className="text-xs leading-relaxed text-ink-muted">{t.hint}</p>
            {progress ? (
              <p className="text-sm font-medium text-green">{progress}</p>
            ) : null}
            {error ? (
              <p className="text-sm font-medium text-red-700">{error}</p>
            ) : null}
          </div>
        </div>
      </div>
    </ToolChrome>
  );
}

function formatMm(value: number) {
  if (!Number.isFinite(value)) return "–";
  return value >= 100 ? value.toFixed(0) : value.toFixed(1);
}

function clearTileRef(
  map: L.Map,
  ref: React.MutableRefObject<L.TileLayer | null>,
) {
  if (ref.current) {
    map.removeLayer(ref.current);
    ref.current = null;
  }
}

function applyBasemap(
  map: L.Map,
  style: BasemapStyle,
  baseRef: React.MutableRefObject<L.TileLayer | null>,
  overlayRef: React.MutableRefObject<L.TileLayer | null>,
) {
  clearTileRef(map, baseRef);
  clearTileRef(map, overlayRef);

  if (style === "color") {
    baseRef.current = L.tileLayer(
      "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 17,
        attribution:
          '&copy; <a href="https://opentopomap.org" target="_blank" rel="noreferrer">OpenTopoMap</a>',
      },
    ).addTo(map);
    return;
  }

  baseRef.current = L.tileLayer(
    "https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG%3A3857@png/{z}/{x}/{-y}.png",
    {
      tms: true,
      attribution:
        '&copy; <a href="https://www.ign.gob.ar/AreaServicios/Argenmap/Introduccion" target="_blank" rel="noreferrer">IGN Argentina</a>',
      maxZoom: 18,
    },
  ).addTo(map);

  overlayRef.current = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}",
    {
      opacity: 0.48,
      maxZoom: 16,
      attribution: "Esri World Hillshade",
    },
  ).addTo(map);
}

function drawPieces(
  map: L.Map,
  pieces: SelectionPiece[],
  selectedId: string | null,
  layerRef: React.MutableRefObject<L.Layer | null>,
  options?: {
    hoverId?: string | null;
    draft?: MapSelection | null;
  },
) {
  if (layerRef.current) {
    map.removeLayer(layerRef.current);
    layerRef.current = null;
  }
  const hoverId = options?.hoverId ?? null;
  const draft = options?.draft ?? null;
  if (pieces.length === 0 && !draft) return;

  const group = L.layerGroup();
  for (const piece of pieces) {
    const selected = piece.id === selectedId;
    const hovered = piece.id === hoverId;
    const style = hovered
      ? {
          color: "#b42318",
          weight: 3,
          fillColor: "#f04438",
          fillOpacity: 0.42,
        }
      : {
          color: selected ? "#0c3d6e" : "#6a859e",
          weight: selected ? 3 : 1.5,
          fillColor: selected ? "#1f8f6a" : "#3d9b7a",
          fillOpacity: selected ? 0.32 : 0.16,
        };
    addSelectionLayer(piece.selection, style, group);
  }
  if (draft) {
    addSelectionLayer(
      draft,
      {
        color: "#0c3d6e",
        weight: 2,
        fillColor: "#1f8f6a",
        fillOpacity: 0.28,
        dashArray: "6 4",
      },
      group,
    );
  }
  layerRef.current = group.addTo(map);
}

function addSelectionLayer(
  next: MapSelection,
  style: L.PathOptions,
  group: L.LayerGroup,
) {
  if (next.kind === "rectangle") {
    const b = selectionBounds(next);
    L.rectangle(
      [
        [b.south, b.west],
        [b.north, b.east],
      ],
      style,
    ).addTo(group);
    return;
  }
  if (next.kind === "circle") {
    L.circle([next.center.lat, next.center.lng], {
      ...style,
      radius: next.radiusM,
    }).addTo(group);
    return;
  }
  if (next.kind === "polygon") {
    for (const polygon of next.polygons) {
      const latLngs = polygon.map((ring) =>
        ring.map((p) => [p.lat, p.lng] as [number, number]),
      );
      L.polygon(latLngs, style).addTo(group);
    }
    return;
  }
  L.polygon(ellipseRing(next, 64), style).addTo(group);
}

function drawSelection(
  map: L.Map,
  next: MapSelection,
  layerRef: React.MutableRefObject<L.Layer | null>,
) {
  if (layerRef.current) {
    map.removeLayer(layerRef.current);
    layerRef.current = null;
  }
  const group = L.layerGroup();
  addSelectionLayer(
    next,
    {
      color: "#0c3d6e",
      weight: 2,
      fillColor: "#1f8f6a",
      fillOpacity: 0.25,
    },
    group,
  );
  layerRef.current = group.addTo(map);
}

type RectSelection = Extract<MapSelection, { kind: "rectangle" }>;
type RectCorner = "nw" | "ne" | "sw" | "se";

function rectangleMetrics(rect: RectSelection) {
  const b = selectionBounds(rect);
  const center = {
    lat: (b.north + b.south) / 2,
    lng: (b.east + b.west) / 2,
  };
  const mLat = metersPerDegreeLat(center.lat);
  const mLng = Math.max(metersPerDegreeLng(center.lat), 1e-9);
  return {
    center,
    widthM: Math.abs(b.east - b.west) * mLng,
    heightM: Math.abs(b.north - b.south) * mLat,
  };
}

function rectangleFromCenterSize(
  center: { lat: number; lng: number },
  widthM: number,
  heightM: number,
): RectSelection {
  const mLat = metersPerDegreeLat(center.lat);
  const mLng = Math.max(metersPerDegreeLng(center.lat), 1e-9);
  const halfH = Math.max(heightM, 1) / 2 / mLat;
  const halfW = Math.max(widthM, 1) / 2 / mLng;
  return {
    kind: "rectangle",
    north: center.lat + halfH,
    south: center.lat - halfH,
    east: center.lng + halfW,
    west: center.lng - halfW,
  };
}

function rectangleVertex(rect: RectSelection, corner: RectCorner) {
  const b = selectionBounds(rect);
  switch (corner) {
    case "nw":
      return { lat: b.north, lng: b.west };
    case "ne":
      return { lat: b.north, lng: b.east };
    case "sw":
      return { lat: b.south, lng: b.west };
    case "se":
      return { lat: b.south, lng: b.east };
  }
}

function setRectangleVertex(
  rect: RectSelection,
  corner: RectCorner,
  lat: number,
  lng: number,
): RectSelection {
  const b = selectionBounds(rect);
  let { north, south, east, west } = b;
  if (corner === "nw" || corner === "ne") north = lat;
  else south = lat;
  if (corner === "nw" || corner === "sw") west = lng;
  else east = lng;
  return {
    kind: "rectangle",
    north: Math.max(north, south),
    south: Math.min(north, south),
    east: Math.max(east, west),
    west: Math.min(east, west),
  };
}

function selectionFromDrag(
  mode: "rectangle" | "circle" | "ellipse",
  start: L.LatLng,
  end: L.LatLng,
): MapSelection {
  if (mode === "rectangle") {
    return {
      kind: "rectangle",
      south: Math.min(start.lat, end.lat),
      north: Math.max(start.lat, end.lat),
      west: Math.min(start.lng, end.lng),
      east: Math.max(start.lng, end.lng),
    };
  }
  const center = { lat: start.lat, lng: start.lng };
  const dx = end.distanceTo(L.latLng(start.lat, end.lng));
  const dy = end.distanceTo(L.latLng(end.lat, start.lng));
  const dist = start.distanceTo(end);
  if (mode === "circle") {
    return { kind: "circle", center, radiusM: Math.max(dist, 50) };
  }
  return {
    kind: "ellipse",
    center,
    radiusXM: Math.max(dx, 50),
    radiusYM: Math.max(dy, 50),
  };
}

function ellipseRing(
  selection: Extract<MapSelection, { kind: "ellipse" }>,
  steps: number,
): [number, number][] {
  const { center, radiusXM, radiusYM } = selection;
  const mLat =
    111132.92 - 559.82 * Math.cos((2 * center.lat * Math.PI) / 180);
  const mLng =
    (Math.PI / 180) * 6378137 * Math.cos((center.lat * Math.PI) / 180);
  const dLat = radiusYM / mLat;
  const dLng = radiusXM / Math.max(mLng, 1e-6);
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i += 1) {
    const a = (i / steps) * Math.PI * 2;
    ring.push([
      center.lat + Math.sin(a) * dLat,
      center.lng + Math.cos(a) * dLng,
    ]);
  }
  return ring;
}

function shapeInputSteps(zoom: number, lat: number) {
  const z = Math.min(18, Math.max(1, zoom));
  const metersPerPixel =
    (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** z;
  const stepM = Math.max(2, metersPerPixel * 12);
  return {
    stepLat: niceStep(stepM / metersPerDegreeLat(lat)),
    stepLng: niceStep(stepM / Math.max(metersPerDegreeLng(lat), 1e-6)),
    stepRadius: Math.max(1, niceStep(stepM)),
  };
}

function niceStep(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = 10 ** exp;
  const n = value / base;
  const nice = n <= 1.5 ? 1 : n <= 3.5 ? 2 : n <= 7.5 ? 5 : 10;
  return nice * base;
}

function roundToStep(value: number, step: number): number {
  if (!Number.isFinite(value) || step <= 0) return value;
  const rounded = Math.round(value / step) * step;
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  return Number(rounded.toFixed(decimals));
}
