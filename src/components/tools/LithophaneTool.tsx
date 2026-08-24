"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { StlPreview } from "@/components/tools/StlPreview";
import { ToolChrome } from "@/components/tools/ToolChrome";
import {
  DEFAULT_LITHOPHANE_PARAMS,
  downloadArrayBuffer,
  generateLithophane,
  LITHOPHANE_LIMITS,
  lithophaneFilename,
  type LithophaneParams,
  type LithophaneResult,
} from "@/lib/lithophane";
import type { Locale } from "@/lib/types";

const copy: Record<
  Locale,
  {
    eyebrow: string;
    title: string;
    lead: string;
    upload: string;
    maxSize: string;
    minThickness: string;
    maxThickness: string;
    resolution: string;
    invert: string;
    invertHint: string;
    mirror: string;
    mirrorHint: string;
    generate: string;
    generating: string;
    download: string;
    hint: string;
    emptyPreview: string;
    controlsHint: string;
    noImage: string;
    generateFirst: string;
    dims: string;
    triangles: string;
    samples: string;
    printTip: string;
  }
> = {
  en: {
    eyebrow: "3D / Image",
    title: "Lithophane",
    lead: "Upload a photo, tune thickness and size, then download a backlit lithophane STL — processed entirely in your browser.",
    upload: "Choose image",
    maxSize: "Max size (mm)",
    minThickness: "Min thickness (mm)",
    maxThickness: "Max thickness (mm)",
    resolution: "Resolution",
    invert: "Invert (bright = thick)",
    invertHint: "Default: dark areas are thicker so they block more light when backlit.",
    mirror: "Mirror horizontally",
    mirrorHint: "Useful if you print face-down on the bed.",
    generate: "Generate STL",
    generating: "Generating…",
    download: "Download STL",
    hint: "PNG or JPEG. Nothing is uploaded — meshing stays on your device.",
    emptyPreview: "Load an image and generate to preview the lithophane.",
    controlsHint: "Drag to orbit · scroll to zoom · double-click to reset",
    noImage: "Load an image first.",
    generateFirst: "Generate the STL first.",
    dims: "Print size",
    triangles: "Triangles",
    samples: "Samples",
    printTip:
      "Print in a translucent filament (white PLA works well), face-up or face-down with supports as needed. Backlight the finished piece to see the image.",
  },
  es: {
    eyebrow: "3D / Imagen",
    title: "Litofanía",
    lead: "Subí una foto, ajustá espesor y tamaño, y descargá un STL de litofanía para backlight — todo se procesa en tu navegador.",
    upload: "Elegir imagen",
    maxSize: "Tamaño máx. (mm)",
    minThickness: "Espesor mín. (mm)",
    maxThickness: "Espesor máx. (mm)",
    resolution: "Resolución",
    invert: "Invertir (claro = grueso)",
    invertHint: "Por defecto: las zonas oscuras son más gruesas y bloquean más luz con backlight.",
    mirror: "Espejar horizontal",
    mirrorHint: "Útil si imprimís cara abajo sobre la cama.",
    generate: "Generar STL",
    generating: "Generando…",
    download: "Descargar STL",
    hint: "PNG o JPEG. No se sube nada — el mallado queda en tu dispositivo.",
    emptyPreview: "Cargá una imagen y generá para ver la litofanía.",
    controlsHint: "Arrastrá para orbitar · scroll para zoom · doble clic para reset",
    noImage: "Cargá una imagen primero.",
    generateFirst: "Generá el STL primero.",
    dims: "Tamaño de impresión",
    triangles: "Triángulos",
    samples: "Muestras",
    printTip:
      "Imprimí con filament translúcido (PLA blanco funciona bien), cara arriba o abajo según soporte. Iluminá la pieza desde atrás para ver la imagen.",
  },
};

function formatMm(n: number) {
  return `${n.toFixed(1)} mm`;
}

