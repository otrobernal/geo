import { renderSurface, type RenderSurfaceParams } from "./renderSurface";

export interface SurfaceWorkerInput extends RenderSurfaceParams {
  jobId: number;
}

export interface SurfaceWorkerOutput {
  buffer: ArrayBufferLike;
  cols: number;
  rows: number;
  jobId: number;
}

const workerPost = (
  self as unknown as {
    postMessage: (msg: SurfaceWorkerOutput, transfer: Transferable[]) => void;
  }
).postMessage.bind(self);

addEventListener("message", ({ data }: MessageEvent<SurfaceWorkerInput>) => {
  const { jobId, ...params } = data;
  const pixels = renderSurface(params);

  const output: SurfaceWorkerOutput = {
    buffer: pixels.buffer,
    cols: params.cols,
    rows: params.rows,
    jobId,
  };

  workerPost(output, [pixels.buffer]);
});
