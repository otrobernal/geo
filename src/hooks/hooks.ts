import { useContext, useMemo } from "react";
import { GeoStateContext, GeoDispatchContext } from "../context/contexts";
import type { GeoAction } from "../context/geoReducer";
import type { GeoState } from "../context/state";
import type { Dispatch } from "react";

function assertContext<T>(ctx: T | null, name: string): T {
  if (ctx === null)
    throw new Error(`${name} must be used inside <GeoProvider>`);
  return ctx;
}

export function useGeoState(): GeoState {
  return assertContext(useContext(GeoStateContext), "useGeoState");
}

export function useGeoDispatch(): Dispatch<GeoAction> {
  return assertContext(useContext(GeoDispatchContext), "useGeoDispatch");
}

export function useZip() {
  const { zipName, zipLocation } = useGeoState();
  return useMemo(() => ({ zipName, zipLocation }), [zipName, zipLocation]);
}

export function useConfiguration() {
  const { displayFiles, activeGradientFile, availableFiles } = useGeoState();
  return useMemo(
    () => ({ displayFiles, activeGradientFile, availableFiles }),
    [displayFiles, activeGradientFile, availableFiles],
  );
}

export function useColorSlice() {
  const { colors } = useGeoState();
  return colors;
}

export function useMenuSlice(): boolean {
  return useGeoState().isMenuExpanded;
}
