import type { GeoJsonCollection } from "../hooks/useGeoJsonFromZip";
import type { PointValue } from "./interpolateIdw";

export function extractPointSamples(
  geoJson: GeoJsonCollection | null,
): PointValue[] {
  if (!geoJson) return [];
  const samples: PointValue[] = [];
  for (const feature of geoJson.features) {
    if (!feature.geometry || feature.geometry.type !== "Point") continue;
    const [lng, lat] = feature.geometry.coordinates as number[];
    const value = Number(feature.properties?.value ?? 0);
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Number.isFinite(value)
    ) {
      samples.push({
        xi: { lat, lng },
        ui: Math.max(-1, Math.min(1, value)),
      });
    }
  }
  return samples;
}
