import { memo, useEffect, useMemo, useRef } from "react";
import type { GeoJsonCollection } from "../hooks/useGeoJsonFromZip";
import type { MapTheme } from "../App";
import { useMap } from "react-leaflet/hooks";
import { extractPointSamples } from "../utilities/extractPointSamples";
import L from "leaflet";
import type {
  SurfaceWorkerInput,
  SurfaceWorkerOutput,
} from "../utilities/surfaceWorker";
import SurfaceWorker from "../utilities/surfaceWorker?worker";

interface SurfaceConfig {
  power?: number;
  fadeKm?: number;
}

interface RenderingConfig {
  sampleStepPx: number;
  blurPx: number;
  opacity: number;
  blendMode: string;
}

interface Props {
  data: GeoJsonCollection | null;
  surface?: SurfaceConfig;
  rendering: RenderingConfig;
  theme: MapTheme;
}

export const InterpolatedSurfaceLayer = memo(function InterpolatedSurfaceLayer({
  data,
  surface = {},
  rendering,
  theme,
}: Props) {
  const { fadeKm = 22, power = 6 } = surface;
  const map = useMap();

  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const bufferRef = useRef<HTMLCanvasElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const jobIdRef = useRef(0);
  const themeRef = useRef(theme);
  const scheduleRef = useRef<(() => void) | null>(null);
  const rafRef = useRef<number | null>(null);

  const points = useMemo(() => extractPointSamples(data), [data]);

  useEffect(() => {
    themeRef.current = theme;
    if (scheduleRef.current) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        scheduleRef.current?.();
        rafRef.current = null;
      });
    }
  }, [theme]);

  useEffect(() => {
    if (points.length === 0) {
      overlayRef.current?.remove();
      overlayRef.current = null;
      scheduleRef.current = null;
      workerRef.current?.terminate();
      workerRef.current = null;
      return;
    }

    if (!overlayRef.current) {
      const canvas = document.createElement("canvas");
      canvas.style.cssText =
        "position:absolute;pointer-events:none;z-index:450;";
      canvas.className = "leaflet-zoom-hide";
      overlayRef.current = canvas;
      (map.getPane("overlayPane") || map.getContainer()).appendChild(canvas);
    }

    if (!bufferRef.current) {
      bufferRef.current = document.createElement("canvas");
    }

    if (!workerRef.current) {
      workerRef.current = new SurfaceWorker();
    }

    const overlay = overlayRef.current;
    const overlayCtx = overlay.getContext("2d")!;
    const buffer = bufferRef.current;
    const bufferCtx = buffer.getContext("2d")!;
    const worker = workerRef.current;

    const scheduleDraw = () => {
      const size = map.getSize();
      const dpr = window.devicePixelRatio || 1;
      const origin = map.containerPointToLayerPoint([0, 0]);
      const bounds = map.getBounds();
      const nw = bounds.getNorthWest();
      const se = bounds.getSouthEast();

      L.DomUtil.setPosition(overlay, origin);
      overlay.style.width = `${size.x}px`;
      overlay.style.height = `${size.y}px`;
      overlay.width = Math.floor(size.x * dpr);
      overlay.height = Math.floor(size.y * dpr);
      overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      overlay.style.opacity = String(rendering.opacity);
      overlay.style.mixBlendMode = rendering.blendMode;

      const cols = Math.ceil(size.x / rendering.sampleStepPx);
      const rows = Math.ceil(size.y / rendering.sampleStepPx);

      const jobId = ++jobIdRef.current;

      const input: SurfaceWorkerInput = {
        cols,
        rows,
        sampleStepPx: rendering.sampleStepPx,
        nwLat: nw.lat,
        nwLng: nw.lng,
        seLat: se.lat,
        seLng: se.lng,
        viewportX: size.x,
        viewportY: size.y,
        points,
        power,
        fadeKm,
        theme: themeRef.current,
        jobId,
      };

      worker.postMessage(input);
    };

    worker.onmessage = ({
      data: result,
    }: MessageEvent<SurfaceWorkerOutput>) => {
      if (result.jobId !== jobIdRef.current) return;

      const { buffer: buf, cols, rows } = result;
      const imageData = new ImageData(
        new Uint8ClampedArray(buf as ArrayBuffer),
        cols,
        rows,
      );

      const size = map.getSize();
      const dpr = window.devicePixelRatio || 1;
      const origin = map.containerPointToLayerPoint([0, 0]);

      L.DomUtil.setTransform(overlay, origin, 1);
      overlay.style.width = `${size.x}px`;
      overlay.style.height = `${size.y}px`;
      overlay.width = Math.floor(size.x * dpr);
      overlay.height = Math.floor(size.y * dpr);
      overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

      buffer.width = cols;
      buffer.height = rows;
      bufferCtx.putImageData(imageData, 0, 0);

      overlayCtx.clearRect(0, 0, size.x, size.y);
      overlayCtx.imageSmoothingEnabled = true;
      overlayCtx.filter = `blur(${rendering.blurPx}px)`;
      overlayCtx.drawImage(buffer, 0, 0, cols, rows, 0, 0, size.x, size.y);
    };

    scheduleRef.current = scheduleDraw;
    scheduleDraw();
    map.on("moveend zoomend resize", scheduleDraw);

    const onZoomAnim = (e: L.ZoomAnimEvent) => {
      if (!overlayRef.current) return;
      const scale = map.getZoomScale(e.zoom, map.getZoom());
      const origin = map.latLngToLayerPoint(e.center);
      const offset = origin
        .multiplyBy(-scale)
        .add(map.latLngToLayerPoint(map.getBounds().getNorthWest()));
      L.DomUtil.setTransform(overlayRef.current, offset, scale);
    };

    map.on("zoomanim", onZoomAnim as L.LeafletEventHandlerFn);

    return () => {
      map.off("moveend zoomend resize", scheduleDraw);
      map.off("zoomanim", onZoomAnim as L.LeafletEventHandlerFn);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      workerRef.current?.terminate();
      workerRef.current = null;
      overlayRef.current?.remove();
      overlayRef.current = null;
      scheduleRef.current = null;
    };
  }, [map, points, rendering, power, fadeKm]);

  return null;
});
