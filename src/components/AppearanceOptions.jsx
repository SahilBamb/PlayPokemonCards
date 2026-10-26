import "./appearance.css";
import { APPEARANCES } from "../lib/appearance.js";

export function AppearanceOptions({ value, onChange, classic = false }) {
  return (
    <div className={`appearance-options ${classic ? "classic" : ""}`}>
      <span className="appearance-label">Appearance</span>
      <div role="group" aria-label="Appearance">
        {APPEARANCES.map((mode) => (
          <button
            key={mode}
            onClick={() => onChange(mode)}
            aria-label={`${mode[0].toUpperCase() + mode.slice(1)} appearance`}
            aria-pressed={value === mode}
          >
            {mode[0].toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}
