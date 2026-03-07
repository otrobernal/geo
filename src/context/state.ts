import type { ZipFileEntry } from "../hooks/useGeoJsonFromZip";

export interface ColorTheme {
  base: string;
  min: string;
  max: string;
}

export interface GeoState {
  zipName: string;
  zipLocation: string;
  availableFiles: ZipFileEntry[];
  displayFiles: Set<string>;
  activeGradientFile: string | null;
  colors: ColorTheme;
  isMenuExpanded: boolean;
}

export const GEO_INITIAL_STATE: GeoState = {
  zipName: "WAwine.zip",
  zipLocation: "/data/WAwine.zip",
  availableFiles: [],
  displayFiles: new Set(),
  activeGradientFile: null,
  colors: { base: "#94a3b8", min: "#ef4444", max: "#22c55e" },
  isMenuExpanded: true,
};
