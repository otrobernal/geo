/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  GeoJSON as LeafletGeoJSON,
  MapContainer,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import JSZip from "jszip";
import * as turf from "@turf/turf";
import "leaflet/dist/leaflet.css";
import {
  interpolateIdwAt,
  type VineyardSample,
} from "./utilities/interpolateIdwAt";
import { findGeoJsonFileInZip } from "./utilities/findGeoJsonFileInZip";

type GeoJsonCollection = GeoJSON.FeatureCollection<GeoJSON.Geometry, any>;

interface ZipGeoJsonLoadResult {
  region: GeoJsonCollection | null;
  regionMask: GeoJsonCollection | null;
  vineyards: GeoJsonCollection | null;
}

interface IdwSurfaceOptions {
  power: number;
  fadeKm: number;
}

interface RasterRenderOptions {
  sampleStepPx: number;
  blurPx: number;
  opacity: number;
  blendMode: CanvasRenderingContext2D["globalCompositeOperation"] | string;
}

interface ColorRgb {
  r: number;
  g: number;
  b: number;
}

function valueToDivergingRgb(value: number): ColorRgb {
  const v = Math.max(-1, Math.min(1, value));
  if (v < 0) return { r: 255, g: 0, b: 0 };
  if (v > 0) return { r: 0, g: 255, b: 0 };
  return { r: 0, g: 0, b: 0 };
}

function valueToCssRgb(value: number): string {
  const { r, g, b } = valueToDivergingRgb(value);
  return `rgb(${r}, ${g}, ${b})`;
}

function extractVineyardSamples(
  vineyards: GeoJsonCollection | null,
): VineyardSample[] {
  if (!vineyards) return [];
  const samples: VineyardSample[] = [];
  for (const feature of vineyards.features) {
    if (!feature.geometry || feature.geometry.type !== "Point") continue;
    const [lng, lat] = feature.geometry.coordinates as number[];
    const value = Number(feature.properties?.value ?? 0);
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Number.isFinite(value)
    ) {
      samples.push({ lat, lng, value: Math.max(-1, Math.min(1, value)) });
    }
  }
  return samples;
}

function buildClipPath(
  map: L.Map,
  geometry: GeoJSON.Geometry,
  out: Path2D,
): void {
  const addRing = (ring: number[][]) => {
    if (!ring.length) return;
    const first = map.latLngToContainerPoint([ring[0][1], ring[0][0]]);
    out.moveTo(first.x, first.y);
    for (let i = 1; i < ring.length; i++) {
      const p = map.latLngToContainerPoint([ring[i][1], ring[i][0]]);
      out.lineTo(p.x, p.y);
    }
    out.closePath();
  };

  if (geometry.type === "Polygon") {
    for (const ring of geometry.coordinates as number[][][]) addRing(ring);
    return;
  }

  if (geometry.type === "MultiPolygon") {
    for (const poly of geometry.coordinates as number[][][][]) {
      for (const ring of poly) addRing(ring);
    }
    return;
  }

  if (geometry.type === "GeometryCollection") {
    for (const g of geometry.geometries) buildClipPath(map, g, out);
  }
}

function buildClipPathFromFeatureCollection(
  map: L.Map,
  fc: GeoJsonCollection | null,
): Path2D | null {
  if (!fc?.features?.length) return null;
  const path = new Path2D();
  let hasAny = false;
  for (const feature of fc.features) {
    if (!feature.geometry) continue;
    buildClipPath(map, feature.geometry, path);
    hasAny = true;
  }
  return hasAny ? path : null;
}

function useWineGeoJsonFromZip(
  zipUrl: string,
  maskBufferKm: number,
): ZipGeoJsonLoadResult {
  const [region, setRegion] = useState<GeoJsonCollection | null>(null);
  const [regionMask, setRegionMask] = useState<GeoJsonCollection | null>(null);
  const [vineyards, setVineyards] = useState<GeoJsonCollection | null>(null);

  useEffect(() => {
    const load = async () => {
      const response = await fetch(zipUrl);
      const zip = await JSZip.loadAsync(await response.arrayBuffer());

      const regionFile = findGeoJsonFileInZip(zip, "gsmap");
      const vineyardsFile = findGeoJsonFileInZip(zip, "vineyards");

      if (!regionFile) throw new Error("gsmap.geojson not found in zip");
      if (!vineyardsFile) throw new Error("vineyards.geojson not found in zip");

      const regionJson = JSON.parse(
        await regionFile.async("string"),
      ) as GeoJsonCollection;
      const vineyardsJson = JSON.parse(
        await vineyardsFile.async("string"),
      ) as GeoJsonCollection;

      setRegion(regionJson);
      setVineyards(vineyardsJson);

      const bufferedMask = turf.buffer(regionJson as any, maskBufferKm, {
        units: "kilometers",
      }) as any as GeoJsonCollection;

      setRegionMask(bufferedMask);
    };

    load().catch(console.error);
  }, [zipUrl, maskBufferKm]);

  return { region, regionMask, vineyards };
}

