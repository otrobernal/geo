/**
 * Represents the geographic coordinates xi = (lat, lng).
 */
export interface Point {
  lat: number;
  lng: number;
}

/**
 * Represents a data point (tuple) [(xi, ui)].
 * This combines the Point (xi) with its associated value (ui).
 */
export interface PointValue {
  xi: Point;
  ui: number;
}

/**
 * Result of the IDW interpolation for a single point x.
 */
interface IdwResult {
  value: number; // Estimated value u(x)
  distance: number; // Distance d(x, xi) to the closest sample
}

/**
 * Interpolates a value at point x using Inverse Distance Weighting.
 * Equation: u(x) = Σ (wi(x) * ui) / Σ wi(x)
 * Where: wi(x) = 1 / d(x, xi)^p
 */
export function interpolateIdw(
  x: Point,
  points: PointValue[],
  power: number,
): IdwResult {
  let numerator = 0; // Σ (wi(x) * ui)
  let denominator = 0; // Σ wi(x)
  let minDistance = Infinity;

  for (let i = 0; i < points.length; i++) {
    const { xi, ui } = points[i];

    // Calculate distance d(x, xi) between the two points
    const distance = distanceBetweenTwoPoints(x, xi);

    if (distance < minDistance) minDistance = distance;

    // If d(x, xi) = 0 for some i, then u(x) = ui
    if (distance < 1e-6) {
      return { value: ui, distance: 0 };
    }

    // Calculate weight wi(x) = 1 / d(x, xi)^p
    const w_i = 1 / Math.pow(distance, power);

    numerator += w_i * ui;
    denominator += w_i;
  }

  if (!denominator) return { value: 0, distance: minDistance };

  const value = Math.max(-1, Math.min(1, numerator / denominator));

  return { value, distance: minDistance };
}

/**
 * The final distance in kilometers.
 */
function distanceBetweenTwoPoints(p1: Point, p2: Point): number {
  const earthRadiusKm = 6371;
  const degreesToRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const lat1InRadians = degreesToRadians(p1.lat);
  const lat2InRadians = degreesToRadians(p2.lat);

  const differenceInLat = degreesToRadians(p2.lat - p1.lat);
  const differenceInLng = degreesToRadians(p2.lng - p1.lng);

  const distance =
    Math.sin(differenceInLat / 2) * Math.sin(differenceInLat / 2) +
    Math.cos(lat1InRadians) *
      Math.cos(lat2InRadians) *
      Math.sin(differenceInLng / 2) *
      Math.sin(differenceInLng / 2);

  const angle = 2 * Math.atan2(Math.sqrt(distance), Math.sqrt(1 - distance));

  return earthRadiusKm * angle;
}
