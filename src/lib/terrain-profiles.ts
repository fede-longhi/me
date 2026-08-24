import {
  resolveSampleGrid,
  selectionBounds,
  type MapSelection,
  type SampleOptions,
} from "@/lib/map-stl";

export type TerrainProfileId =
  | "fixed-grid"
  | "no-smooth"
  | "geo-fine"
  | "geo-balanced"
  | "geo-wide"
  | "tiles-hd";

export type TerrainProfile = {
  id: TerrainProfileId;
  /** Short name for chips */
  label: { en: string; es: string };
  /** One-line explanation */
  blurb: { en: string; es: string };
  /** What problem it targets */
  bestFor: { en: string; es: string };
  buildSample: (ctx: {
    detailResolution: number;
    detailSmooth: number;
    mapZoom: number;
  }) => SampleOptions;
};

/**
 * Named sampling strategies for A/B comparison.
 * Large regions look mushy with a fixed cell budget — geo-* profiles target
 * meters-per-cell instead.
 */
export const TERRAIN_PROFILES: TerrainProfile[] = [
  {
    id: "fixed-grid",
    label: { en: "Fixed grid", es: "Grilla fija" },
    blurb: {
      en: "Current approach: fixed √cell budget + light blur.",
      es: "Enfoque actual: presupuesto fijo de celdas + blur suave.",
    },
    bestFor: {
      en: "Small / city-scale areas",
      es: "Zonas chicas / escala ciudad",
    },
    buildSample: ({ detailResolution, detailSmooth, mapZoom }) => ({
      resolution: detailResolution,
      terrainSmooth: detailSmooth,
      zoom: Math.min(14, Math.max(11, mapZoom)),
      waterMode: "keep",
    }),
  },
  {
    id: "no-smooth",
    label: { en: "No smooth", es: "Sin suavizado" },
    blurb: {
      en: "Same grid as fixed, but zero elevation blur — keeps ridges.",
      es: "Misma grilla que fija, sin blur — conserva crestas.",
    },
    bestFor: {
      en: "When blur washes out hills",
      es: "Cuando el blur aplana colinas",
    },
    buildSample: ({ detailResolution, mapZoom }) => ({
      resolution: detailResolution,
      terrainSmooth: 0,
      zoom: Math.min(14, Math.max(11, mapZoom)),
      waterMode: "keep",
    }),
  },
  {
    id: "geo-fine",
    label: { en: "Geo 75 m", es: "Geo 75 m" },
    blurb: {
      en: "~75 m between samples (capped). Dense for large maps.",
      es: "~75 m entre muestras (con tope). Denso en mapas grandes.",
    },
    bestFor: {
      en: "Wide areas that need fine relief",
      es: "Áreas amplias que necesitan relieve fino",
    },
    buildSample: ({ mapZoom }) => ({
      resolution: 180,
      metersPerCell: 75,
      maxCells: 140_000,
      terrainSmooth: 1,
      zoom: Math.min(14, Math.max(12, mapZoom)),
      waterMode: "keep",
    }),
  },
  {
    id: "geo-balanced",
    label: { en: "Geo 120 m", es: "Geo 120 m" },
    blurb: {
      en: "~120 m/cell — balance of detail vs speed for regions.",
      es: "~120 m/celda — equilibrio detalle/velocidad en regiones.",
    },
    bestFor: {
      en: "Default for province / bay scale",
      es: "Default para escala provincia / bahía",
    },
    buildSample: ({ mapZoom }) => ({
      resolution: 160,
      metersPerCell: 120,
      maxCells: 100_000,
      terrainSmooth: 1,
      zoom: Math.min(14, Math.max(11, mapZoom)),
      waterMode: "keep",
    }),
  },
  {
    id: "geo-wide",
    label: { en: "Geo 250 m", es: "Geo 250 m" },
    blurb: {
      en: "~250 m/cell — faster, coarser silhouette for huge spans.",
      es: "~250 m/celda — más rápido, silueta más gruesa en spans grandes.",
    },
    bestFor: {
      en: "Very large selections / quick previews",
      es: "Selecciones muy grandes / preview rápido",
    },
    buildSample: ({ mapZoom }) => ({
      resolution: 120,
      metersPerCell: 250,
      maxCells: 64_000,
      terrainSmooth: 2,
      zoom: Math.min(13, Math.max(10, mapZoom)),
      waterMode: "keep",
    }),
  },
  {
    id: "tiles-hd",
    label: { en: "HD tiles", es: "Tiles HD" },
    blurb: {
      en: "Zoom-14 Terrarium + ~100 m/cell + no blur.",
      es: "Terrarium zoom 14 + ~100 m/celda + sin blur.",
    },
    bestFor: {
      en: "Sharp source data when tiles allow",
      es: "Fuente nítida cuando hay tiles",
    },
    buildSample: () => ({
      resolution: 180,
      metersPerCell: 100,
      maxCells: 120_000,
      terrainSmooth: 0,
      zoom: 14,
      waterMode: "keep",
    }),
  },
];

export const DEFAULT_TERRAIN_PROFILE_ID: TerrainProfileId = "fixed-grid";

const PROFILE_STORAGE_KEY = "map-stl-terrain-profile";

export function getTerrainProfile(id: TerrainProfileId): TerrainProfile {
  return (
    TERRAIN_PROFILES.find((p) => p.id === id) ?? TERRAIN_PROFILES[0]!
  );
}

export function loadStoredTerrainProfileId(): TerrainProfileId {
  if (typeof window === "undefined") return DEFAULT_TERRAIN_PROFILE_ID;
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (raw && TERRAIN_PROFILES.some((p) => p.id === raw)) {
      return raw as TerrainProfileId;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_TERRAIN_PROFILE_ID;
}

export function storeTerrainProfileId(id: TerrainProfileId) {
  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

export type SamplePlanPreview = {
  cols: number;
  rows: number;
  cellCount: number;
  metersPerCell: number;
  zoom: number;
  terrainSmooth: number;
};

export function previewSamplePlan(
  selection: MapSelection,
  sample: SampleOptions,
): SamplePlanPreview {
  const bounds = selectionBounds(selection);
  const grid = resolveSampleGrid(bounds, {
    resolution: sample.resolution,
    metersPerCell: sample.metersPerCell,
    maxCells: sample.maxCells,
  });
  return {
    cols: grid.cols,
    rows: grid.rows,
    cellCount: grid.cellCount,
    metersPerCell: grid.metersPerCell,
    zoom: sample.zoom ?? 12,
    terrainSmooth: sample.terrainSmooth ?? 0,
  };
}

export function formatMetersPerCell(m: number, locale: "en" | "es"): string {
  if (m >= 1000) {
    const km = m / 1000;
    return locale === "es"
      ? `~${km.toFixed(km >= 10 ? 0 : 1)} km/celda`
      : `~${km.toFixed(km >= 10 ? 0 : 1)} km/cell`;
  }
  return locale === "es"
    ? `~${Math.round(m)} m/celda`
    : `~${Math.round(m)} m/cell`;
}
