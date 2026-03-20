import { memo, useMemo, useCallback } from "react";
// import { memo, useMemo } from "react";
import "./css/SidebarPanel.css";
import { useConfiguration, useColorSlice, useBarplotSlice, useGeoDispatch } from "../hooks/hooks";
import { hexToRgb, rgbToString } from "../utilities/hexToRgb";
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
          <div className="explanation">
            <>
              <span style={{ color: rgbToString(theme.max) }}>Rightwards bars </span>
              indicate components that increased <strong>{`${weightsFile.displayName.replace(/.*_(.*).geojson/, "\$1")} ${weightsFile.displayName.replace(/.*_(.*)_.*.geojson/, "\$1")}`}</strong> in <strong>{`${weightsFile.displayName.replace(/_.*/, "")}. `}</strong>
              <span style={{ color: rgbToString(theme.min) }}>Leftwards bars </span>
              {` indicate components that decreased it. The size of the bar indicates the magnitude of the effect.`}
            </>
          </div>
        </div>
        ) || (
        <div className="panel-content">
          <div className="explanation">
            {`No significant links were found between the chemical composition of ${weightsFile.displayName.replace(/_.*/, "")} and ${weightsFile.displayName.replace(/.*_(.*).geojson/, "\$1")} ${weightsFile.displayName.replace(/.*_(.*)_.*.geojson/, "\$1")}.`}
          </div>
        </div>
        )
      ) || (
        <div className="panel-content">
          <div className="explanation">
          <p>
            Select a grape variety and sensory attribute on the <strong>Settings</strong> panel. 
          </p>
          <p>
            A heatmap will appear, showing how this attribute varies across the region.
          </p>
          <p>
            Attributes marked with ** were linked to characteristic chemical features. In those cases, this panel will display the wine components that drive the variation in the attribute's intensity.
          </p>
          <div>
            <strong>Based on:</strong>
            <ul>
              <li>three years of sample collection at <strong>participating vineyards</strong> (shown in the map as <strong>grey circles</strong>) in the Margaret River area and Great Southern region</li>
              <li>standardized wine preparation from collected grapes</li>
              <li>chemical analyses by gas chromatography and other techniques</li>
              <li>sensory assessment by a panel of local winemakers, using the pivot method</li>
              <li>multivariate statistical regression of the full chemical profile to each separate sensory attribute.</li>
            </ul>
          </div>
        </div>
        </div>
        )
      )}
    </div>
  );
});