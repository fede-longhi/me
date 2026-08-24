"use client";

import { StlPreview } from "@/components/tools/StlPreview";
import {
  formatMetersPerCell,
  getTerrainProfile,
  previewSamplePlan,
  TERRAIN_PROFILES,
  type TerrainProfileId,
} from "@/lib/terrain-profiles";
import type { HeightGrid, MapSelection, TerrainTimings } from "@/lib/map-stl";

export type CompareRunResult = {
  profileId: TerrainProfileId;
  buffer: ArrayBuffer;
  grid: HeightGrid | null;
  timings: TerrainTimings;
  triangles: number;
  cols: number;
  rows: number;
  metersPerCell: number;
  error?: string;
};

type Props = {
  locale: "en" | "es";
  selection: MapSelection | null;
  detailResolution: number;
  detailSmooth: number;
  mapZoom: number;
  activeProfileId: TerrainProfileId;
  selectedForCompare: TerrainProfileId[];
  results: CompareRunResult[];
  running: boolean;
  progressLabel: string | null;
  onToggleCompareProfile: (id: TerrainProfileId) => void;
  onRunCompare: () => void;
  onCancel: () => void;
  onChoose: (id: TerrainProfileId) => void;
  labels: {
    title: string;
    lead: string;
    run: string;
    running: string;
    cancel: string;
    choose: string;
    active: string;
    pickAtLeast: string;
    emptyPreview: string;
    controlsHint: string;
    plan: string;
    triangles: string;
    time: string;
  };
};

export function TerrainAlgoLab({
  locale,
  selection,
  detailResolution,
  detailSmooth,
  mapZoom,
  activeProfileId,
  selectedForCompare,
  results,
  running,
  progressLabel,
  onToggleCompareProfile,
  onRunCompare,
  onCancel,
  onChoose,
  labels,
}: Props) {
  return (
    <div className="space-y-3 border-t border-line pt-4">
      <div>
        <p className="text-sm font-bold tracking-wide text-ink">{labels.title}</p>
        <p className="mt-1 text-xs text-ink-muted">{labels.lead}</p>
      </div>

      <div className="space-y-2">
        {TERRAIN_PROFILES.map((profile) => {
          const sample = profile.buildSample({
            detailResolution,
            detailSmooth,
            mapZoom,
          });
          const plan = selection
            ? previewSamplePlan(selection, sample)
            : null;
          const checked = selectedForCompare.includes(profile.id);
          const isActive = activeProfileId === profile.id;
          return (
            <label
              key={profile.id}
              className={`flex cursor-pointer gap-2 border px-2.5 py-2 text-xs transition ${
                isActive
                  ? "border-green bg-green/5"
                  : "border-line hover:border-ink-muted"
              }`}
            >
              <input
                type="checkbox"
                className="mt-0.5"
                checked={checked}
                disabled={running}
                onChange={() => onToggleCompareProfile(profile.id)}
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5 font-bold text-ink">
                  {profile.label[locale]}
                  {isActive ? (
                    <span className="bg-green px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      {labels.active}
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block text-ink-muted">
                  {profile.blurb[locale]}
                </span>
                <span className="mt-0.5 block text-[11px] text-ink-muted">
                  {profile.bestFor[locale]}
                  {plan
                    ? ` · ${plan.cols}×${plan.rows} · ${formatMetersPerCell(plan.metersPerCell, locale)} · z${plan.zoom} · smooth ${plan.terrainSmooth}`
                    : ""}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {running ? (
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer border border-line px-3 py-1.5 text-xs font-bold text-ink-muted hover:text-ink"
          >
            {labels.cancel}
          </button>
        ) : (
          <button
            type="button"
            onClick={onRunCompare}
            disabled={!selection || selectedForCompare.length < 2}
            className="cursor-pointer bg-ink px-3 py-1.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {labels.run}
          </button>
        )}
        {progressLabel ? (
          <span className="self-center text-xs text-ink-muted">
            {progressLabel}
          </span>
        ) : null}
      </div>
      {!selection || selectedForCompare.length < 2 ? (
        <p className="text-[11px] text-ink-muted">{labels.pickAtLeast}</p>
      ) : null}

      {results.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {results.map((result) => {
            const profile = getTerrainProfile(result.profileId);
            const isActive = activeProfileId === result.profileId;
            return (
              <div
                key={result.profileId}
                className={`border ${isActive ? "border-green" : "border-line"}`}
              >
                <div className="flex items-start justify-between gap-2 border-b border-line px-2.5 py-2">
                  <div>
                    <p className="text-xs font-bold text-ink">
                      {profile.label[locale]}
                    </p>
                    {result.error ? (
                      <p className="mt-0.5 text-[11px] text-red-700">
                        {result.error}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-[11px] text-ink-muted">
                        {result.cols}×{result.rows} ·{" "}
                        {formatMetersPerCell(result.metersPerCell, locale)} ·{" "}
                        {labels.triangles} {result.triangles.toLocaleString()} ·{" "}
                        {labels.time} {(result.timings.totalMs / 1000).toFixed(1)}
                        s
                      </p>
                    )}
                  </div>
                  {!result.error ? (
                    <button
                      type="button"
                      onClick={() => onChoose(result.profileId)}
                      className={`shrink-0 cursor-pointer px-2 py-1 text-[11px] font-bold ${
                        isActive
                          ? "bg-green text-white"
                          : "border border-line text-ink hover:bg-ink hover:text-white"
                      }`}
                    >
                      {isActive ? labels.active : labels.choose}
                    </button>
                  ) : null}
                </div>
                <div className="h-44 bg-[#f4fbf8]">
                  {result.buffer.byteLength > 0 ? (
                    <StlPreview
                      buffer={result.buffer}
                      emptyLabel={labels.emptyPreview}
                      controlsHint={labels.controlsHint}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center px-3 text-center text-xs text-ink-muted">
                      {result.error ?? labels.emptyPreview}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
