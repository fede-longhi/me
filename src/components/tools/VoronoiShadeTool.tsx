"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { StlPreview } from "@/components/tools/StlPreview";
import { ToolChrome } from "@/components/tools/ToolChrome";
import {
  DEFAULT_VORONOI_SHADE_PARAMS,
  downloadArrayBuffer,
  generateVoronoiShade,
  voronoiShadeFilename,
  type VoronoiPreview,
  type VoronoiShadeParams,
  type VoronoiShadeShape,
} from "@/lib/voronoi-shade";
import type { Locale } from "@/lib/types";

const copy: Record<
  Locale,
  {
    eyebrow: string;
    title: string;
    lead: string;
    shape: string;
    cylinder: string;
    cone: string;
    height: string;
    radius: string;
    radiusTop: string;
    radiusBottom: string;
    wall: string;
    cells: string;
    strut: string;
    seed: string;
    solidTop: string;
    solidBottom: string;
    generate: string;
    generating: string;
    download: string;
    hint: string;
    pattern: string;
    emptyPreview: string;
    controlsHint: string;
    dims: string;
    triangles: string;
    printTip: string;
    error: string;
    regenerate: string;
  }
> = {
  en: {
    eyebrow: "3D / Pattern",
    title: "Voronoi Shade",
    lead: "Design a Voronoi lampshade — cylinder or cone — tune cell density and strut width, then export a print-ready STL.",
    shape: "Shape",
    cylinder: "Cylinder",
    cone: "Cone",
    height: "Height (mm)",
    radius: "Radius (mm)",
    radiusTop: "Top radius (mm)",
    radiusBottom: "Bottom radius (mm)",
    wall: "Wall (mm)",
    cells: "Cell count",
    strut: "Strut width (mm)",
    seed: "Pattern seed",
    solidTop: "Solid top rim",
    solidBottom: "Solid base ring",
    generate: "Generate STL",
    generating: "Generating…",
    download: "Download STL",
    hint: "Everything runs in your browser. Regenerate when you change the seed or density.",
    pattern: "Unwrapped pattern",
    emptyPreview: "Generate to preview the 3D shade.",
    controlsHint: "Drag to orbit · scroll to zoom · double-click to reset",
    dims: "Approx. size",
    triangles: "Triangles",
    printTip:
      "Print with 0.2 mm layers and 2–3 perimeters. Use a warm LED bulb; leave the base open for airflow if needed.",
    error: "Could not build the shade mesh. Try fewer cells or a wider strut.",
    regenerate: "Regenerate",
  },
  es: {
    eyebrow: "3D / Patrón",
    title: "Pantalla Voronoi",
    lead: "Diseñá una pantalla Voronoi — cilindro o cono — ajustá densidad y grosor de nervios, y exportá un STL listo para imprimir.",
    shape: "Forma",
    cylinder: "Cilindro",
    cone: "Cono",
    height: "Altura (mm)",
    radius: "Radio (mm)",
    radiusTop: "Radio superior (mm)",
    radiusBottom: "Radio inferior (mm)",
    wall: "Pared (mm)",
    cells: "Cantidad de celdas",
    strut: "Grosor de nervio (mm)",
    seed: "Semilla del patrón",
    solidTop: "Borde superior sólido",
    solidBottom: "Anillo de base sólido",
    generate: "Generar STL",
    generating: "Generando…",
    download: "Descargar STL",
    hint: "Todo corre en tu navegador. Regenerá cuando cambies la semilla o la densidad.",
    pattern: "Patrón desarrollado",
    emptyPreview: "Generá para ver la pantalla en 3D.",
    controlsHint: "Arrastrá para orbitar · scroll para zoom · doble clic para reset",
    dims: "Tamaño aprox.",
    triangles: "Triángulos",
    printTip:
      "Imprimí con capas de 0,2 mm y 2–3 perímetros. Usá LED cálida; dejá la base abierta si hace falta ventilación.",
    error: "No se pudo generar la malla. Probá con menos celdas o nervios más gruesos.",
    regenerate: "Regenerar",
  },
};