function FitMapToGeoJson({ data }: { data: GeoJsonCollection | null }) {
  const map = useMap();

  useEffect(() => {
    if (!data) return;
    try {
      const layer = L.geoJSON(data as any);
      const bounds = layer.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds.pad(0.06));
    } catch (error: unknown) {
      console.log(error);
    }
  }, [map, data]);

  return null;
}

function WineRegionBoundary({
  region,
  style,
}: {
  region: GeoJsonCollection | null;
  style: L.PathOptions;
}) {
  if (!region) return null;
  return <LeafletGeoJSON data={region as any} style={style} />;
}

function VineyardAnchors({
  vineyards,
}: {
  vineyards: GeoJsonCollection | null;
}) {
  if (!vineyards) return null;

  return (
    <LeafletGeoJSON
      data={vineyards as any}
      pointToLayer={(feature: any, latlng) => {
        const value = Number(feature.properties?.value ?? 0);
        const marker = L.circleMarker(latlng, {
          radius: 6,
          fillColor: valueToCssRgb(value),
          color: "#fff",
          weight: 2,
          fillOpacity: 1,
        });

        marker.bindTooltip(
          `<strong>${feature.properties?.Variety ?? ""}</strong>`,
          {
            permanent: true,
            direction: "top",
            className: "glass-label",
          },
        );

        return marker;
      }}
    />
  );
}

