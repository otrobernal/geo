/* eslint-disable @typescript-eslint/no-explicit-any */
import "./css/SidebarPanel.css";

interface SidebarProps {
  isExpanded: boolean;
  onToggle: () => void;
  zipInput: string;
  onZipInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onZipSubmit: (e: React.FormEvent) => void;
  isScreenshotMode: boolean;
  onScreenshotToggle: () => void;
  onCapture: () => void;
  isCapturing: boolean;
  hasSelection: boolean;
  colors: { base: string; min: string; max: string };
  onColorChange: (key: string, value: string) => void;
  files: any[];
  displaySet: Set<string>;
  onToggleDisplay: (name: string) => void;
  gradientFile: string | null;
  onGradientChange: (name: string, e: any) => void;
}

export function SidebarPanel(props: SidebarProps) {
  const { isExpanded, onToggle, isScreenshotMode } = props;

  return (
    <div
      className={`map-settings-panel ${isExpanded ? "panel-expanded" : "panel-collapsed"}`}
    >
      <header className="panel-header">
        {isExpanded && <h4>Map Settings</h4>}
        <button onClick={onToggle} className="icon-button">
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
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
      </header>

      {isExpanded && (
        <div className="panel-content">
          <div className="settings-section">
            <label>Dataset</label>
            <div className="input-row">
              <input
                className="text-input"
                value={props.zipInput}
                onChange={props.onZipInputChange}
              />
              <button className="primary-button" onClick={props.onZipSubmit}>
                Load
              </button>
            </div>
          </div>

          <div className="settings-section">
            <label>Capture</label>
            <button
              className={`secondary-button ${isScreenshotMode ? "danger-button" : ""}`}
              onClick={props.onScreenshotToggle}
            >
              {isScreenshotMode ? "Cancel" : "Select area"}
            </button>
            {isScreenshotMode && (
              <button
                className="primary-button"
                onClick={props.onCapture}
                disabled={props.isCapturing || !props.hasSelection}
              >
                {props.isCapturing ? "Capturing..." : "Take screen capture"}
              </button>
            )}
          </div>

          <div className="settings-section">
            <label>Theme Colors</label>
            {Object.entries(props.colors).map(([key, value]) => (
              <div key={key} className="color-row">
                <span>{key}</span>
                <input
                  type="color"
                  className="color-picker-input"
                  value={value}
                  onChange={(e) => props.onColorChange(key, e.target.value)}
                />
              </div>
            ))}
          </div>

          <div className="settings-section">
            <label>Map Layers</label>
            <table className="layer-table">
              <tbody>
                {props.files.map((file) => (
                  <tr key={file.name}>
                    <td>{file.displayName}</td>
                    <td align="right">
                      <input
                        type="checkbox"
                        checked={props.displaySet.has(file.name)}
                        onChange={() => props.onToggleDisplay(file.name)}
                      />
                    </td>
                    <td align="right">
                      <input
                        type="radio"
                        checked={props.gradientFile === file.name}
                        onClick={(e) => props.onGradientChange(file.name, e)}
                        onChange={() => {}}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
