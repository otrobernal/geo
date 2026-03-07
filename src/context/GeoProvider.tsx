import { useReducer, useEffect, type Dispatch, type ReactNode } from "react";
import { geoReducer, type GeoAction } from "./geoReducer";
import { GEO_INITIAL_STATE } from "./state";
import { GeoStateContext, GeoDispatchContext } from "./contexts";
import { useGeoJsonFromZip } from "../hooks/useGeoJsonFromZip";

function GeoDataSync({
  zipUrl,
  dispatch,
}: {
  zipUrl: string;
  dispatch: Dispatch<GeoAction>;
}) {
  const files = useGeoJsonFromZip(zipUrl);

  useEffect(() => {
    dispatch({ type: "SET_AVAILABLE_FILES", payload: files });
  }, [files, dispatch]);

  return null;
}

export function GeoProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(geoReducer, GEO_INITIAL_STATE);

  return (
    <GeoDispatchContext.Provider value={dispatch}>
      <GeoStateContext.Provider value={state}>
        <GeoDataSync zipUrl={state.zipLocation} dispatch={dispatch} />
        {children}
      </GeoStateContext.Provider>
    </GeoDispatchContext.Provider>
  );
}
