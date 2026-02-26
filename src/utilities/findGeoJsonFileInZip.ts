import JSZip from "jszip";

export function findGeoJsonFileInZip(
  zip: JSZip,
  key: string,
): JSZip.JSZipObject | null {
  const needle = key.toLowerCase();
  for (const [fileName, file] of Object.entries(zip.files)) {
    const n = fileName.toLowerCase();
    if (n.includes(needle) && n.endsWith(".geojson")) return file;
  }
  return null;
}
