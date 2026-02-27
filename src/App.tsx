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
import * as htmlToImage from "html-to-image";
import "leaflet/dist/leaflet.css";
import {
  interpolateIdwAt,
  type VineyardSample,
} from "./utilities/interpolateIdwAt";

type GeoJsonCollection = GeoJSON.FeatureCollection<GeoJSON.Geometry, any>;

interface ZipFileEntry {
  name: string;
  displayName: string;
  data: GeoJsonCollection;
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

interface SelectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ToastMessage {
  text: string;
  type: "info" | "success" | "error";
}

function hexToRgb(hex: string): ColorRgb {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

function valueToDivergingRgb(
  value: number,
  minColor: ColorRgb,
  maxColor: ColorRgb,
): ColorRgb {
  const v = Math.max(-1, Math.min(1, value));
  if (v < 0) return minColor;
  if (v > 0) return maxColor;
  return { r: 0, g: 0, b: 0 };
}

function extractPointSamples(
  geoJson: GeoJsonCollection | null,
): VineyardSample[] {
  if (!geoJson) return [];
  const samples: VineyardSample[] = [];
  for (const feature of geoJson.features) {
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

function useGeoJsonFromZip(zipUrl: string): ZipFileEntry[] {
  const [availableFiles, setAvailableFiles] = useState<ZipFileEntry[]>([]);

  useEffect(() => {
    const load = async () => {
      setAvailableFiles([]);
      const response = await fetch(zipUrl);
      if (!response.ok) throw new Error("File not found");
      const zip = await JSZip.loadAsync(await response.arrayBuffer());
      const files: ZipFileEntry[] = [];

      for (const [fileName, file] of Object.entries(zip.files)) {
        const lowerName = fileName.toLowerCase();

        if (
          file.dir ||
          lowerName.includes("__macosx") ||
          fileName.split("/").pop()?.startsWith(".")
        ) {
          continue;
        }

        if (lowerName.endsWith(".geojson")) {
          try {
            const jsonData = JSON.parse(
              await file.async("string"),
            ) as GeoJsonCollection;
            const displayName = fileName.split("/").pop() || fileName;

            files.push({
              name: fileName,
              displayName,
              data: jsonData,
            });
          } catch (e) {
            console.warn(`Failed to parse ${fileName} as JSON`, e);
          }
        }
      }

      setAvailableFiles(files);
    };

    if (zipUrl) {
      load().catch(console.error);
    }
  }, [zipUrl]);

  return availableFiles;
}

function FitMapToActiveLayers({
  activeFiles,
}: {
  activeFiles: ZipFileEntry[];
}) {
  const map = useMap();

  useEffect(() => {
    if (!activeFiles.length) return;
    try {
      const group = L.featureGroup();
      activeFiles.forEach((file) => {
        const layer = L.geoJSON(file.data as any);
        layer.addTo(group);
      });

      const bounds = group.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.06));
      }
    } catch (error: unknown) {
      console.error(error);
    }
  }, [map, activeFiles]);

  return null;
}

function DataPointAnchors({
  data,
  minRgb,
  maxRgb,
}: {
  data: GeoJsonCollection | null;
  minRgb: ColorRgb;
  maxRgb: ColorRgb;
}) {
  if (!data) return null;

  return (
    <LeafletGeoJSON
      data={data as any}
      pointToLayer={(feature: any, latlng) => {
        const value = Number(feature.properties?.value ?? 0);
        const { r, g, b } = valueToDivergingRgb(value, minRgb, maxRgb);

        const marker = L.circleMarker(latlng, {
          radius: 6,
          fillColor: `rgb(${r}, ${g}, ${b})`,
          color: "#fff",
          weight: 2,
          fillOpacity: 1,
        });

        const labelText =
          feature.properties?.Variety || feature.properties?.name || "Point";

        marker.bindTooltip(`<strong>${labelText}</strong>`, {
          permanent: true,
          direction: "top",
          className: "glass-label",
        });

        return marker;
      }}
    />
  );
}

function DataValueSurface({
  data,
  idw,
  raster,
  minRgb,
  maxRgb,
}: {
  data: GeoJsonCollection | null;
  idw: IdwSurfaceOptions;
  raster: RasterRenderOptions;
  minRgb: ColorRgb;
  maxRgb: ColorRgb;
}) {
  const map = useMap();
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rasterCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const samples = useMemo(() => extractPointSamples(data), [data]);

  useEffect(() => {
    if (!samples.length) {
      if (overlayCanvasRef.current) {
        overlayCanvasRef.current.remove();
        overlayCanvasRef.current = null;
      }
      return;
    }

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

            const { r, g, b } = valueToDivergingRgb(
              result.value,
              minRgb,
              maxRgb,
            );
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
    idw.power,
    idw.fadeKm,
    raster.sampleStepPx,
    raster.blurPx,
    raster.opacity,
    raster.blendMode,
    minRgb.r,
    minRgb.g,
    minRgb.b,
    maxRgb.r,
    maxRgb.g,
    maxRgb.b,
  ]);

  return null;
}

export default function GenericZipMap() {
  const [zipInput, setZipInput] = useState<string>("WAwine.zip");
  const [activeZipUrl, setActiveZipUrl] = useState<string>("/data/WAwine.zip");
  const availableFiles = useGeoJsonFromZip(activeZipUrl);

  const [displayFiles, setDisplayFiles] = useState<Set<string>>(new Set());
  const [activeGradientFile, setActiveGradientFile] = useState<string | null>(
    null,
  );

  const [baseColor, setBaseColor] = useState<string>("#94a3b8");
  const [gradientMinColor, setGradientMinColor] = useState<string>("#ef4444");
  const [gradientMaxColor, setGradientMaxColor] = useState<string>("#22c55e");

  const [isScreenshotMode, setIsScreenshotMode] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [finalSelection, setFinalSelection] = useState<SelectionBox | null>(
    null,
  );
  const [isMenuExpanded, setIsMenuExpanded] = useState(true);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const isDrawingRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const selectionBoxElementRef = useRef<HTMLDivElement>(null);
  const initialDimRef = useRef<HTMLDivElement>(null);

  const minRgb = useMemo(() => hexToRgb(gradientMinColor), [gradientMinColor]);
  const maxRgb = useMemo(() => hexToRgb(gradientMaxColor), [gradientMaxColor]);

  const idw = useMemo<IdwSurfaceOptions>(
    () => ({ power: 6.0, fadeKm: 22 }),
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

  const handleLoadZip = (e: React.FormEvent) => {
    e.preventDefault();
    if (!zipInput.trim()) return;
    const url =
      zipInput.startsWith("/") || zipInput.startsWith("http")
        ? zipInput
        : `/data/${zipInput}`;
    setActiveZipUrl(url);
    setDisplayFiles(new Set());
    setActiveGradientFile(null);
  };

  const toggleDisplay = (name: string) => {
    setDisplayFiles((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const handleGradientClick = (
    name: string,
    e: React.MouseEvent<HTMLInputElement>,
  ) => {
    if (activeGradientFile === name) {
      e.preventDefault();
      setActiveGradientFile(null);
    } else {
      setActiveGradientFile(name);
    }
  };

  const handleScreenshotToggle = () => {
    const nextState = !isScreenshotMode;
    setIsScreenshotMode(nextState);
    if (!nextState) {
      setFinalSelection(null);
      isDrawingRef.current = false;
      startPosRef.current = null;
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!mapContainerRef.current) return;
    const rect = mapContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    isDrawingRef.current = true;
    startPosRef.current = { x, y };
    setFinalSelection(null);
    if (initialDimRef.current) initialDimRef.current.style.display = "none";
    if (selectionBoxElementRef.current) {
      selectionBoxElementRef.current.style.display = "block";
      selectionBoxElementRef.current.style.left = `${x}px`;
      selectionBoxElementRef.current.style.top = `${y}px`;
      selectionBoxElementRef.current.style.width = `0px`;
      selectionBoxElementRef.current.style.height = `0px`;
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (
      !isDrawingRef.current ||
      !startPosRef.current ||
      !selectionBoxElementRef.current ||
      !mapContainerRef.current
    )
      return;
    const rect = mapContainerRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    const x = Math.min(startPosRef.current.x, currentX);
    const y = Math.min(startPosRef.current.y, currentY);
    const width = Math.abs(currentX - startPosRef.current.x);
    const height = Math.abs(currentY - startPosRef.current.y);
    selectionBoxElementRef.current.style.left = `${x}px`;
    selectionBoxElementRef.current.style.top = `${y}px`;
    selectionBoxElementRef.current.style.width = `${width}px`;
    selectionBoxElementRef.current.style.height = `${height}px`;
  };

  const handleMouseUp = () => {
    isDrawingRef.current = false;
    if (selectionBoxElementRef.current) {
      const x = parseFloat(selectionBoxElementRef.current.style.left);
      const y = parseFloat(selectionBoxElementRef.current.style.top);
      const width = parseFloat(selectionBoxElementRef.current.style.width);
      const height = parseFloat(selectionBoxElementRef.current.style.height);
      if (width > 5 && height > 5) {
        setFinalSelection({ x, y, width, height });
      } else {
        selectionBoxElementRef.current.style.display = "none";
        if (initialDimRef.current)
          initialDimRef.current.style.display = "block";
      }
    }
  };

  const takeScreenshot = async () => {
    if (!mapContainerRef.current || !finalSelection) return;
    setIsCapturing(true);
    setToast({ text: "📸 Capturing high-def screenshot...", type: "info" });
    try {
      const mapNode = mapContainerRef.current;
      const scale = 3;
      const dataUrl = await htmlToImage.toPng(mapNode, {
        pixelRatio: scale,
        filter: (node) => {
          if (node.id === "drawing-overlay") return false;
          if (node.id === "control-panel") return false;
          return true;
        },
      });
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
      });
      const croppedCanvas = document.createElement("canvas");
      const ctx = croppedCanvas.getContext("2d");
      if (!ctx) throw new Error("Could not create crop context");
      croppedCanvas.width = finalSelection.width * scale;
      croppedCanvas.height = finalSelection.height * scale;
      ctx.drawImage(
        img,
        finalSelection.x * scale,
        finalSelection.y * scale,
        finalSelection.width * scale,
        finalSelection.height * scale,
        0,
        0,
        finalSelection.width * scale,
        finalSelection.height * scale,
      );
      croppedCanvas.toBlob(
        async (blob) => {
          if (!blob) throw new Error("Canvas generation failed");
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob }),
          ]);
          setToast({ text: "✅ Copied to clipboard!", type: "success" });
          setIsCapturing(false);
          setFinalSelection(null);
          setIsScreenshotMode(false);
          setTimeout(() => setToast(null), 2500);
        },
        "image/png",
        1.0,
      );
    } catch (err) {
      console.error(err);
      setToast({ text: "❌ Failed to copy screenshot.", type: "error" });
      setIsCapturing(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const activeBaseLayers = availableFiles.filter(
    (f) => displayFiles.has(f.name) && f.name !== activeGradientFile,
  );
  const activeGradientLayer = availableFiles.find(
    (f) => f.name === activeGradientFile,
  );
  const allActiveFiles = [...activeBaseLayers];
  if (activeGradientLayer) allActiveFiles.push(activeGradientLayer);

  return (
    <div
      ref={mapContainerRef}
      style={{
        height: "100vh",
        width: "100%",
        background: "#f1f5f9",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <MapContainer
        center={[-34.45, 117.6]}
        zoom={9.5}
        style={{ height: "100%", width: "100%", zIndex: 0 }}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png" />
        <FitMapToActiveLayers activeFiles={allActiveFiles} />
        {activeBaseLayers.map((file) => (
          <LeafletGeoJSON
            key={`base-${file.name}-${baseColor}`}
            data={file.data as any}
            style={{
              color: baseColor,
              weight: 2,
              opacity: 0.95,
              fillColor: baseColor,
              fillOpacity: 0.15,
            }}
          />
        ))}
        {activeGradientLayer && (
          <div
            key={`grad-${activeGradientLayer.name}-${gradientMinColor}-${gradientMaxColor}`}
          >
            <DataValueSurface
              data={activeGradientLayer.data}
              idw={idw}
              raster={raster}
              minRgb={minRgb}
              maxRgb={maxRgb}
            />
            <DataPointAnchors
              data={activeGradientLayer.data}
              minRgb={minRgb}
              maxRgb={maxRgb}
            />
          </div>
        )}
        <style>{`
          .glass-label { background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(4px); border: 1px solid #cbd5e1; color: #0f172a; font-size: 11px; padding: 3px 8px; border-radius: 6px; font-weight: 600; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
          .glass-label:before { border-top-color: rgba(255, 255, 255, 0.85); }
          .color-picker { border: none; width: 24px; height: 24px; padding: 0; cursor: pointer; border-radius: 4px; background: none; }
          .color-picker::-webkit-color-swatch-wrapper { padding: 0; }
          .color-picker::-webkit-color-swatch { border: 1px solid #cbd5e1; border-radius: 4px; }
          @keyframes toastSlideDown { from { opacity: 0; transform: translate(-50%, -20px); } to { opacity: 1; transform: translate(-50%, 0); } }
        `}</style>
      </MapContainer>

      {toast && (
        <div
          style={{
            position: "absolute",
            top: "24px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10000,
            background: toast.type === "error" ? "#ef4444" : "#0f172a",
            color: "white",
            padding: "12px 24px",
            borderRadius: "8px",
            boxShadow:
              "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
            fontFamily: "sans-serif",
            fontSize: "14px",
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            animation:
              "toastSlideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
          }}
        >
          {toast.text}
        </div>
      )}

      {isScreenshotMode && (
        <div
          id="drawing-overlay"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            zIndex: 1000,
            cursor: "crosshair",
          }}
        >
          <div
            ref={initialDimRef}
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              background: "rgba(255, 255, 255, 0.3)",
              display: finalSelection ? "none" : "block",
              pointerEvents: "none",
            }}
          />
          <div
            ref={selectionBoxElementRef}
            style={{
              position: "absolute",
              border: "2px dashed #0f172a",
              boxShadow: "0 0 0 9999px rgba(255, 255, 255, 0.5)",
              pointerEvents: "none",
              display: finalSelection ? "block" : "none",
              left: finalSelection?.x || 0,
              top: finalSelection?.y || 0,
              width: finalSelection?.width || 0,
              height: finalSelection?.height || 0,
            }}
          />
        </div>
      )}

      <div
        id="control-panel"
        style={{
          position: "absolute",
          bottom: "20px",
          right: "20px",
          zIndex: 9999,
          background: "white",
          padding: isMenuExpanded ? "16px" : "8px",
          borderRadius: "8px",
          boxShadow:
            "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
          minWidth: isMenuExpanded ? "240px" : "40px",
          maxHeight: "90vh",
          overflowY: isMenuExpanded ? "auto" : "hidden",
          transition: "all 0.3s ease",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: isMenuExpanded ? "space-between" : "center",
            alignItems: "center",
            marginBottom: isMenuExpanded ? "12px" : "0",
          }}
        >
          {isMenuExpanded && (
            <h4
              style={{
                margin: 0,
                fontSize: "15px",
                color: "#0f172a",
                fontFamily: "sans-serif",
                fontWeight: 600,
              }}
            >
              Map Settings
            </h4>
          )}
          <button
            onClick={() => setIsMenuExpanded(!isMenuExpanded)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: isMenuExpanded ? "rotate(0deg)" : "rotate(180deg)",
              transition: "transform 0.3s ease",
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#64748b"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
        </div>

        {isMenuExpanded && (
          <>
            <form
              onSubmit={handleLoadZip}
              style={{
                marginBottom: "16px",
                paddingBottom: "12px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <label
                style={{
                  display: "block",
                  margin: "0 0 8px 0",
                  fontSize: "14px",
                  color: "#0f172a",
                  fontFamily: "sans-serif",
                  fontWeight: 600,
                }}
              >
                Dataset (ZIP File)
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  value={zipInput}
                  onChange={(e) => setZipInput(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "6px",
                    borderRadius: "4px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    fontFamily: "sans-serif",
                    minWidth: "120px",
                  }}
                  placeholder="e.g. WAwine.zip"
                />
                <button
                  type="submit"
                  style={{
                    padding: "6px 12px",
                    background: "#0f172a",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    fontSize: "13px",
                    cursor: "pointer",
                    fontFamily: "sans-serif",
                  }}
                >
                  Load
                </button>
              </div>
            </form>
            <div
              style={{
                marginBottom: "16px",
                paddingBottom: "12px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h4
                style={{
                  margin: "0 0 10px 0",
                  fontSize: "14px",
                  color: "#0f172a",
                  fontFamily: "sans-serif",
                  fontWeight: 600,
                }}
              >
                Screenshot Tools
              </h4>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "8px" }}
              >
                <button
                  onClick={handleScreenshotToggle}
                  style={{
                    width: "100%",
                    padding: "8px",
                    background: isScreenshotMode ? "#ef4444" : "#e2e8f0",
                    color: isScreenshotMode ? "white" : "#0f172a",
                    border: "none",
                    borderRadius: "4px",
                    fontSize: "13px",
                    cursor: "pointer",
                    fontFamily: "sans-serif",
                    fontWeight: 500,
                  }}
                >
                  {isScreenshotMode
                    ? "Cancel Screenshot Mode"
                    : "Select Screenshot Area"}
                </button>
                {isScreenshotMode && (
                  <button
                    onClick={takeScreenshot}
                    disabled={
                      isCapturing ||
                      !finalSelection ||
                      finalSelection.width === 0
                    }
                    style={{
                      width: "100%",
                      padding: "8px",
                      background:
                        !finalSelection || finalSelection.width === 0
                          ? "#94a3b8"
                          : "#22c55e",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      fontSize: "13px",
                      cursor:
                        isCapturing || !finalSelection
                          ? "not-allowed"
                          : "pointer",
                      fontFamily: "sans-serif",
                      fontWeight: 500,
                    }}
                  >
                    {isCapturing ? "Capturing..." : "Take High-Def Screenshot"}
                  </button>
                )}
              </div>
            </div>
            <div
              style={{
                marginBottom: "16px",
                paddingBottom: "12px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h4
                style={{
                  margin: "0 0 10px 0",
                  fontSize: "14px",
                  color: "#0f172a",
                  fontFamily: "sans-serif",
                  fontWeight: 600,
                }}
              >
                Colors
              </h4>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "8px",
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    color: "#64748b",
                    fontFamily: "sans-serif",
                  }}
                >
                  Base Map
                </span>
                <input
                  type="color"
                  className="color-picker"
                  value={baseColor}
                  onChange={(e) => setBaseColor(e.target.value)}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "8px",
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    color: "#64748b",
                    fontFamily: "sans-serif",
                  }}
                >
                  Scale Bottom (-1)
                </span>
                <input
                  type="color"
                  className="color-picker"
                  value={gradientMinColor}
                  onChange={(e) => setGradientMinColor(e.target.value)}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    color: "#64748b",
                    fontFamily: "sans-serif",
                  }}
                >
                  Scale Top (+1)
                </span>
                <input
                  type="color"
                  className="color-picker"
                  value={gradientMaxColor}
                  onChange={(e) => setGradientMaxColor(e.target.value)}
                />
              </div>
            </div>
            {availableFiles.length > 0 ? (
              <>
                <h4
                  style={{
                    margin: "0 0 12px 0",
                    fontSize: "14px",
                    color: "#0f172a",
                    fontFamily: "sans-serif",
                    fontWeight: 600,
                  }}
                >
                  Map Layers
                </h4>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th
                        style={{
                          textAlign: "left",
                          paddingBottom: "8px",
                          fontSize: "12px",
                          color: "#64748b",
                          fontWeight: 600,
                          fontFamily: "sans-serif",
                        }}
                      >
                        File
                      </th>
                      <th
                        style={{
                          textAlign: "center",
                          paddingBottom: "8px",
                          fontSize: "12px",
                          color: "#64748b",
                          fontWeight: 600,
                          fontFamily: "sans-serif",
                        }}
                      >
                        Display
                      </th>
                      <th
                        style={{
                          textAlign: "center",
                          paddingBottom: "8px",
                          fontSize: "12px",
                          color: "#64748b",
                          fontWeight: 600,
                          fontFamily: "sans-serif",
                        }}
                      >
                        Gradient
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {availableFiles.map((file) => (
                      <tr
                        key={file.name}
                        style={{ borderTop: "1px solid #e2e8f0" }}
                      >
                        <td
                          style={{
                            padding: "8px 0",
                            fontSize: "13px",
                            color: "#334155",
                            fontWeight: 500,
                            fontFamily: "sans-serif",
                            wordBreak: "break-all",
                          }}
                        >
                          {file.displayName}
                        </td>
                        <td style={{ textAlign: "center", padding: "8px 0" }}>
                          <input
                            type="checkbox"
                            checked={displayFiles.has(file.name)}
                            onChange={() => toggleDisplay(file.name)}
                            style={{ cursor: "pointer" }}
                          />
                        </td>
                        <td style={{ textAlign: "center", padding: "8px 0" }}>
                          <input
                            type="radio"
                            name="gradient-selector"
                            checked={activeGradientFile === file.name}
                            onClick={(e) => handleGradientClick(file.name, e)}
                            onChange={() => {}}
                            style={{ cursor: "pointer" }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <div
                style={{
                  fontSize: "13px",
                  color: "#64748b",
                  fontFamily: "sans-serif",
                  fontStyle: "italic",
                }}
              >
                No layers loaded.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
