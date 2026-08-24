import {
  heightGridToStl,
  sampleElevationGrid,
  type HeightGrid,
  type MapSelection,
  type SampleOptions,
  type StlOptions,
  type TerrainPhase,
  type TerrainTimings,
} from "@/lib/map-stl";

export type TerrainPipelineResult = {
  grid: HeightGrid;
  buffer: ArrayBuffer;
  timings: TerrainTimings;
};

export type TerrainPipelineOptions = {
  selection: MapSelection;
  sample: SampleOptions;
  stl: StlOptions;
};

/** Sample elevation + build STL with per-phase timings. */
export async function runTerrainPipeline(
  options: TerrainPipelineOptions,
): Promise<TerrainPipelineResult> {
  const t0 = performance.now();
  const phaseMs: Partial<Record<TerrainPhase, number>> = {};

  const grid = await sampleElevationGrid(options.selection, {
    ...options.sample,
    onPhase: (phase, ms) => {
      phaseMs[phase] = ms;
      options.sample.onPhase?.(phase, ms);
    },
  });

  const tMesh = performance.now();
  const buffer = heightGridToStl(grid, options.stl);
  const meshMs = performance.now() - tMesh;
  phaseMs.mesh = meshMs;

  const timings: TerrainTimings = {
    prefetchMs: phaseMs.prefetch ?? 0,
    maskMs: phaseMs.mask ?? 0,
    sampleMs: phaseMs.sample ?? 0,
    smoothMs: phaseMs.smooth ?? 0,
    meshMs,
    totalMs: performance.now() - t0,
  };

  return { grid, buffer, timings };
}
