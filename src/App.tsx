/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  GeoJSON as LeafletGeoJSON,
  MapContainer,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import * as htmlToImage from "html-to-image";
import "leaflet/dist/leaflet.css";

import {
  useGeoJsonFromZip,
  type GeoJsonCollection,
  type ZipFileEntry,
} from "./hooks/useGeoJsonFromZip";
import { hexToRgb, type ColorRgb } from "./utilities/hexToRgb.ts";
import { computePointColor } from "./utilities/computePointColor.ts";
import { InterpolatedSurfaceLayer } from "./components/InterpolatedSurfaceLayer.tsx";
import { SidebarPanel } from "./components/SidebarPanel.tsx";

interface ViewportOptions {
  activeFiles: ZipFileEntry[];
}

interface SelectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

function MapAutoFitter({ activeFiles }: ViewportOptions) {
  const map = useMap();

  useEffect(() => {
    if (activeFiles.length === 0) return;

    const featureGroup = L.featureGroup();
    activeFiles.forEach((file) => {
      L.geoJSON(file.data as any).addTo(featureGroup);
    });

    const bounds = featureGroup.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.06));
    }
  }, [map, activeFiles]);

  return null;
}

export default function App() {
  const [zipInput, setZipInput] = useState("WAwine.zip");
  const [zipUrl, setZipUrl] = useState("/data/WAwine.zip");
  const availableFiles = useGeoJsonFromZip(zipUrl);

  const [displayFiles, setDisplayFiles] = useState<Set<string>>(new Set());
  const [activeGradientFile, setActiveGradientFile] = useState<string | null>(
    null,
  );

  const [colors, setColors] = useState({
    base: "#94a3b8",
    min: "#ef4444",
    max: "#22c55e",
  });
  const theme = useMemo(
    () => ({ min: hexToRgb(colors.min), max: hexToRgb(colors.max) }),
    [colors],
  );

  const [isScreenshotMode, setScreenshotMode] = useState(false);
  const [isCapturing, setCapturing] = useState(false);
  const [selection, setSelection] = useState<SelectionBox | null>(null);
  const [isMenuExpanded, setMenuExpanded] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  const handleZipSubmit = (e: any) => {
    e.preventDefault();
    const url = zipInput.includes("/") ? zipInput : `/data/${zipInput}`;
    setZipUrl(url);
    setDisplayFiles(new Set());
    setActiveGradientFile(null);
  };

  const handleCapture = async () => {
    if (!containerRef.current || !selection) return;
    setCapturing(true);
    try {
      const scale = 3;
      const dataUrl = await htmlToImage.toPng(containerRef.current, {
        pixelRatio: scale,
        filter: (node: any) =>
          !["drawing-overlay", "control-panel"].includes(node.id),
      });

      const image = new Image();
      image.src = dataUrl;
      await new Promise((r) => (image.onload = r));

      const canvas = document.createElement("canvas");
      canvas.width = selection.width * scale;
      canvas.height = selection.height * scale;
      canvas
        .getContext("2d")
        ?.drawImage(
          image,
          selection.x * scale,
          selection.y * scale,
          selection.width * scale,
          selection.height * scale,
          0,
          0,
          selection.width * scale,
          selection.height * scale,
        );

      canvas.toBlob(async (blob) => {
        if (blob)
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob }),
          ]);
        setCapturing(false);
        setScreenshotMode(false);
        setSelection(null);
      });
    } catch (e: unknown) {
      console.log(`The error: ${e}`);
      setCapturing(false);
    }
  };

  const activeBaseLayers = availableFiles.filter(
    (f) => displayFiles.has(f.name) && f.name !== activeGradientFile,
  );
  const gradientLayer = availableFiles.find(
    (f) => f.name === activeGradientFile,
  );

  return (
    <div
      ref={containerRef}
      style={{ height: "100vh", position: "relative", overflow: "hidden" }}
    >
      <MapContainer
        center={[-34.45, 117.6]}
        zoom={9.5}
        style={{ height: "100%" }}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png" />
        <MapAutoFitter
          activeFiles={[
            ...activeBaseLayers,
            ...(gradientLayer ? [gradientLayer] : []),
          ]}
        />

        {activeBaseLayers.map((file) => (
          <LeafletGeoJSON
            key={file.name}
            data={file.data as any}
            style={{ color: colors.base, weight: 2, fillOpacity: 0.15 }}
          />
        ))}

        {gradientLayer && (
          <>
            <InterpolatedSurfaceLayer
              data={gradientLayer.data}
              rendering={{
                sampleStepPx: 2,
                blurPx: 18,
                opacity: 0.78,
                blendMode: "screen",
              }}
              theme={theme}
            />
            <PointMarkerLayer data={gradientLayer.data} theme={theme} />
          </>
        )}
      </MapContainer>

      {isScreenshotMode && (
        <div
          id="drawing-overlay"
          onMouseDown={(e) => {
            const rect = containerRef.current!.getBoundingClientRect();
            dragStart.current = {
              x: e.clientX - rect.left,
              y: e.clientY - rect.top,
            };
            setSelection(null);
          }}
          onMouseMove={(e) => {
            if (!dragStart.current) return;
            const rect = containerRef.current!.getBoundingClientRect();
            const cur = { x: e.clientX - rect.left, y: e.clientY - rect.top };
            const box = {
              x: Math.min(dragStart.current.x, cur.x),
              y: Math.min(dragStart.current.y, cur.y),
              width: Math.abs(cur.x - dragStart.current.x),
              height: Math.abs(cur.y - dragStart.current.y),
            };
            if (selectionRef.current) {
              Object.assign(selectionRef.current.style, {
                display: "block",
                left: `${box.x}px`,
                top: `${box.y}px`,
                width: `${box.width}px`,
                height: `${box.height}px`,
              });
            }
          }}
          onMouseUp={() => {
            if (selectionRef.current) {
              const style = selectionRef.current.style;
              setSelection({
                x: parseFloat(style.left),
                y: parseFloat(style.top),
                width: parseFloat(style.width),
                height: parseFloat(style.height),
              });
            }
            dragStart.current = null;
          }}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1000,
            cursor: "crosshair",
          }}
        >
          <div
            ref={selectionRef}
            style={{
              position: "absolute",
              border: "2px dashed #0f172a",
              boxShadow: "0 0 0 9999px rgba(255, 255, 255, 0.5)",
              display: "none",
            }}
          />
        </div>
      )}

      <SidebarPanel
        isExpanded={isMenuExpanded}
        onToggle={() => setMenuExpanded(!isMenuExpanded)}
        zipInput={zipInput}
        onZipInputChange={(e: any) => setZipInput(e.target.value)}
        onZipSubmit={handleZipSubmit}
        isScreenshotMode={isScreenshotMode}
        onScreenshotToggle={() => {
          setScreenshotMode(!isScreenshotMode);
          setSelection(null);
        }}
        onCapture={handleCapture}
        isCapturing={isCapturing}
        hasSelection={!!selection && selection.width > 5}
        colors={colors}
        onColorChange={(key: string, val: string) =>
          setColors((prev) => ({ ...prev, [key]: val }))
        }
        files={availableFiles}
        displaySet={displayFiles}
        onToggleDisplay={(name: string) =>
          setDisplayFiles((prev) => {
            const next = new Set(prev);
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            next.has(name) ? next.delete(name) : next.add(name);
            return next;
          })
        }
        gradientFile={activeGradientFile}
        onGradientChange={(name: string, e: any) => {
          if (activeGradientFile === name) {
            e.preventDefault();
            setActiveGradientFile(null);
          } else {
            setActiveGradientFile(name);
          }
        }}
      />
    </div>
  );
}

export function PointMarkerLayer({
  data,
  theme,
}: {
  data: GeoJsonCollection | null;
  theme: MapTheme;
}) {
  if (!data) return null;

  return (
    <LeafletGeoJSON
      data={data as any}
      pointToLayer={(feature, latlng) => {
        const value = Number(feature.properties?.value ?? 0);
        const { r, g, b } = computePointColor(value, theme);

        const marker = L.circleMarker(latlng, {
          radius: 6,
          fillColor: `rgb(${r}, ${g}, ${b})`,
          color: "#fff",
          weight: 2,
          fillOpacity: 1,
        });

        const label =
          feature.properties?.Variety || feature.properties?.name || "Point";
        marker.bindTooltip(`<strong>${label}</strong>`, {
          permanent: true,
          direction: "top",
          className: "glass-label",
        });

        return marker;
      }}
    />
  );
}

export interface MapTheme {
  min: ColorRgb;
  max: ColorRgb;
}
