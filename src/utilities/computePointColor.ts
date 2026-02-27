import type { MapTheme } from "../App";
import type { ColorRgb } from "./hexToRgb";

export function computePointColor(value: number, theme: MapTheme): ColorRgb {
  const normalizedValue = Math.max(-1, Math.min(1, value));
  if (normalizedValue < 0) return theme.min;
  if (normalizedValue > 0) return theme.max;
  return { r: 0, g: 0, b: 0 };
}
