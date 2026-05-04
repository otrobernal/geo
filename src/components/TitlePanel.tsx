import { memo } from "react";
import "./css/TitlePanel.css";
import { useConfiguration } from "../hooks/hooks";

export const TitlePanel = memo(function TitlePanel() {

  const { activeGradientFile } = useConfiguration();

  return (
    <div id="letitle">
      {activeGradientFile && (
        <>
          <span style={{ display: "block" }}>
            {activeGradientFile.replace(/(Cabernet|Chardonnay|Riesling|Shiraz)(.*)\.geojson/,"$2").replace(/.*_(.*)/, "$1")} {activeGradientFile.replace(/(Cabernet|Chardonnay|Riesling|Shiraz)(.*)\.geojson/,"$2").replace(/.*_(.*)_.*/, "$1")}
          </span>
          <span style={{ display: "block" }}>
            {activeGradientFile.replace(/(_.*)?.geojson/, "")}
          </span>
        </>
      )}
    </div>
  );
});