import type { MapTheme } from "../App";
import type { ColorRgb } from "./hexToRgb";

export function computePointColor(value: number, theme: MapTheme): ColorRgb {
  // keep values in-bounds [-1,1]
  const normalizedValue = Math.max(-1, Math.min(1, value));
  
  // Where point colors being assigned to extremes of the gradient????
  // Was this setup for the interpolation???? Is it correct??????
  // if (normalizedValue < 0) return theme.min;
  // if (normalizedValue > 0) return theme.max;
  // return { r: 0, g: 0, b: 0 };

  // Convert from [-1, 1] range to [0, 1] range for interpolation
  const t = (normalizedValue + 1) / 2;
  
  //Interpolate
  return {
    r: Math.round(theme.min.r + (theme.max.r - theme.min.r) * t),
    g: Math.round(theme.min.g + (theme.max.g - theme.min.g) * t),
    b: Math.round(theme.min.b + (theme.max.b - theme.min.b) * t),
  };
}