function VineyardValueSurface({
  vineyards,
  clipBoundary,
  idw,
  raster,
}: {
  vineyards: GeoJsonCollection | null;
  clipBoundary: GeoJsonCollection | null;
  idw: IdwSurfaceOptions;
  raster: RasterRenderOptions;
}) {
  const map = useMap();
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rasterCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const samples = useMemo(() => extractVineyardSamples(vineyards), [vineyards]);

  useEffect(() => {
    if (!samples.length) return;

    if (!overlayCanvasRef.current) {
      const canvas = document.createElement("canvas");
      canvas.style.position = "absolute";
      canvas.style.pointerEvents = "none";
      canvas.style.zIndex = "450";
      canvas.style.opacity = String(raster.opacity);
      canvas.style.mixBlendMode = String(raster.blendMode);
      canvas.className = "leaflet-zoom-hide";
      overlayCanvasRef.current = canvas;
      (map.getPane("overlayPane") ?? map.getContainer()).appendChild(canvas);
    }

    if (!rasterCanvasRef.current) {
      rasterCanvasRef.current = document.createElement("canvas");
    }

    const overlayCanvas = overlayCanvasRef.current!;
    const overlayCtx = overlayCanvas.getContext("2d")!;
    const rasterCanvas = rasterCanvasRef.current!;
    const rasterCtx = rasterCanvas.getContext("2d")!;

    const applyDevicePixelRatioSizing = () => {
      const size = map.getSize();
      const dpr = window.devicePixelRatio || 1;
      const topLeft = map.containerPointToLayerPoint([0, 0]);
      L.DomUtil.setPosition(overlayCanvas, topLeft);

      overlayCanvas.style.width = `${size.x}px`;
      overlayCanvas.style.height = `${size.y}px`;
      overlayCanvas.width = Math.max(1, Math.floor(size.x * dpr));
      overlayCanvas.height = Math.max(1, Math.floor(size.y * dpr));
      overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

      overlayCanvas.style.opacity = String(raster.opacity);
      overlayCanvas.style.mixBlendMode = String(raster.blendMode);
    };

    let raf = 0;

    const renderSurface = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        applyDevicePixelRatioSizing();

        const viewport = map.getSize();
        const gridWidth = Math.max(
          1,
          Math.ceil(viewport.x / raster.sampleStepPx),
        );
        const gridHeight = Math.max(
          1,
          Math.ceil(viewport.y / raster.sampleStepPx),
        );

        rasterCanvas.width = gridWidth;
        rasterCanvas.height = gridHeight;

        const image = rasterCtx.createImageData(gridWidth, gridHeight);
        const pixels = image.data;

        for (let gy = 0; gy < gridHeight; gy++) {
          for (let gx = 0; gx < gridWidth; gx++) {
            const screenX = gx * raster.sampleStepPx;
            const screenY = gy * raster.sampleStepPx;

            const latLng = map.containerPointToLatLng([screenX, screenY]);
            const result = interpolateIdwAt(
              latLng.lat,
              latLng.lng,
              samples,
              idw.power,
            );
            if (!result.ok) continue;

            const fade = Math.exp(-result.nearestKm / idw.fadeKm);

            const zeroBand = 0.12;
            const absV = Math.abs(result.value);
            const normalized = Math.max(0, (absV - zeroBand) / (1 - zeroBand));
            const amplitude = Math.pow(normalized, 1.4);

            const alpha = fade * amplitude;
            if (alpha < 0.004) continue;

            const { r, g, b } = valueToDivergingRgb(result.value);
            const idx = 4 * (gy * gridWidth + gx);
            pixels[idx + 0] = r;
            pixels[idx + 1] = g;
            pixels[idx + 2] = b;
            pixels[idx + 3] = Math.max(
              0,
              Math.min(255, Math.round(255 * alpha)),
            );
          }
        }

        rasterCtx.putImageData(image, 0, 0);

        overlayCtx.clearRect(0, 0, viewport.x, viewport.y);
        overlayCtx.imageSmoothingEnabled = true;
        overlayCtx.filter = `blur(${raster.blurPx}px)`;
        overlayCtx.drawImage(
          rasterCanvas,
          0,
          0,
          gridWidth,
          gridHeight,
          0,
          0,
          viewport.x,
          viewport.y,
        );
        overlayCtx.filter = "none";

        const clipPath = buildClipPathFromFeatureCollection(map, clipBoundary);
        if (clipPath) {
          overlayCtx.save();
          overlayCtx.globalCompositeOperation = "destination-in";
          overlayCtx.fillStyle = "rgba(0,0,0,1)";
          overlayCtx.fill(clipPath, "evenodd");
          overlayCtx.restore();
        }
      });
    };

    renderSurface();
    map.on("moveend", renderSurface);
    map.on("zoomend", renderSurface);
    map.on("resize", renderSurface);

    return () => {
      map.off("moveend", renderSurface);
      map.off("zoomend", renderSurface);
      map.off("resize", renderSurface);
      cancelAnimationFrame(raf);

      if (overlayCanvasRef.current) {
        overlayCanvasRef.current.remove();
        overlayCanvasRef.current = null;
      }
    };
  }, [
    map,
    samples,
    clipBoundary,
    idw.power,
    idw.fadeKm,
    raster.sampleStepPx,
    raster.blurPx,
    raster.opacity,
    raster.blendMode,
  ]);

  return null;
}

export default function BalancedWineMap() {
  const { region, regionMask, vineyards } = useWineGeoJsonFromZip(
    "/data/WAwine.zip",
    25,
  );

  const regionStyle = useMemo<L.PathOptions>(
    () => ({
      color: "#0f172a",
      weight: 2,
      opacity: 0.95,
      fillColor: "#22c55e",
      fillOpacity: 0.08,
    }),
    [],
  );

  const idw = useMemo<IdwSurfaceOptions>(
    () => ({
      power: 6.0,
      fadeKm: 22,
    }),
    [],
  );

  const raster = useMemo<RasterRenderOptions>(
    () => ({
      sampleStepPx: 2,
      blurPx: 18,
      opacity: 0.78,
      blendMode: "screen",
    }),
    [],
  );

  return (
    <div style={{ height: "100vh", width: "100%", background: "#f1f5f9" }}>
      <MapContainer
        center={[-34.45, 117.6]}
        zoom={9.5}
        style={{ height: "100%" }}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png" />

        <FitMapToGeoJson data={region} />
        <WineRegionBoundary region={region} style={regionStyle} />

        <VineyardValueSurface
          vineyards={vineyards}
          clipBoundary={regionMask}
          idw={idw}
          raster={raster}
        />
        <VineyardAnchors vineyards={vineyards} />

        <style>{`
          .glass-label {
            background: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(4px);
            border: 1px solid #cbd5e1;
            color: #0f172a;
            font-size: 11px;
            padding: 3px 8px;
            border-radius: 6px;
            font-weight: 600;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
          }
          .glass-label:before { border-top-color: rgba(255, 255, 255, 0.85); }
        `}</style>
      </MapContainer>
    </div>
  );
}
