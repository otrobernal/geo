import { interpolateIdw, type Point, type PointValue } from "./interpolateIdw";
import { computePointColor } from "./computePointColor";
import type { MapTheme } from "../App";

const VISIBILITY_FLOOR = 0.004;
const VALUE_THRESHOLD = 0.12;
const VALUE_RANGE = 0.88;
const AMP_EXPONENT = 1.4;

export interface RenderSurfaceParams {
  cols: number;
  rows: number;
  sampleStepPx: number;
  nwLat: number;
  nwLng: number;
  seLat: number;
  seLng: number;
  viewportX: number;
  viewportY: number;
  points: PointValue[];
  power: number;
  fadeKm: number;
  theme: MapTheme;
}

export function renderSurface(params: RenderSurfaceParams): Uint8ClampedArray {
  const {
    cols,
    rows,
    sampleStepPx,
    nwLat,
    nwLng,
    seLat,
    seLng,
    viewportX,
    viewportY,
    points,
    power,
    fadeKm,
    theme,
  } = params;

  const latRange = seLat - nwLat;
  const lngRange = seLng - nwLng;
  const pixels = new Uint8ClampedArray(cols * rows * 4);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const lat = nwLat + ((row * sampleStepPx) / viewportY) * latRange;
      const lng = nwLng + ((col * sampleStepPx) / viewportX) * lngRange;

      const result = interpolateIdw(
        { lat, lng } as Point,
        points as PointValue[],
        power,
      );
      if (result.distance === Infinity) continue;

      const fade = Math.exp(-result.distance / fadeKm);
      const amp = Math.pow(
        Math.max(0, (Math.abs(result.value) - VALUE_THRESHOLD) / VALUE_RANGE),
        AMP_EXPONENT,
      );
      const visibility = fade * amp;
      if (visibility < VISIBILITY_FLOOR) continue;

      const color = computePointColor(result.value, theme);
      const i = 4 * (row * cols + col);
      pixels[i] = color.r;
      pixels[i + 1] = color.g;
      pixels[i + 2] = color.b;
      pixels[i + 3] = Math.round(255 * visibility);
    }
  }

  return pixels;
}
