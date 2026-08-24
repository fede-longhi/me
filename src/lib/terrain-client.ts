import type {
  HeightGrid,
  MapSelection,
  SampleOptions,
  StlOptions,
  TerrainTimings,
} from "@/lib/map-stl";
import type { TerrainPipelineOptions } from "@/lib/terrain-pipeline";
import type {
  TerrainWorkerCancel,
  TerrainWorkerComplete,
  TerrainWorkerError,
  TerrainWorkerProgress,
  TerrainWorkerRequest,
} from "@/lib/terrain.worker";

export type TerrainGenerateResult = {
  grid: HeightGrid;
  buffer: ArrayBuffer;
  timings: TerrainTimings;
};

let worker: Worker | null = null;
let jobId = 0;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./terrain.worker.ts", import.meta.url));
  }
  return worker;
}

export function cancelTerrainJob(id: number) {
  if (!worker) return;
  worker.postMessage({ id, type: "cancel" } satisfies TerrainWorkerCancel);
}

export function terminateTerrainWorker() {
  worker?.terminate();
  worker = null;
}

export function generateTerrain(
  options: TerrainPipelineOptions,
  onProgress?: (done: number, total: number, phase?: string) => void,
): { id: number; promise: Promise<TerrainGenerateResult> } {
  const id = ++jobId;
  const w = getWorker();

  const promise = new Promise<TerrainGenerateResult>((resolve, reject) => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as
        | TerrainWorkerProgress
        | TerrainWorkerComplete
        | TerrainWorkerError;
      if (data.id !== id) return;

      if (data.type === "progress") {
        onProgress?.(data.done, data.total, data.phase);
        return;
      }

      w.removeEventListener("message", onMessage);

      if (data.type === "complete") {
        resolve({
          grid: data.grid as HeightGrid,
          buffer: data.buffer,
          timings: data.timings,
        });
        return;
      }

      if (data.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      reject(new Error(data.message));
    };

    w.addEventListener("message", onMessage);
    w.postMessage({
      id,
      type: "generate",
      options,
    } satisfies TerrainWorkerRequest);
  });

  return { id, promise };
}
