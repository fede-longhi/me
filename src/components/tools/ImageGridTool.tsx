"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { ToolChrome } from "@/components/tools/ToolChrome";
import {
  downloadCanvas,
  renderBlankGrid,
  renderCombined,
  renderOverlayGrid,
  renderScrambledImage,
} from "@/lib/grid-tool";
import type { Locale } from "@/lib/types";

const copy: Record<
  Locale,
  {
    eyebrow: string;
    title: string;
    lead: string;
    upload: string;
    rows: string;
    cols: string;
    overlayWidth: string;
    blankWidth: string;
    generate: string;
    scramble: string;
    overlayTitle: string;
    blankTitle: string;
    downloadOverlay: string;
    downloadBlank: string;
    downloadBoth: string;
    hint: string;
    invalidGrid: string;
    invalidWidth: string;
    noImage: string;
    generateFirst: string;
  }
> = {
  en: {
    eyebrow: "Image tool",
    title: "Image Grid",
    lead: "Upload an image, set rows, columns and line thickness, then export a grid over the original and a blank grid — both at the original size.",
    upload: "Choose image",
    rows: "Rows",
    cols: "Columns",
    overlayWidth: "Overlay line width",
    blankWidth: "Blank line width",
    generate: "Generate",
    scramble: "Scramble tiles",
    overlayTitle: "Original + grid",
    blankTitle: "Blank + grid",
    downloadOverlay: "Download overlay",
    downloadBlank: "Download blank grid",
    downloadBoth: "Download both (side by side)",
    hint: "PNG recommended. Processing stays in your browser — nothing is uploaded.",
    invalidGrid: "Rows and columns must be whole numbers of at least 1.",
    invalidWidth: "Line widths must be whole numbers of at least 1.",
    noImage: "Load an image first.",
    generateFirst: "Generate the images first.",
  },
  es: {
    eyebrow: "Herramienta de imagen",
    title: "Grilla de imagen",
    lead: "Subí una imagen, definí filas, columnas y grosor de línea, y exportá una grilla sobre la original y una grilla en blanco — ambas al tamaño original.",
    upload: "Elegir imagen",
    rows: "Filas",
    cols: "Columnas",
    overlayWidth: "Grosor overlay",
    blankWidth: "Grosor en blanco",
    generate: "Generar",
    scramble: "Desordenar cuadrados",
    overlayTitle: "Original + grilla",
    blankTitle: "Blanco + grilla",
    downloadOverlay: "Descargar overlay",
    downloadBlank: "Descargar grilla en blanco",
    downloadBoth: "Descargar ambas (lado a lado)",
    hint: "Se recomienda PNG. Todo se procesa en tu navegador — no se sube nada.",
    invalidGrid: "Filas y columnas tienen que ser enteros de al menos 1.",
    invalidWidth: "Los grosores tienen que ser enteros de al menos 1.",
    noImage: "Cargá una imagen primero.",
    generateFirst: "Generá las imágenes primero.",
  },
};

function canvasToPreviewUrl(
  canvas: HTMLCanvasElement,
  onReady: (url: string) => void,
) {
  canvas.toBlob((blob) => {
    if (blob) onReady(URL.createObjectURL(blob));
  });
}