function drawPattern(
  canvas: HTMLCanvasElement,
  preview: VoronoiPreview | null,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx || !preview) return;

  const pad = 12;
  const w = canvas.width;
  const h = canvas.height;
  const scale = Math.min(
    (w - pad * 2) / preview.width,
    (h - pad * 2) / preview.height,
  );
  const ox = (w - preview.width * scale) / 2;
  const oy = (h - preview.height * scale) / 2;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#f4fbf8";
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "#1a8f5a";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (const [[ax, ay], [bx, by]] of preview.edges) {
    ctx.moveTo(ox + ax * scale, oy + (preview.height - ay) * scale);
    ctx.lineTo(ox + bx * scale, oy + (preview.height - by) * scale);
  }
  ctx.stroke();

  ctx.fillStyle = "#0b5fff";
  for (const [sx, sy] of preview.seeds) {
    ctx.beginPath();
    ctx.arc(
      ox + sx * scale,
      oy + (preview.height - sy) * scale,
      2.5,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  ctx.strokeStyle = "#d0d0d0";
  ctx.strokeRect(ox, oy, preview.width * scale, preview.height * scale);
}

export function VoronoiShadeTool() {
  const { locale } = useLanguage();
  const t = copy[locale];

  const [params, setParams] = useState<VoronoiShadeParams>(
    DEFAULT_VORONOI_SHADE_PARAMS,
  );
  const [preview2d, setPreview2d] = useState<VoronoiPreview | null>(null);
  const [stlBuffer, setStlBuffer] = useState<ArrayBuffer | null>(null);
  const [triangles, setTriangles] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const patternRef = useRef<HTMLCanvasElement | null>(null);
  const debounceRef = useRef<number | null>(null);

  const normalizedParams = useMemo(
    (): VoronoiShadeParams =>
      params.shape === "cylinder"
        ? { ...params, radiusTopMm: params.radiusBottomMm }
        : params,
    [params],
  );

  useEffect(() => {
    const canvas = patternRef.current;
    if (!canvas) return;
    drawPattern(canvas, preview2d);
  }, [preview2d]);

  function runGenerate(immediate = false) {
    const execute = () => {
      setRunning(true);
      setError(null);
      try {
        const result = generateVoronoiShade(normalizedParams);
        if (result.preview.edges.length === 0) {
          throw new Error("empty");
        }
        setPreview2d(result.preview);
        setStlBuffer(result.buffer);
        setTriangles(result.triangles);
      } catch {
        setStlBuffer(null);
        setPreview2d(null);
        setTriangles(0);
        setError(t.error);
      } finally {
        setRunning(false);
      }
    };

    if (immediate) {
      execute();
      return;
    }

    if (debounceRef.current != null) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(execute, 280);
  }

  useEffect(() => {
    runGenerate(true);
    return () => {
      if (debounceRef.current != null) {
        window.clearTimeout(debounceRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- regenerate when design params change
  }, [normalizedParams]);

  function patch<K extends keyof VoronoiShadeParams>(
    key: K,
    value: VoronoiShadeParams[K],
  ) {
    setParams((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "shape" && value === "cylinder") {
        next.radiusTopMm = next.radiusBottomMm;
      }
      return next;
    });
  }

  const inputClass =
    "mt-2 w-full border border-line bg-white/70 px-3 py-2 text-sm text-ink outline-none focus:border-blue";

  const maxDiam = Math.max(params.radiusBottomMm, params.radiusTopMm) * 2;

  return (
    <ToolChrome eyebrow={t.eyebrow} title={t.title} lead={t.lead} wide>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="space-y-5 border border-line bg-surface/50 p-5 sm:p-6">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
              {t.shape}
            </span>
            <div className="mt-2 flex gap-2">
              {(["cylinder", "cone"] as VoronoiShadeShape[]).map((shape) => (
                <button
                  key={shape}
                  type="button"
                  onClick={() => patch("shape", shape)}
                  className={`px-3 py-1.5 text-xs font-bold ${
                    params.shape === shape
                      ? "bg-blue-deep text-white"
                      : "border border-line bg-white/70 text-ink"
                  }`}
                >
                  {shape === "cylinder" ? t.cylinder : t.cone}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
                {t.height}
              </span>
              <input
                type="number"
                min={40}
                max={300}
                step={5}
                value={params.heightMm}
                onChange={(e) => patch("heightMm", Number(e.target.value) || 120)}
                className={inputClass}
              />
            </label>
            {params.shape === "cylinder" ? (
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
                  {t.radius}
                </span>
                <input
                  type="number"
                  min={20}
                  max={150}
                  step={5}
                  value={params.radiusBottomMm}
                  onChange={(e) => {
                    const r = Number(e.target.value) || 60;
                    setParams((prev) => ({
                      ...prev,
                      radiusBottomMm: r,
                      radiusTopMm: r,
                    }));
                  }}
                  className={inputClass}
                />
              </label>
            ) : (
              <>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
                    {t.radiusBottom}
                  </span>
                  <input
                    type="number"
                    min={20}
                    max={150}
                    step={5}
                    value={params.radiusBottomMm}
                    onChange={(e) =>
                      patch("radiusBottomMm", Number(e.target.value) || 60)
                    }
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
                    {t.radiusTop}
                  </span>
                  <input
                    type="number"
                    min={10}
                    max={150}
                    step={5}
                    value={params.radiusTopMm}
                    onChange={(e) =>
                      patch("radiusTopMm", Number(e.target.value) || 40)
                    }
                    className={inputClass}
                  />
                </label>
              </>
            )}
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
                {t.wall}
              </span>
              <input
                type="number"
                min={0.8}
                max={4}
                step={0.1}
                value={params.wallMm}
                onChange={(e) => patch("wallMm", Number(e.target.value) || 1.2)}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
                {t.cells}
              </span>
              <input
                type="number"
                min={16}
                max={160}
                step={4}
                value={params.cellCount}
                onChange={(e) =>
                  patch("cellCount", Number(e.target.value) || 48)
                }
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
                {t.strut}
              </span>
              <input
                type="number"
                min={0.8}
                max={6}
                step={0.1}
                value={params.strutWidthMm}
                onChange={(e) =>
                  patch("strutWidthMm", Number(e.target.value) || 1.6)
                }
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
                {t.seed}
              </span>
              <input
                type="number"
                min={1}
                max={99999}
                step={1}
                value={params.seed}
                onChange={(e) => patch("seed", Number(e.target.value) || 1)}
                className={inputClass}
              />
            </label>
          </div>

          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={params.solidTop}
              onChange={(e) => patch("solidTop", e.target.checked)}
            />
            <span className="text-sm text-ink">{t.solidTop}</span>
          </label>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={params.solidBottom}
              onChange={(e) => patch("solidBottom", e.target.checked)}
            />
            <span className="text-sm text-ink">{t.solidBottom}</span>
          </label>

          <p className="text-xs leading-relaxed text-ink-muted">{t.hint}</p>
          <p className="text-xs leading-relaxed text-ink-muted">{t.printTip}</p>

          {error ? (
            <p className="text-sm font-medium text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => runGenerate(true)}
              disabled={running}
              className="bg-blue-deep px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue disabled:opacity-50"
            >
              {running ? t.generating : t.regenerate}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!stlBuffer) return;
                downloadArrayBuffer(
                  stlBuffer,
                  voronoiShadeFilename(params.shape),
                );
              }}
              disabled={!stlBuffer || running}
              className="border border-line bg-white/70 px-4 py-2.5 text-sm font-bold text-ink transition hover:border-blue disabled:opacity-50"
            >
              {t.download}
            </button>
          </div>

          {stlBuffer ? (
            <dl className="grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
                  {t.dims}
                </dt>
                <dd className="mt-1 text-ink">
                  Ø{maxDiam.toFixed(0)} × {params.heightMm.toFixed(0)} mm
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
                  {t.triangles}
                </dt>
                <dd className="mt-1 text-ink">
                  {triangles.toLocaleString(locale)}
                </dd>
              </div>
            </dl>
          ) : null}
        </div>

        <div className="space-y-4">
          <figure className="border border-line bg-surface/40 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-green">
              {t.pattern}
            </p>
            <canvas
              ref={patternRef}
              width={640}
              height={360}
              className="mx-auto block h-auto w-full max-w-full bg-[#f4fbf8]"
            />
          </figure>
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
