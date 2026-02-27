/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";

import JSZip from "jszip";

export type GeoJsonCollection = GeoJSON.FeatureCollection<
  GeoJSON.Geometry,
  any
>;

export interface ZipFileEntry {
  name: string;
  displayName: string;
  data: GeoJsonCollection;
}

export function useGeoJsonFromZip(zipUrl: string): ZipFileEntry[] {
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
