import type { GeoState, ColorTheme } from "./state";
import type { ZipFileEntry } from "../hooks/useGeoJsonFromZip";
import { produce, enableMapSet } from "immer";

enableMapSet();

export type GeoAction =
  // | { type: "ZIP_FILE_SELECTED"; payload: File }
  | { type: "ZIP_FILE_SELECTED"; payload: string }
  | { type: "ZIP_INPUT_CHANGE"; payload: string }
  | { type: "ZIP_LOAD" }
  | { type: "SET_AVAILABLE_FILES"; payload: ZipFileEntry[] }
  | { type: "TOGGLE_DISPLAY"; payload: string }
  | { type: "SET_GRADIENT"; payload: string | null }
  | { type: "COLOR_CHANGE"; key: keyof ColorTheme; value: string }
  | { type: "MENU_TOGGLE" }
  | { type: "PLOT_TOGGLE" };

function resolveZipUrl(input: string): string {
  return input.includes("/") ? input : `/data/${input}`;
}

export const geoReducer = produce((draft: GeoState, action: GeoAction) => {
  switch (action.type) {
    case "ZIP_INPUT_CHANGE":
      draft.zipName = action.payload;
      break;

    case "ZIP_LOAD":
      draft.zipLocation = resolveZipUrl(draft.zipName);
      draft.availableFiles = [];
      // draft.displayFiles = new Set();
      draft.activeGradientFile = null;
      break;

    case "SET_AVAILABLE_FILES":
      draft.availableFiles = action.payload;
      break;

    case "ZIP_FILE_SELECTED":
      draft.zipName = action.payload;
      // draft.zipLocation = URL.createObjectURL(action.payload);
      draft.zipLocation = resolveZipUrl(action.payload);
      draft.availableFiles = [];
      draft.activeGradientFile = null;
      break;

    // case "TOGGLE_DISPLAY":
    //   if (draft.displayFiles.has(action.payload)) {
    //     draft.displayFiles.delete(action.payload);
    //   } else {
    //     draft.displayFiles.add(action.payload);
    //   }
    //   break;

    case "SET_GRADIENT":
      draft.activeGradientFile = action.payload;
      break;

    case "COLOR_CHANGE":
      draft.colors[action.key] = action.value;
      break;

    case "MENU_TOGGLE":
      draft.isMenuExpanded = !draft.isMenuExpanded;
      break;

    case "PLOT_TOGGLE":
      draft.isBarPlotExpanded = !draft.isBarPlotExpanded;
      break;
  }
});
