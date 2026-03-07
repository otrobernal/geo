import { memo, useEffect, useMemo, useRef } from "react";
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
  const themeRef = useRef(theme);
  const rafRef = useRef<number | null>(null);
  const drawRef = useRef<(() => void) | null>(null);

  const points = useMemo(() => extractPointSamples(data), [data]);

  useEffect(() => {
    themeRef.current = theme;

    if (drawRef.current) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        drawRef.current?.();
        rafRef.current = null;
      });
    }
  }, [theme]);

  useEffect(() => {
    if (points.length === 0) {
      overlayRef.current?.remove();
      overlayRef.current = null;
      drawRef.current = null;
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

    const overlay = overlayRef.current;
    const overlayCtx = overlay.getContext("2d")!;
    const buffer = bufferRef.current;
    const bufferCtx = buffer.getContext("2d")!;

    const draw = () => {
      const size = map.getSize();
      const dpr = window.devicePixelRatio || 1;
      const origin = map.containerPointToLayerPoint([0, 0]);

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
      buffer.width = cols;
      buffer.height = rows;

      const imageData = bufferCtx.createImageData(cols, rows);
      const px = imageData.data;
      const currentTheme = themeRef.current;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const geo = map.containerPointToLatLng([
            col * rendering.sampleStepPx,
            row * rendering.sampleStepPx,
          ] as L.PointExpression);

          const result = interpolateIdw(
            { lat: geo.lat, lng: geo.lng } as Point,
            points as PointValue[],
            power,
          );

          if (result.distance === Infinity) continue;

          const fade = Math.exp(-result.distance / fadeKm);
          const amp = Math.pow(
            Math.max(0, (Math.abs(result.value) - 0.12) / 0.88),
            1.4,
          );
          const visibility = fade * amp;
          if (visibility < 0.004) continue;

          const color = computePointColor(result.value, currentTheme);
          const i = 4 * (row * cols + col);
          px[i] = color.r;
          px[i + 1] = color.g;
          px[i + 2] = color.b;
          px[i + 3] = Math.round(255 * visibility);
        }
      }

      bufferCtx.putImageData(imageData, 0, 0);
      overlayCtx.clearRect(0, 0, size.x, size.y);
      overlayCtx.imageSmoothingEnabled = true;
      overlayCtx.filter = `blur(${rendering.blurPx}px)`;
      overlayCtx.drawImage(buffer, 0, 0, cols, rows, 0, 0, size.x, size.y);
    };

    drawRef.current = draw;
    draw();
    map.on("moveend zoomend resize", draw);

    return () => {
      map.off("moveend zoomend resize", draw);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      overlayRef.current?.remove();
      overlayRef.current = null;
      drawRef.current = null;
    };
  }, [map, points, rendering, power, fadeKm]);

  return null;
});
