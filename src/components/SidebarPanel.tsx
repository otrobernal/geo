import { memo, useCallback, useEffect, useRef, useState } from "react";
import "./css/SidebarPanel.css";
import {
  useZip,
  useColorSlice,
  useConfiguration,
  useMenuSlice,
  useGeoDispatch,
} from "../hooks/hooks";
import type { ColorTheme } from "../context/state";

const DatasetSection = memo(function DatasetSection() {
  const { zipName } = useZip();
  const dispatch = useGeoDispatch();

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      dispatch({ type: "ZIP_INPUT_CHANGE", payload: e.target.value }),
    [dispatch],
  );

  const handleLoad = useCallback(
    (e: React.SyntheticEvent) => {
      e.preventDefault();
      dispatch({ type: "ZIP_LOAD" });
    },
    [dispatch],
  );

  return (
    <div className="settings-section">
      <label>Dataset</label>
      <div className="input-row">
        <input
          className="text-input"
          value={zipName}
          onChange={handleInputChange}
        />
        <button className="primary-button" onClick={handleLoad}>
          Load
        </button>
      </div>
    </div>
  );
});

const DEBOUNCE_MS = 80;

const ColorPickers = memo(function ColorPickers() {
  const committedColors = useColorSlice();
  const dispatch = useGeoDispatch();
  const [localColors, setLocalColors] = useState(committedColors);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalColors(committedColors);
  }, [committedColors]);

  const handleChange = useCallback(
    (key: keyof ColorTheme, value: string) => {
      setLocalColors((prev) => ({ ...prev, [key]: value }));

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        dispatch({ type: "COLOR_CHANGE", key, value });
      }, DEBOUNCE_MS);
    },
    [dispatch],
  );

  return (
    <div className="settings-section">
      <label>Theme Colors</label>
      {(Object.entries(localColors) as [keyof ColorTheme, string][]).map(
        ([key, value]) => (
          <div key={key} className="color-row">
            <span>{key}</span>
            <input
              type="color"
              className="color-picker-input"
              value={value}
              onChange={(e) => handleChange(key, e.target.value)}
            />
          </div>
        ),
      )}
    </div>
  );
});

const LayerTable = memo(function LayerTable() {
  const { availableFiles, displayFiles, activeGradientFile } =
    useConfiguration();
  const dispatch = useGeoDispatch();

  const handleToggleDisplay = useCallback(
    (name: string) => dispatch({ type: "TOGGLE_DISPLAY", payload: name }),
    [dispatch],
  );

  const handleGradientClick = useCallback(
    (name: string, e: React.MouseEvent) => {
      if (activeGradientFile === name) {
        e.preventDefault();
        dispatch({ type: "SET_GRADIENT", payload: null });
      } else {
        dispatch({ type: "SET_GRADIENT", payload: name });
      }
    },
    [activeGradientFile, dispatch],
  );

  if (availableFiles.length === 0) return null;

  return (
    <div className="settings-section">
      <label>Map Layers</label>
      <table className="layer-table">
        <tbody>
          {availableFiles.map((file) => (
            <tr key={file.name}>
              <td>{file.displayName}</td>
              <td align="right">
                <input
                  type="checkbox"
                  checked={displayFiles.has(file.name)}
                  onChange={() => handleToggleDisplay(file.name)}
                />
              </td>
              <td align="right">
                <input
                  type="radio"
                  checked={activeGradientFile === file.name}
                  onClick={(e) => handleGradientClick(file.name, e)}
                  onChange={() => {}}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

export const SidebarPanel = memo(function SidebarPanel() {
  const isExpanded = useMenuSlice();
  const dispatch = useGeoDispatch();

  const handleMenuToggle = useCallback(
    () => dispatch({ type: "MENU_TOGGLE" }),
    [dispatch],
  );

  return (
    <div
      id="control-panel"
      className={`map-settings-panel ${isExpanded ? "panel-expanded" : "panel-collapsed"}`}
    >
      <header className="panel-header">
        {isExpanded && <h4>Map Settings</h4>}
        <button onClick={handleMenuToggle} className="icon-button">
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

      {isExpanded && (
        <div className="panel-content">
          <DatasetSection />
          <ColorPickers />
          <LayerTable />
        </div>
      )}
    </div>
  );
});