export function LithophaneTool() {
  const { locale } = useLanguage();
  const t = copy[locale];

  const [source, setSource] = useState<HTMLImageElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("lithophane");
  const [params, setParams] = useState<LithophaneParams>(DEFAULT_LITHOPHANE_PARAMS);
  const [result, setResult] = useState<LithophaneResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const genTokenRef = useRef(0);

  useEffect(() => {
    previewUrlRef.current = previewUrl;
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  function onFileChange(file: File | undefined) {
    if (!file) return;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setPreviewUrl(url);
      setSource(img);
      setFileName(file.name.replace(/\.[^.]+$/, "") || "lithophane");
      setResult(null);
      setError(null);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError(locale === "es" ? "No se pudo leer la imagen." : "Could not read the image.");
    };
    img.src = url;
  }

  function patchParam<K extends keyof LithophaneParams>(
    key: K,
    value: LithophaneParams[K],
  ) {
    setParams((prev) => ({ ...prev, [key]: value }));
    setResult(null);
  }

  function runGenerate() {
    if (!source) {
      setError(t.noImage);
      return;
    }
    const token = ++genTokenRef.current;
    setRunning(true);
    setError(null);

    // Yield so the UI can show "Generating…" before the sync mesh work.
    window.setTimeout(() => {
      if (token !== genTokenRef.current) return;
      try {
        const next = generateLithophane(source, params);
        if (token !== genTokenRef.current) return;
        setResult(next);
      } catch (err) {
        if (token !== genTokenRef.current) return;
        setResult(null);
        setError(
          err instanceof Error
            ? err.message
            : locale === "es"
              ? "Error al generar el STL."
              : "Failed to generate STL.",
        );
      } finally {
        if (token === genTokenRef.current) setRunning(false);
      }
    }, 30);
  }

  function onDownload() {
    if (!result) {
      setError(t.generateFirst);
      return;
    }
    downloadArrayBuffer(result.buffer, lithophaneFilename(fileName));
  }

  const limits = LITHOPHANE_LIMITS;

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
              accept="image/*"
              onChange={(event) => onFileChange(event.target.files?.[0])}
              className="mt-3 block w-full cursor-pointer text-sm text-ink-muted file:mr-4 file:cursor-pointer file:border-0 file:bg-blue-deep file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:file:bg-blue"
            />
          </label>

          {previewUrl ? (
            <figure className="border border-line bg-surface/40 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt=""
                className="mx-auto max-h-56 w-auto max-w-full object-contain"
              />
            </figure>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
                {t.maxSize}
              </span>
              <input
                type="number"
                min={limits.maxSizeMm.min}
                max={limits.maxSizeMm.max}
                step={1}
                value={params.maxSizeMm}
                onChange={(event) =>
                  patchParam("maxSizeMm", Number(event.target.value) || DEFAULT_LITHOPHANE_PARAMS.maxSizeMm)
                }
                className="mt-2 w-full border border-line bg-white/70 px-3 py-2 text-sm text-ink outline-none focus:border-blue"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
                {t.resolution}
              </span>
              <input
                type="number"
                min={limits.resolution.min}
                max={limits.resolution.max}
                step={10}
                value={params.resolution}
                onChange={(event) =>
                  patchParam(
                    "resolution",
                    Number(event.target.value) || DEFAULT_LITHOPHANE_PARAMS.resolution,
                  )
                }
                className="mt-2 w-full border border-line bg-white/70 px-3 py-2 text-sm text-ink outline-none focus:border-blue"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
                {t.minThickness}
              </span>
              <input
                type="number"
                min={limits.minThicknessMm.min}
                max={limits.minThicknessMm.max}
                step={0.1}
                value={params.minThicknessMm}
                onChange={(event) =>
                  patchParam(
                    "minThicknessMm",
                    Number(event.target.value) || DEFAULT_LITHOPHANE_PARAMS.minThicknessMm,
                  )
                }
                className="mt-2 w-full border border-line bg-white/70 px-3 py-2 text-sm text-ink outline-none focus:border-blue"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
                {t.maxThickness}
              </span>
              <input
                type="number"
                min={limits.maxThicknessMm.min}
                max={limits.maxThicknessMm.max}
                step={0.1}
                value={params.maxThicknessMm}
                onChange={(event) =>
                  patchParam(
                    "maxThicknessMm",
                    Number(event.target.value) || DEFAULT_LITHOPHANE_PARAMS.maxThicknessMm,
                  )
                }
                className="mt-2 w-full border border-line bg-white/70 px-3 py-2 text-sm text-ink outline-none focus:border-blue"
              />
            </label>
          </div>

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={params.invert}
              onChange={(event) => patchParam("invert", event.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-semibold text-ink">{t.invert}</span>
              <span className="mt-0.5 block text-xs text-ink-muted">{t.invertHint}</span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={params.mirror}
              onChange={(event) => patchParam("mirror", event.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-semibold text-ink">{t.mirror}</span>
              <span className="mt-0.5 block text-xs text-ink-muted">{t.mirrorHint}</span>
            </span>
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
              onClick={runGenerate}
              disabled={running || !source}
              className="bg-blue-deep px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue disabled:cursor-not-allowed disabled:opacity-50"
            >
              {running ? t.generating : t.generate}
            </button>
            <button
              type="button"
              onClick={onDownload}
              disabled={!result || running}
              className="border border-line bg-white/70 px-4 py-2.5 text-sm font-bold text-ink transition hover:border-blue disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t.download}
            </button>
          </div>

          {result ? (
            <dl className="grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
                  {t.dims}
                </dt>
                <dd className="mt-1 text-ink">
                  {formatMm(result.widthMm)} × {formatMm(result.depthMm)} ×{" "}
                  {formatMm(result.heightMm)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
                  {t.samples}
                </dt>
                <dd className="mt-1 text-ink">
                  {result.cols} × {result.rows}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
                  {t.triangles}
                </dt>
                <dd className="mt-1 text-ink">
                  {result.triangles.toLocaleString(locale)}
                </dd>
              </div>
            </dl>
          ) : null}
        </div>

        <div className="min-h-[360px] border border-line bg-surface/40 sm:min-h-[480px]">
          <StlPreview
            buffer={result?.buffer ?? null}
            emptyLabel={t.emptyPreview}
            controlsHint={t.controlsHint}
          />
        </div>
      </div>
    </ToolChrome>
  );
}
