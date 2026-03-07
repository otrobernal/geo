import { createContext, type Dispatch } from "react";
import type { GeoState } from "./state";
import type { GeoAction } from "./geoReducer";

export const GeoStateContext = createContext<GeoState | null>(null);
export const GeoDispatchContext = createContext<Dispatch<GeoAction> | null>(
  null,
);
