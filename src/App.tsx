/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useEffect } from "react";
import {
  GeoJSON as LeafletGeoJSON,
  MapContainer,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { useConfiguration, useColorSlice } from "./hooks/hooks";

import { GeoProvider } from "./context/GeoProvider";
import type {
  ZipFileEntry,
  // GeoJsonCollection,
} from "./hooks/useGeoJsonFromZip";
import { hexToRgb, type ColorRgb } from "./utilities/hexToRgb";
import { InterpolatedSurfaceLayer } from "./components/InterpolatedSurfaceLayer";
import { SidebarPanel } from "./components/SidebarPanel";
import { WeightsPanel } from "./components/WeightsPanel";

export interface MapTheme {
  min: ColorRgb;
  max: ColorRgb;
}

export default function App() {
  return (
    <GeoProvider>
      <GeoAppShell />
    </GeoProvider>
  );
}

function GeoAppShell() {
  return (
    <div
      id="geo-map-root"
      style={{ height: "100vh", position: "relative", overflow: "hidden" }}
    >
      <MapContainer
        center={[-34.45, 117.6]}
        zoom={9.5}
        // maxBounds={L.latLngBounds([
        // 	[-33.5,115],
        // 	[-34.5,118]
        // ])}
        style={{ height: "100%" }}
      >
        {/* <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png" /> */}
        <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png" />
        <GeoMapLayers />
      </MapContainer>
      <SidebarPanel />
      <WeightsPanel />
    </div>
  );
}

function GeoMapLayers() {
  // const { displayFiles, activeGradientFile, availableFiles } =
  const { activeGradientFile, availableFiles } = useConfiguration();
  const colors = useColorSlice();

  const theme = useMemo(
    () => ({ min: hexToRgb(colors.min), max: hexToRgb(colors.max) }),
    [colors.min, colors.max],
  );

  const gradientFile = useMemo(
    () => availableFiles.find((f) => f.name === activeGradientFile) ?? null,
    [availableFiles, activeGradientFile],
  );

  const viewportFiles = useMemo(
    // () => [...baseLayerFiles, ...(gradientFile ? [gradientFile] : [])],
    // [baseLayerFiles, gradientFile],

    // () => (gradientFile ? [gradientFile] : []),
    // [gradientFile],

    () => (gradientFile ? [gradientFile] : availableFiles),
    [availableFiles, gradientFile],
  );

  return (
    <>
      <MapAutoFitter files={viewportFiles} />

      {/* {baseLayerFiles.map((file) => (
        <LeafletGeoJSON
          key={file.name}
          data={file.data as any}
          style={{ color: colors.base, weight: 2, fillOpacity: 0.15 }}
        />
      ))} */}

      {gradientFile && (
        <>
          <LeafletGeoJSON
            key={gradientFile.name}
            data={gradientFile.data as any}
            style={{ color: colors.marker, weight: 2, fillOpacity: 0.5 }}
            // pointToLayer={function (_, latlng) {
            //   return L.circleMarker(latlng, {
            //     radius: 5,
            //     fill: true,
            //   });
            // }}
            pointToLayer={function (feature, latlng) {
              const marker = L.circleMarker(latlng, {
                radius: 5,
                fill: true,
              });
              
              // Extract feature data
              const brand = feature.properties?.Brand || "Unknown";
              const coordinates = feature.geometry?.coordinates || [0, 0];
              console.log(brand)
              // Create popup content
              const popupContent = `
              <div style="padding: 8px;">
              <strong>Brand:</strong> ${brand}<br />
              <strong>Coordinates:</strong> [${coordinates[1]}, ${coordinates[0]}]
              </div>
              `;
              
              // Bind popup to marker
              marker.bindPopup(popupContent);
  
              return marker;
            }}
          />
          <InterpolatedSurfaceLayer
            data={gradientFile.data}
            rendering={{
              sampleStepPx: 2,
              blurPx: 18,
              opacity: 0.78,
              blendMode: "screen",
            }}
            theme={theme}
          />
          {/* <PointMarkerLayer data={gradientFile.data} /> */}
        </>
      )}
    </>
  );
}

// const FIXED_DOT_STYLE = {
//   radius: 6,
//   fillColor: "#94a3b8",
//   fillOpacity: 0.85,
//   stroke: false,
// } as const;

// export function PointMarkerLayer({ data }: { data: GeoJsonCollection | null }) {
//   if (!data) return null;
//   return (
//     <LeafletGeoJSON
//       data={data as any}
//       pointToLayer={(feature, latlng) => {
//         const marker = L.circleMarker(latlng, FIXED_DOT_STYLE);
//         const label =
//           feature.properties?.Variety || feature.properties?.name || "Point";
//         marker.bindTooltip(`<strong>${label}</strong>`, {
//           permanent: true,
//           direction: "top",
//           className: "glass-label",
//         });
//         return marker;
//       }}
//     />
//   );
// }

function MapAutoFitter({ files }: { files: ZipFileEntry[] }) {
  const map = useMap();
  useEffect(() => {
    if (files.length === 0) return;
    const group = L.featureGroup();
    files.forEach((f) => L.geoJSON(f.data as any).addTo(group));
    const bounds = group.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds.pad(0.06));
  }, [map, files]);
  return null;
}
