import { memo, useMemo, useCallback } from "react";
// import { memo, useMemo } from "react";
import "./css/SidebarPanel.css";
import { useConfiguration, useColorSlice, useBarplotSlice, useGeoDispatch } from "../hooks/hooks";
import { hexToRgb } from "../utilities/hexToRgb";
import { WeightsBarChart } from "./WeightsBarChart";

export const WeightsPanel = memo(function WeightsPanel() {
    const isExpanded = useBarplotSlice();
    const dispatch = useGeoDispatch();

  const handlePlotToggle = useCallback(
    () => dispatch({ type: "PLOT_TOGGLE" }),
    [dispatch],
  );

  const { activeGradientFile, availableFiles } = useConfiguration();
  
  const colors = useColorSlice();
  const theme = useMemo(
    () => ({ min: hexToRgb(colors.min), max: hexToRgb(colors.max) }),
    [colors.min, colors.max],
  );

  const weightsFile = useMemo(
    () => availableFiles.find((f) => f.name === activeGradientFile) ?? null,
    [availableFiles, activeGradientFile],
  );

//   weightsFile && console.log("Weights file found:", weightsFile.data);

  return (
    <div
      id="weights-panel"
      className={`plot-panel ${isExpanded ? "plot-expanded" : "plot-collapsed"}`}
      // className={"plot-panel"}
    >
      <header className="panel-header">
        {/* <h4>Metabolites</h4> */}
         {isExpanded && <h4>Metabolites</h4>}
        <button onClick={handlePlotToggle} className="icon-button">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            style={{
              transform: isExpanded ? "rotate(0deg)" : "rotate(180deg)",
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button> 
      </header>
      {/* {weightsFile && ( */}
      {isExpanded && weightsFile && (
        <div className="panel-content">
          <WeightsBarChart data={weightsFile.data.weights} theme={theme} />
        </div>
      )}
    </div>
  );
});