export function ImageGridTool() {
  const { locale } = useLanguage();
  const t = copy[locale];

  const [rowsInput, setRowsInput] = useState("4");
  const [colsInput, setColsInput] = useState("4");
  const [overlayWidthInput, setOverlayWidthInput] = useState("1");
  const [blankWidthInput, setBlankWidthInput] = useState("4");
  const [source, setSource] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("image");
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null);
  const [blankUrl, setBlankUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const blankCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const rows = Number.parseInt(rowsInput, 10);
  const cols = Number.parseInt(colsInput, 10);
  const overlayWidth = Number.parseInt(overlayWidthInput, 10);
  const blankWidth = Number.parseInt(blankWidthInput, 10);
  const gridValid =
    Number.isInteger(rows) &&
    Number.isInteger(cols) &&
    rows >= 1 &&
    cols >= 1;
  const widthsValid =
    Number.isInteger(overlayWidth) &&
    Number.isInteger(blankWidth) &&
    overlayWidth >= 1 &&
    blankWidth >= 1;

  const baseName = useMemo(
    () => fileName.replace(/\.[^.]+$/, "") || "image",
    [fileName],
  );

  useEffect(() => {
    return () => {
      if (overlayUrl) URL.revokeObjectURL(overlayUrl);
      if (blankUrl) URL.revokeObjectURL(blankUrl);
    };
  }, [overlayUrl, blankUrl]);

  function revokePreviews() {
    if (overlayUrl) URL.revokeObjectURL(overlayUrl);
    if (blankUrl) URL.revokeObjectURL(blankUrl);
    setOverlayUrl(null);
    setBlankUrl(null);
    overlayCanvasRef.current = null;
    blankCanvasRef.current = null;
  }

  function onFileChange(file: File | undefined) {
    if (!file) return;
    setError(null);
    revokePreviews();
    setFileName(file.name);

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const suggested = Math.max(
        3,
        Math.round(Math.min(img.naturalWidth, img.naturalHeight) / 250),
      );
      setBlankWidthInput(String(suggested));
      setSource(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setSource(null);
      setError(t.noImage);
    };
    img.src = url;
  }

  function ensureReady() {
    if (!source) {
      setError(t.noImage);
      return false;
    }
    if (!gridValid) {
      setError(t.invalidGrid);
      return false;
    }
    if (!widthsValid) {
      setError(t.invalidWidth);
      return false;
    }
    return true;
  }

  function generate() {
    if (!ensureReady() || !source) return;

    const overlay = renderOverlayGrid(source, rows, cols, overlayWidth);
    const blank = renderBlankGrid(
      source.naturalWidth,
      source.naturalHeight,
      rows,
      cols,
      blankWidth,
    );

    setError(null);
    revokePreviews();
    overlayCanvasRef.current = overlay;
    blankCanvasRef.current = blank;

    canvasToPreviewUrl(overlay, setOverlayUrl);
    canvasToPreviewUrl(blank, setBlankUrl);
  }

  function scramble() {
    if (!ensureReady() || !source) return;
    if (!overlayCanvasRef.current || !blankCanvasRef.current) {
      setError(t.generateFirst);
      return;
    }

    const scrambled = renderScrambledImage(source, rows, cols, {
      withFineGrid: true,
      fineLineWidth: overlayWidth,
    });

    setError(null);
    if (overlayUrl) URL.revokeObjectURL(overlayUrl);
    overlayCanvasRef.current = scrambled;
    setOverlayUrl(null);
    canvasToPreviewUrl(scrambled, setOverlayUrl);
  }

  function downloadOverlay() {
    if (!overlayCanvasRef.current) {
      setError(t.generateFirst);
      return;
    }
    downloadCanvas(overlayCanvasRef.current, `${baseName}-grid-overlay.png`);
  }

  function downloadBlank() {
    if (!blankCanvasRef.current) {
      setError(t.generateFirst);
      return;
    }
    downloadCanvas(blankCanvasRef.current, `${baseName}-grid-blank.png`);
  }

  function downloadBoth() {
    if (!overlayCanvasRef.current || !blankCanvasRef.current) {
      setError(t.generateFirst);
      return;
    }
    const combined = renderCombined(
      overlayCanvasRef.current,
      blankCanvasRef.current,
      16,
    );
    downloadCanvas(combined, `${baseName}-grid-both.png`);
  }

  return (
    <ToolChrome eyebrow={t.eyebrow} title={t.title} lead={t.lead}>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-5 border border-line bg-surface/50 p-5 sm:p-6">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
              {t.upload}
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => onFileChange(event.target.files?.[0])}
              className="mt-3 block w-full cursor-pointer text-sm text-ink-muted file:mr-4 file:cursor-pointer file:border-0 file:bg-blue-deep file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:file:bg-blue"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
                {t.rows}
              </span>
              <input
                type="number"
                min={1}
                step={1}
                value={rowsInput}
                onChange={(event) => setRowsInput(event.target.value)}
                className="mt-2 w-full border border-line bg-white/70 px-3 py-2 text-sm text-ink outline-none focus:border-blue"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
                {t.cols}
              </span>
              <input
                type="number"
                min={1}
                step={1}
                value={colsInput}
                onChange={(event) => setColsInput(event.target.value)}
                className="mt-2 w-full border border-line bg-white/70 px-3 py-2 text-sm text-ink outline-none focus:border-blue"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
                {t.overlayWidth}
              </span>
              <input
                type="number"
                min={1}
                step={1}
                value={overlayWidthInput}
                onChange={(event) => setOverlayWidthInput(event.target.value)}
                className="mt-2 w-full border border-line bg-white/70 px-3 py-2 text-sm text-ink outline-none focus:border-blue"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
                {t.blankWidth}
              </span>
              <input
                type="number"
                min={1}
                step={1}
                value={blankWidthInput}
                onChange={(event) => setBlankWidthInput(event.target.value)}
                className="mt-2 w-full border border-line bg-white/70 px-3 py-2 text-sm text-ink outline-none focus:border-blue"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={generate}
            className="inline-flex cursor-pointer items-center justify-center bg-blue-deep px-5 py-3 text-sm font-bold tracking-wide text-white transition hover:bg-blue"
          >
            {t.generate}
          </button>

          <p className="text-xs leading-relaxed text-ink-muted">{t.hint}</p>
          {error ? (
            <p className="text-sm font-medium text-red-700">{error}</p>
          ) : null}

          {source ? (
            <p className="text-xs text-ink-muted">
              {source.naturalWidth} × {source.naturalHeight}px
            </p>
          ) : null}
        </div>

        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <figure className="border border-line bg-surface/40 p-3">
              <figcaption className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-green">
                {t.overlayTitle}
              </figcaption>
              {overlayUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={overlayUrl}
                  alt={t.overlayTitle}
                  className="max-h-80 w-full object-contain bg-white"
                />
              ) : (
                <div className="flex h-40 items-center justify-center bg-white/60 text-xs text-ink-muted">
                  —
                </div>
              )}
            </figure>
            <figure className="border border-line bg-surface/40 p-3">
              <figcaption className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-green">
                {t.blankTitle}
              </figcaption>
              {blankUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={blankUrl}
                  alt={t.blankTitle}
                  className="max-h-80 w-full object-contain bg-white"
                />
              ) : (
                <div className="flex h-40 items-center justify-center bg-white/60 text-xs text-ink-muted">
                  —
                </div>
              )}
            </figure>
          </div>

          <button
            type="button"
            onClick={scramble}
            className="inline-flex cursor-pointer items-center justify-center border border-ink/35 bg-surface/80 px-5 py-3 text-sm font-bold tracking-wide text-ink transition hover:border-green hover:text-green"
          >
            {t.scramble}
          </button>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={downloadOverlay}
              className="inline-flex cursor-pointer items-center justify-center border border-blue/50 px-4 py-2.5 text-sm font-bold tracking-wide text-blue-deep transition hover:border-blue-deep hover:bg-blue/5"
            >
              {t.downloadOverlay}
            </button>
            <button
              type="button"
              onClick={downloadBlank}
              className="inline-flex cursor-pointer items-center justify-center border border-blue/50 px-4 py-2.5 text-sm font-bold tracking-wide text-blue-deep transition hover:border-blue-deep hover:bg-blue/5"
            >
              {t.downloadBlank}
            </button>
            <button
              type="button"
              onClick={downloadBoth}
              className="inline-flex cursor-pointer items-center justify-center bg-ink px-4 py-2.5 text-sm font-bold tracking-wide text-white transition hover:bg-blue-deep"
            >
              {t.downloadBoth}
            </button>
          </div>
        </div>
      </div>
    </ToolChrome>
  );
}
