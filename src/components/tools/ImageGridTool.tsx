"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { ToolChrome } from "@/components/tools/ToolChrome";
import {
  createCanvas,
  createIdentityOrder,
  downloadCanvas,
  renderBlankGrid,
  renderCombined,
  renderTiledImage,
  shuffleOrder,
  swapOrderIndices,
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
    overlayColor: string;
    blankColor: string;
    scramble: string;
    resetTiles: string;
    overlayTitle: string;
    blankTitle: string;
    downloadOverlay: string;
    downloadBlank: string;
    downloadBoth: string;
    hint: string;
    dragHint: string;
    invalidGrid: string;
    invalidWidth: string;
    noImage: string;
    generateFirst: string;
  }
> = {
  en: {
    eyebrow: "Image tool",
    title: "Image Grid",
    lead: "Upload an image, tweak the grid, drag tiles to swap them, then export both grids at the original size.",
    upload: "Choose image",
    rows: "Rows",
    cols: "Columns",
    overlayWidth: "Overlay line width",
    blankWidth: "Blank line width",
    overlayColor: "Overlay color",
    blankColor: "Blank color",
    scramble: "Scramble tiles",
    resetTiles: "Reset tiles",
    overlayTitle: "Original + grid",
    blankTitle: "Blank + grid",
    downloadOverlay: "Download overlay",
    downloadBlank: "Download blank grid",
    downloadBoth: "Download both (side by side)",
    hint: "PNG recommended. Processing stays in your browser — nothing is uploaded.",
    dragHint: "Drag a tile onto another to swap them.",
    invalidGrid: "Rows and columns must be whole numbers of at least 1.",
    invalidWidth: "Line widths must be whole numbers of at least 1.",
    noImage: "Load an image first.",
    generateFirst: "Load an image and wait for the preview first.",
  },
  es: {
    eyebrow: "Herramienta de imagen",
    title: "Grilla de imagen",
    lead: "Subí una imagen, ajustá la grilla, arrastrá cuadrados para intercambiarlos y exportá ambas grillas al tamaño original.",
    upload: "Elegir imagen",
    rows: "Filas",
    cols: "Columnas",
    overlayWidth: "Grosor overlay",
    blankWidth: "Grosor en blanco",
    overlayColor: "Color overlay",
    blankColor: "Color en blanco",
    scramble: "Desordenar cuadrados",
    resetTiles: "Restablecer cuadrados",
    overlayTitle: "Original + grilla",
    blankTitle: "Blanco + grilla",
    downloadOverlay: "Descargar overlay",
    downloadBlank: "Descargar grilla en blanco",
    downloadBoth: "Descargar ambas (lado a lado)",
    hint: "Se recomienda PNG. Todo se procesa en tu navegador — no se sube nada.",
    dragHint: "Arrastrá un cuadrado sobre otro para intercambiarlos.",
    invalidGrid: "Filas y columnas tienen que ser enteros de al menos 1.",
    invalidWidth: "Los grosores tienen que ser enteros de al menos 1.",
    noImage: "Cargá una imagen primero.",
    generateFirst: "Cargá una imagen y esperá el preview primero.",
  },
};

function canvasToBlobUrl(canvas: HTMLCanvasElement) {
  return new Promise<string>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(URL.createObjectURL(blob));
      else reject(new Error("Could not create preview"));
    });
  });
}

type ContainLayout = {
  offsetX: number;
  offsetY: number;
  drawW: number;
  drawH: number;
};

function getObjectContainLayout(
  boxW: number,
  boxH: number,
  naturalW: number,
  naturalH: number,
): ContainLayout {
  const scale = Math.min(boxW / naturalW, boxH / naturalH);
  const drawW = naturalW * scale;
  const drawH = naturalH * scale;
  return {
    offsetX: (boxW - drawW) / 2,
    offsetY: (boxH - drawH) / 2,
    drawW,
    drawH,
  };
}

function cellAtClientPoint(
  img: HTMLImageElement,
  clientX: number,
  clientY: number,
  rows: number,
  cols: number,
) {
  const rect = img.getBoundingClientRect();
  const layout = getObjectContainLayout(
    rect.width,
    rect.height,
    img.naturalWidth,
    img.naturalHeight,
  );
  const x = clientX - rect.left - layout.offsetX;
  const y = clientY - rect.top - layout.offsetY;
  if (x < 0 || y < 0 || x >= layout.drawW || y >= layout.drawH) return null;
  const col = Math.min(cols - 1, Math.floor((x / layout.drawW) * cols));
  const row = Math.min(rows - 1, Math.floor((y / layout.drawH) * rows));
  return row * cols + col;
}

