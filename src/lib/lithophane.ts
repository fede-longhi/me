/**
 * Image → lithophane height field → closed binary STL (via heightGridToStl).
 * Classic backlit mapping: dark pixels are thicker so less light passes.
 */

import {
  downloadArrayBuffer,
  heightGridToStl,
  printDimensionsFromGrid,
  slugifyLabel,
  stlTriangleCount,
  type HeightGrid,
  type StlOptions,
} from "@/lib/map-stl";

export type LithophaneParams = {
  /** Longest horizontal side of the print, in mm. */
  maxSizeMm: number;
  /** Minimum wall thickness (bright areas when not inverted), mm. */
  minThicknessMm: number;
  /** Maximum wall thickness (dark areas when not inverted), mm. */
  maxThicknessMm: number;
  /** Samples along the longest image side. */
  resolution: number;
  /** Flip thickness: bright becomes thick. */
  invert: boolean;
  /** Mirror on X (useful when printing face-down). */
  mirror: boolean;
};

export const DEFAULT_LITHOPHANE_PARAMS: LithophaneParams = {
  maxSizeMm: 100,
  minThicknessMm: 0.8,
  maxThicknessMm: 3.2,
  resolution: 220,
  invert: false,
  mirror: false,
};

export const LITHOPHANE_LIMITS = {
  maxSizeMm: { min: 20, max: 300 },
  minThicknessMm: { min: 0.4, max: 5 },
  maxThicknessMm: { min: 0.8, max: 12 },
  resolution: { min: 60, max: 400 },
} as const;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** Relative luminance 0..1 from sRGB byte channels. */
export function luminance(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function resolveSampleSize(
  naturalWidth: number,
  naturalHeight: number,
  resolution: number,
): { cols: number; rows: number } {
  const longest = Math.max(naturalWidth, naturalHeight, 1);
  const scale = clamp(resolution, LITHOPHANE_LIMITS.resolution.min, LITHOPHANE_LIMITS.resolution.max) / longest;
  const cols = Math.max(2, Math.round(naturalWidth * scale));
  const rows = Math.max(2, Math.round(naturalHeight * scale));
  return { cols, rows };
}

/**
 * Draw the image into a canvas at the sample resolution and return pixels.
 */
export function sampleImagePixels(
  source: CanvasImageSource & { width?: number; height?: number },
  cols: number,
  rows: number,
): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not create canvas context");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source as CanvasImageSource, 0, 0, cols, rows);
  return ctx.getImageData(0, 0, cols, rows);
}

/**
 * Build a HeightGrid whose "elevations" are unitless thickness factors 0..1.
 * horizontal units are sample counts so aspect ratio matches the image.
 */
export function imageDataToHeightGrid(
  imageData: ImageData,
  params: Pick<LithophaneParams, "invert" | "mirror">,
): HeightGrid {
  const { width: cols, height: rows, data } = imageData;
  const values = new Float32Array(cols * rows);
  const selectionMask = new Uint8Array(cols * rows);
  selectionMask.fill(1);

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const srcCol = params.mirror ? cols - 1 - col : col;
      const i = (row * cols + srcCol) * 4;
      const lum = luminance(data[i]!, data[i + 1]!, data[i + 2]!);
      const factor = params.invert ? lum : 1 - lum;
      const idx = row * cols + col;
      values[idx] = factor;
      if (factor < min) min = factor;
      if (factor > max) max = factor;
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    min = 0;
    max = 0;
  }

  // Dummy geographic fields — heightGridToStl only needs widthM/depthM + values.
  const bounds = { south: 0, west: 0, north: rows, east: cols };
  const selection = {
    kind: "rectangle" as const,
    south: 0,
    west: 0,
    north: rows,
    east: cols,
  };

  return {
    cols,
    rows,
    values,
    min,
    max,
    widthM: cols,
    depthM: rows,
    bounds,
    selection,
    selectionMask,
  };
}

/** StlOptions tuned so a full height span maps to min..max thickness. */
export function stlOptionsForGrid(
  grid: HeightGrid,
  params: LithophaneParams,
): StlOptions {
  const maxSizeMm = clamp(
    params.maxSizeMm,
    LITHOPHANE_LIMITS.maxSizeMm.min,
    LITHOPHANE_LIMITS.maxSizeMm.max,
  );
  const minThicknessMm = clamp(
    params.minThicknessMm,
    LITHOPHANE_LIMITS.minThicknessMm.min,
    LITHOPHANE_LIMITS.minThicknessMm.max,
  );
  let maxThicknessMm = clamp(
    params.maxThicknessMm,
    LITHOPHANE_LIMITS.maxThicknessMm.min,
    LITHOPHANE_LIMITS.maxThicknessMm.max,
  );
  if (maxThicknessMm < minThicknessMm) maxThicknessMm = minThicknessMm;

  const maxHoriz = Math.max(grid.widthM, grid.depthM, 1);
  const scaleXY = maxSizeMm / maxHoriz;
  const span = Math.max(grid.max - grid.min, 1e-9);
  const desiredRelief = maxThicknessMm - minThicknessMm;
  // heightAt = (v - min) * scaleXY * verticalScale + baseMm
  // For v = max: relief = span * scaleXY * verticalScale = desiredRelief
  const verticalScale = desiredRelief / (span * scaleXY);

  return {
    modelSizeMm: maxSizeMm,
    baseMm: minThicknessMm,
    verticalScale,
  };
}

export type LithophaneResult = {
  buffer: ArrayBuffer;
  grid: HeightGrid;
  cols: number;
  rows: number;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  reliefMm: number;
  triangles: number;
};

export function generateLithophane(
  source: CanvasImageSource & { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number },
  params: LithophaneParams,
): LithophaneResult {
  const naturalWidth =
    ("naturalWidth" in source && source.naturalWidth) ||
    source.width ||
    0;
  const naturalHeight =
    ("naturalHeight" in source && source.naturalHeight) ||
    source.height ||
    0;
  if (naturalWidth < 2 || naturalHeight < 2) {
    throw new Error("Image is too small");
  }

  const { cols, rows } = resolveSampleSize(
    naturalWidth,
    naturalHeight,
    params.resolution,
  );
  const imageData = sampleImagePixels(source, cols, rows);
  const grid = imageDataToHeightGrid(imageData, params);
  const options = stlOptionsForGrid(grid, params);
  const buffer = heightGridToStl(grid, options);
  const dims = printDimensionsFromGrid(grid, options);

  return {
    buffer,
    grid,
    cols,
    rows,
    widthMm: dims.widthMm,
    depthMm: dims.depthMm,
    heightMm: dims.heightMm,
    reliefMm: dims.reliefMm,
    triangles: stlTriangleCount(buffer),
  };
}

export function lithophaneFilename(label: string): string {
  return `${slugifyLabel(label) || "lithophane"}-lithophane.stl`;
}

export { downloadArrayBuffer };
