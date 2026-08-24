import { SampleAbortedError } from "@/lib/map-stl";
import { runTerrainPipeline, type TerrainPipelineOptions } from "@/lib/terrain-pipeline";

export type TerrainWorkerRequest = {
  id: number;
  type: "generate";
  options: TerrainPipelineOptions;
};

export type TerrainWorkerProgress = {
  id: number;
  type: "progress";
  done: number;
  total: number;
  phase?: string;
};

export type TerrainWorkerComplete = {
  id: number;
  type: "complete";
  grid: {
    cols: number;
    rows: number;
    values: Float32Array;
    min: number;
    max: number;
    widthM: number;
    depthM: number;
    bounds: { south: number; west: number; north: number; east: number };
    selection: TerrainPipelineOptions["selection"];
    selectionMask: Uint8Array;
  };
  buffer: ArrayBuffer;
  timings: {
    prefetchMs: number;
    maskMs: number;
    sampleMs: number;
    smoothMs: number;
    meshMs: number;
    totalMs: number;
  };
};

export type TerrainWorkerError = {
  id: number;
  type: "error";
  message: string;
  aborted?: boolean;
};

export type TerrainWorkerCancel = {
  id: number;
  type: "cancel";
};

let activeId: number | null = null;
let activeAbort: AbortController | null = null;

self.onmessage = (event: MessageEvent<TerrainWorkerRequest | TerrainWorkerCancel>) => {
  const msg = event.data;
  if (msg.type === "cancel") {
    if (activeId === msg.id) activeAbort?.abort();
    return;
  }
  if (msg.type !== "generate") return;

  activeId = msg.id;
  activeAbort?.abort();
  const controller = new AbortController();
  activeAbort = controller;
  const { id, options } = msg;

  void (async () => {
    try {
      const result = await runTerrainPipeline({
        ...options,
        sample: {
          ...options.sample,
          signal: controller.signal,
          onProgress: (done, total) => {
            if (controller.signal.aborted && activeId === id) return;
            self.postMessage({
              id,
              type: "progress",
              done,
              total,
            } satisfies TerrainWorkerProgress);
          },
          onPhase: (phase, ms) => {
            if (controller.signal.aborted && activeId === id) return;
            self.postMessage({
              id,
              type: "progress",
              done: 0,
              total: 1,
              phase: `${phase}:${Math.round(ms)}ms`,
            } satisfies TerrainWorkerProgress);
          },
        },
      });

      if (controller.signal.aborted && activeId === id) {
        self.postMessage({
          id,
          type: "error",
          message: "cancelled",
          aborted: true,
        } satisfies TerrainWorkerError);
        return;
      }

      self.postMessage(
        {
          id,
          type: "complete",
          grid: result.grid,
          buffer: result.buffer,
          timings: result.timings,
        } satisfies TerrainWorkerComplete,
        { transfer: [result.buffer] },
      );
    } catch (err) {
      const aborted =
        controller.signal.aborted ||
        err instanceof SampleAbortedError ||
        (err instanceof DOMException && err.name === "AbortError");
      self.postMessage({
        id,
        type: "error",
        message: aborted ? "cancelled" : String(err),
        aborted,
      } satisfies TerrainWorkerError);
    } finally {
      if (activeId === id) {
        activeId = null;
        if (activeAbort === controller) activeAbort = null;
      }
    }
  })();
};
