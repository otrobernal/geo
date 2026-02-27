import { useEffect, useMemo, useRef } from "react";
import type { GeoJsonCollection } from "../hooks/useGeoJsonFromZip";
import type { MapTheme } from "../App";
import { useMap } from "react-leaflet/hooks";
import { extractPointSamples } from "../utilities/extractPointSamples";
import L from "leaflet";
import {
  interpolateIdw,
  type Point,
  type PointValue,
} from "../utilities/interpolateIdw";
import { computePointColor } from "../utilities/computePointColor";

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

export function InterpolatedSurfaceLayer({
  data,
  surface = {},
  rendering,
  theme,
}: {
  data: GeoJsonCollection | null;
  surface?: SurfaceConfig;
  rendering: RenderingConfig;
  theme: MapTheme;
}) {
  const { fadeKm = 22, power = 6 } = surface;
  const map = useMap();
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const internalCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const points = useMemo(() => extractPointSamples(data), [data]);

  useEffect(() => {
    if (points.length === 0) {
      overlayCanvasRef.current?.remove();
      overlayCanvasRef.current = null;
      return;
    }

    if (!overlayCanvasRef.current) {
      const canvas = document.createElement("canvas");
      canvas.style.position = "absolute";
      canvas.style.pointerEvents = "none";
      canvas.style.zIndex = "450";
      canvas.className = "leaflet-zoom-hide";
      overlayCanvasRef.current = canvas;
      (map.getPane("overlayPane") || map.getContainer()).appendChild(canvas);
    }

    if (!internalCanvasRef.current) {
      internalCanvasRef.current = document.createElement("canvas");
    }

    const overlay = overlayCanvasRef.current!;
    const overlayContext = overlay.getContext("2d")!;
    const buffer = internalCanvasRef.current!;
    const bufferContext = buffer.getContext("2d")!;

    const syncCanvasSize = () => {
      const size = map.getSize();
      const dpr = window.devicePixelRatio || 1;
      const origin = map.containerPointToLayerPoint([0, 0]);

      L.DomUtil.setPosition(overlay, origin);
      overlay.style.width = `${size.x}px`;
      overlay.style.height = `${size.y}px`;
      overlay.width = Math.floor(size.x * dpr);
      overlay.height = Math.floor(size.y * dpr);
      overlayContext.setTransform(dpr, 0, 0, dpr, 0, 0);

      overlay.style.opacity = String(rendering.opacity);
      overlay.style.mixBlendMode = rendering.blendMode;
    };

    const drawInterpolation = () => {
      syncCanvasSize();
      const viewport = map.getSize();
      const columns = Math.ceil(viewport.x / rendering.sampleStepPx);
      const rows = Math.ceil(viewport.y / rendering.sampleStepPx);

      buffer.width = columns;
      buffer.height = rows;

      const imageData = bufferContext.createImageData(columns, rows);
      const pixels = imageData.data;

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < columns; x++) {
          const screenLocation = [
            x * rendering.sampleStepPx,
            y * rendering.sampleStepPx,
          ];
          const geographicPoint = map.containerPointToLatLng(
            screenLocation as L.PointExpression,
          );

          const result = interpolateIdw(
            { lat: geographicPoint.lat, lng: geographicPoint.lng } as Point,
            points as PointValue[],
            power,
          );

          if (result.distance === Infinity) continue;

          const distanceFade = Math.exp(-result.distance / fadeKm);
          const weightAmplitude = Math.pow(
            Math.max(0, (Math.abs(result.value) - 0.12) / 0.88),
            1.4,
          );
          const visibility = distanceFade * weightAmplitude;

          if (visibility < 0.004) continue;

          const color = computePointColor(result.value, theme);
          const index = 4 * (y * columns + x);

          pixels[index + 0] = color.r;
          pixels[index + 1] = color.g;
          pixels[index + 2] = color.b;
          pixels[index + 3] = Math.round(255 * visibility);
        }
      }

      bufferContext.putImageData(imageData, 0, 0);
      overlayContext.clearRect(0, 0, viewport.x, viewport.y);
      overlayContext.imageSmoothingEnabled = true;
      overlayContext.filter = `blur(${rendering.blurPx}px)`;
      overlayContext.drawImage(
        buffer,
        0,
        0,
        columns,
        rows,
        0,
        0,
        viewport.x,
        viewport.y,
      );
    };

    drawInterpolation();
    map.on("moveend zoomend resize", drawInterpolation);

    return () => {
      map.off("moveend zoomend resize", drawInterpolation);
      overlayCanvasRef.current?.remove();
      overlayCanvasRef.current = null;
    };
  }, [map, points, surface, rendering, theme, power, fadeKm]);

  return null;
}
