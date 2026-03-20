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

  return (
    <div
      id="weights-panel"
      className={`plot-panel ${isExpanded ? "plot-expanded" : "plot-collapsed"}`}
      // className={"plot-panel"}
    >
      <header className="panel-header">
        {/* <h4>Metabolites</h4> */}
         {isExpanded && <h4>Related chemical atrributes</h4>}
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
      {isExpanded && (weightsFile && (
        weightsFile.data.weights.length > 0 && (
        <div className="panel-content">
          <WeightsBarChart data={weightsFile.data.weights} theme={theme} />
        </div>
        ) || (
        <div className="panel-content">
          <p>
            {`No significant links were found between the chemical composition of ${weightsFile.displayName.replace(/_.*/, "")} and ${weightsFile.displayName.replace(/.*_(.*).geojson/, "\$1")} ${weightsFile.displayName.replace(/.*_(.*)_.*.geojson/, "\$1")}.`}
          </p>
        </div>
        )
      ) || (
        <div className="panel-content">
          <p>
            Select a variety and sensory attribute on the Settings panel. 
          </p>
          <p>
            A heatmap will appear, showing how this attribute varies across the wine producing region.
          </p>
          <p>
            This is based on samples obtained from participating vineyards, shown as grey circles.
          </p>
          <p>
            In turn, this pannel will display the identified chemical features that drive increase/decrease in the attribute's intensity.
          </p>
        </div>
        )
      )}
    </div>
  );
});