function cropTilePreview(
  canvas: HTMLCanvasElement,
  index: number,
  rows: number,
  cols: number,
) {
  const cellW = canvas.width / cols;
  const cellH = canvas.height / rows;
  const col = index % cols;
  const row = Math.floor(index / cols);
  const sx = col * cellW;
  const sy = row * cellH;
  const sw = col === cols - 1 ? canvas.width - sx : cellW;
  const sh = row === rows - 1 ? canvas.height - sy : cellH;
  const { canvas: tileCanvas, ctx } = createCanvas(
    Math.max(1, Math.round(sw)),
    Math.max(1, Math.round(sh)),
  );
  ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, tileCanvas.width, tileCanvas.height);
  return tileCanvas.toDataURL("image/png");
}

export function ImageGridTool() {
  const { locale } = useLanguage();
  const t = copy[locale];

  const [rowsInput, setRowsInput] = useState("4");
  const [colsInput, setColsInput] = useState("4");
  const [overlayWidthInput, setOverlayWidthInput] = useState("1");
  const [blankWidthInput, setBlankWidthInput] = useState("4");
  const [overlayColor, setOverlayColor] = useState("#000000");
  const [blankColor, setBlankColor] = useState("#111111");
  const [source, setSource] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("image");
  const [tileOrder, setTileOrder] = useState<number[] | null>(null);
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null);
  const [blankUrl, setBlankUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [dragGhostUrl, setDragGhostUrl] = useState<string | null>(null);
  const [dragGhostSize, setDragGhostSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [overlayLayout, setOverlayLayout] = useState<ContainLayout | null>(
    null,
  );

  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const blankCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayUrlRef = useRef<string | null>(null);
  const blankUrlRef = useRef<string | null>(null);
  const overlayImgRef = useRef<HTMLImageElement | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const hoverIndexRef = useRef<number | null>(null);
  const dragGhostRef = useRef<HTMLDivElement | null>(null);
  const grabOffsetRef = useRef({ x: 0, y: 0 });
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const dragEndingRef = useRef(false);

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
    overlayUrlRef.current = overlayUrl;
  }, [overlayUrl]);

  useEffect(() => {
    blankUrlRef.current = blankUrl;
  }, [blankUrl]);

  useEffect(() => {
    return () => {
      if (overlayUrlRef.current) URL.revokeObjectURL(overlayUrlRef.current);
      if (blankUrlRef.current) URL.revokeObjectURL(blankUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!source || !gridValid) {
      setTileOrder(null);
      clearDragState();
      return;
    }
    setTileOrder(createIdentityOrder(rows, cols));
    clearDragState();
  }, [source, rows, cols, gridValid]);

  useEffect(() => {
    if (!source) {
      overlayCanvasRef.current = null;
      blankCanvasRef.current = null;
      setOverlayUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setBlankUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setOverlayLayout(null);
      return;
    }

    if (!gridValid || !widthsValid || !tileOrder) return;
    if (tileOrder.length !== rows * cols) return;

    let cancelled = false;
    const overlay = renderTiledImage(source, rows, cols, tileOrder, {
      withFineGrid: true,
      fineLineWidth: overlayWidth,
      strokeStyle: overlayColor,
    });
    const blank = renderBlankGrid(
      source.naturalWidth,
      source.naturalHeight,
      rows,
      cols,
      blankWidth,
      blankColor,
    );

    overlayCanvasRef.current = overlay;
    blankCanvasRef.current = blank;
    setError(null);

    void Promise.all([canvasToBlobUrl(overlay), canvasToBlobUrl(blank)]).then(
      ([nextOverlayUrl, nextBlankUrl]) => {
        if (cancelled) {
          URL.revokeObjectURL(nextOverlayUrl);
          URL.revokeObjectURL(nextBlankUrl);
          return;
        }
        setOverlayUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return nextOverlayUrl;
        });
        setBlankUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return nextBlankUrl;
        });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [
    source,
    rows,
    cols,
    overlayWidth,
    blankWidth,
    overlayColor,
    blankColor,
    gridValid,
    widthsValid,
    tileOrder,
  ]);

  function syncOverlayLayout() {
    const img = overlayImgRef.current;
    if (!img || !img.naturalWidth || !img.naturalHeight) {
      setOverlayLayout(null);
      return;
    }
    const rect = img.getBoundingClientRect();
    setOverlayLayout(
      getObjectContainLayout(
        rect.width,
        rect.height,
        img.naturalWidth,
        img.naturalHeight,
      ),
    );
  }

  useEffect(() => {
    if (!overlayUrl) {
      setOverlayLayout(null);
      return;
    }
    syncOverlayLayout();
    const img = overlayImgRef.current;
    if (!img) return;

    const observer = new ResizeObserver(() => syncOverlayLayout());
    observer.observe(img);
    window.addEventListener("resize", syncOverlayLayout);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncOverlayLayout);
    };
  }, [overlayUrl, rows, cols]);

  function onFileChange(file: File | undefined) {
    if (!file) return;
    setError(null);
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

  function clearDragState() {
    dragIndexRef.current = null;
    hoverIndexRef.current = null;
    dragEndingRef.current = false;
    setDragIndex(null);
    setHoverIndex(null);
    setDragGhostUrl(null);
    setDragGhostSize(null);
  }

  function placeDragGhost(clientX: number, clientY: number) {
    const ghost = dragGhostRef.current;
    if (!ghost) return;
    const { x, y } = grabOffsetRef.current;
    ghost.style.transform = `translate3d(${clientX - x}px, ${clientY - y}px, 0)`;
  }

  function resolveDropCell(
    img: HTMLImageElement,
    clientX: number,
    clientY: number,
  ) {
    // Prefer the last cell tracked during move — Android often reports
    // unreliable coordinates on pointerup / pointercancel.
    if (hoverIndexRef.current !== null) return hoverIndexRef.current;

    const fromLastPointer = cellAtClientPoint(
      img,
      lastPointerRef.current.x,
      lastPointerRef.current.y,
      rows,
      cols,
    );
    if (fromLastPointer !== null) return fromLastPointer;

    return cellAtClientPoint(img, clientX, clientY, rows, cols);
  }

  useLayoutEffect(() => {
    if (!dragGhostUrl) return;
    const { x, y } = lastPointerRef.current;
    placeDragGhost(x, y);
  }, [dragGhostUrl, dragGhostSize]);

  function scramble() {
    if (!ensureReady() || !tileOrder) return;
    setTileOrder(shuffleOrder(tileOrder));
    clearDragState();
  }

  function resetTiles() {
    if (!ensureReady() || !gridValid) return;
    setTileOrder(createIdentityOrder(rows, cols));
    clearDragState();
  }

  function onOverlayPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!ensureReady() || !overlayImgRef.current || !gridValid) return;
    // Touch pointers report button 0; ignore non-primary mouse/pen buttons.
    if (event.pointerType !== "touch" && event.button !== 0) return;

    const img = overlayImgRef.current;
    const cell = cellAtClientPoint(
      img,
      event.clientX,
      event.clientY,
      rows,
      cols,
    );
    if (cell === null) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragEndingRef.current = false;

    const rect = img.getBoundingClientRect();
    const layout = getObjectContainLayout(
      rect.width,
      rect.height,
      img.naturalWidth,
      img.naturalHeight,
    );
    const cellW = layout.drawW / cols;
    const cellH = layout.drawH / rows;
    const col = cell % cols;
    const row = Math.floor(cell / cols);
    grabOffsetRef.current = {
      x: event.clientX - (rect.left + layout.offsetX + col * cellW),
      y: event.clientY - (rect.top + layout.offsetY + row * cellH),
    };
    lastPointerRef.current = { x: event.clientX, y: event.clientY };

    // Sync refs immediately so move/up work before React re-renders (critical on touch).
    dragIndexRef.current = cell;
    hoverIndexRef.current = cell;

    const canvas = overlayCanvasRef.current;
    if (canvas) {
      setDragGhostUrl(cropTilePreview(canvas, cell, rows, cols));
      setDragGhostSize({ width: cellW, height: cellH });
    }

    setOverlayLayout(layout);
    setDragIndex(cell);
    setHoverIndex(cell);
    setError(null);
  }

  function onOverlayPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (dragIndexRef.current === null || !overlayImgRef.current || !gridValid) {
      return;
    }
    event.preventDefault();
    lastPointerRef.current = { x: event.clientX, y: event.clientY };
    placeDragGhost(event.clientX, event.clientY);
    const cell = cellAtClientPoint(
      overlayImgRef.current,
      event.clientX,
      event.clientY,
      rows,
      cols,
    );
    // Keep the last valid cell so a lift slightly outside the image still swaps.
    if (cell !== null) {
      hoverIndexRef.current = cell;
      setHoverIndex(cell);
    }
  }

  function endOverlayDrag(event: PointerEvent<HTMLDivElement>) {
    const from = dragIndexRef.current;
    if (from === null || !overlayImgRef.current || !gridValid) {
      clearDragState();
      return;
    }
    // pointercancel + pointerup can both fire on Android — only handle once.
    if (dragEndingRef.current) return;
    dragEndingRef.current = true;

    event.preventDefault();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const to = resolveDropCell(
      overlayImgRef.current,
      event.clientX,
      event.clientY,
    );

    if (to !== null && to !== from) {
      setTileOrder((prev) =>
        prev ? swapOrderIndices(prev, from, to) : prev,
      );
    }

    clearDragState();
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

  const cellCount = gridValid ? rows * cols : 0;
  const isDragging = dragIndex !== null;

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
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
                {t.overlayColor}
              </span>
              <div className="mt-2 flex items-center gap-2 border border-line bg-white/70 px-2 py-1.5">
                <input
                  type="color"
                  value={overlayColor}
                  onChange={(event) => setOverlayColor(event.target.value)}
                  className="h-8 w-10 cursor-pointer border-0 bg-transparent p-0"
                  aria-label={t.overlayColor}
                />
                <input
                  type="text"
                  value={overlayColor}
                  onChange={(event) => setOverlayColor(event.target.value)}
                  spellCheck={false}
                  className="min-w-0 flex-1 bg-transparent font-mono text-sm text-ink outline-none"
                />
              </div>
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
                {t.blankColor}
              </span>
              <div className="mt-2 flex items-center gap-2 border border-line bg-white/70 px-2 py-1.5">
                <input
                  type="color"
                  value={blankColor}
                  onChange={(event) => setBlankColor(event.target.value)}
                  className="h-8 w-10 cursor-pointer border-0 bg-transparent p-0"
                  aria-label={t.blankColor}
                />
                <input
                  type="text"
                  value={blankColor}
                  onChange={(event) => setBlankColor(event.target.value)}
                  spellCheck={false}
                  className="min-w-0 flex-1 bg-transparent font-mono text-sm text-ink outline-none"
                />
              </div>
            </label>
          </div>

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
                <div
                  className={`relative select-none bg-white touch-none ${
                    isDragging ? "cursor-grabbing" : "cursor-grab"
                  }`}
                  onPointerDown={onOverlayPointerDown}
                  onPointerMove={onOverlayPointerMove}
                  onPointerUp={endOverlayDrag}
                  onPointerCancel={endOverlayDrag}
                  onLostPointerCapture={endOverlayDrag}
                  onDragStart={(event) => event.preventDefault()}
                  style={{ touchAction: "none" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    ref={overlayImgRef}
                    src={overlayUrl}
                    alt={t.overlayTitle}
                    draggable={false}
                    onDragStart={(event) => event.preventDefault()}
                    onLoad={syncOverlayLayout}
                    className="pointer-events-none max-h-80 w-full select-none object-contain [-webkit-user-drag:none]"
                  />
                  {isDragging && overlayLayout && cellCount > 0 ? (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute grid"
                      style={{
                        left: overlayLayout.offsetX,
                        top: overlayLayout.offsetY,
                        width: overlayLayout.drawW,
                        height: overlayLayout.drawH,
                        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
                      }}
                    >
                      {Array.from({ length: cellCount }, (_, index) => {
                        const isSource = index === dragIndex;
                        const isTarget =
                          index === hoverIndex && index !== dragIndex;
                        return (
                          <div
                            key={index}
                            className={
                              isSource
                                ? "bg-white/80 ring-2 ring-inset ring-blue/70"
                                : isTarget
                                  ? "bg-green/25 ring-2 ring-inset ring-green"
                                  : undefined
                            }
                          />
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="flex h-40 items-center justify-center bg-white/60 text-xs text-ink-muted">
                  —
                </div>
              )}
              {overlayUrl ? (
                <p className="mt-2 text-xs text-ink-muted">{t.dragHint}</p>
              ) : null}
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
                  draggable={false}
                  onDragStart={(event) => event.preventDefault()}
                  className="max-h-80 w-full select-none object-contain bg-white [-webkit-user-drag:none]"
                />
              ) : (
                <div className="flex h-40 items-center justify-center bg-white/60 text-xs text-ink-muted">
                  —
                </div>
              )}
            </figure>
          </div>

          {dragGhostUrl && dragGhostSize ? (
            <div
              ref={dragGhostRef}
              aria-hidden
              className="pointer-events-none fixed top-0 left-0 z-50 will-change-transform"
              style={{
                width: dragGhostSize.width,
                height: dragGhostSize.height,
                transform: "translate3d(-9999px, -9999px, 0)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={dragGhostUrl}
                alt=""
                draggable={false}
                className="h-full w-full origin-center scale-105 rotate-2 rounded-sm object-cover opacity-95 shadow-xl ring-2 ring-blue [-webkit-user-drag:none]"
              />
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={scramble}
              className="inline-flex cursor-pointer items-center justify-center border border-ink/35 bg-surface/80 px-5 py-3 text-sm font-bold tracking-wide text-ink transition hover:border-green hover:text-green"
            >
              {t.scramble}
            </button>
            <button
              type="button"
              onClick={resetTiles}
              className="inline-flex cursor-pointer items-center justify-center border border-ink/35 bg-surface/80 px-5 py-3 text-sm font-bold tracking-wide text-ink transition hover:border-green hover:text-green"
            >
              {t.resetTiles}
            </button>
          </div>

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
