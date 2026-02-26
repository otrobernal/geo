interface IdwResult {
  value: number;
  nearestKm: number;
  ok: boolean;
}

export interface VineyardSample {
  lat: number;
  lng: number;
  value: number;
}

export function interpolateIdwAt(
  queryLat: number,
  queryLng: number,
  samples: VineyardSample[],
  power: number,
): IdwResult {
  let weightedSum = 0;
  let weightSum = 0;
  let nearestKm = Infinity;

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const d = greatCircleDistanceKm(queryLat, queryLng, s.lat, s.lng);
    if (d < nearestKm) nearestKm = d;

    if (d < 1e-6) {
      return { value: s.value, nearestKm: 0, ok: true };
    }

    const w = 1 / Math.pow(d, power);
    weightedSum += w * s.value;
    weightSum += w;
  }

  if (!weightSum) return { value: 0, nearestKm, ok: false };
  const value = Math.max(-1, Math.min(1, weightedSum / weightSum));
  return { value, nearestKm, ok: true };
}

function greatCircleDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
