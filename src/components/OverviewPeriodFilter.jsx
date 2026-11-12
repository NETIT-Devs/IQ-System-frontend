import { useEffect, useRef, useState } from "react";
import { Calendar, Check, ChevronDown } from "lucide-react";
import { OVERVIEW_PERIOD_OPTIONS } from "../utils/formatters";

const PERIOD_DOT_COLORS = {
  all: "#64748b",
  "1w": "#0ea5e9",
  "1m": "#2563eb",
  "1y": "#7c3aed",
  custom: "#0f766e",
};

const PRESET_PERIOD_OPTIONS = OVERVIEW_PERIOD_OPTIONS.filter(
  (opt) => opt.value !== "custom"
);

function formatShortDate(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return dateStr;
  }
}

export default function OverviewPeriodFilter({
  value = { period: "all", startDate: "", endDate: "" },
  onChange,
}) {
  const normalizedValue =
    typeof value === "string"
      ? { period: value, startDate: "", endDate: "" }
      : {
        period: value?.period || "all",
        startDate: value?.startDate || "",
        endDate: value?.endDate || "",
      };

  const [periodMenuOpen, setPeriodMenuOpen] = useState(false);
  const [customExpanded, setCustomExpanded] = useState(
    normalizedValue.period === "custom"
  );
  const [draftStart, setDraftStart] = useState(normalizedValue.startDate);
  const [draftEnd, setDraftEnd] = useState(normalizedValue.endDate);
  const [customError, setCustomError] = useState("");
  const containerRef = useRef(null);

  useEffect(() => {
    if (!periodMenuOpen) return;

    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setPeriodMenuOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setPeriodMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside, { passive: true });
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [periodMenuOpen]);

  function handleOptionClick(periodValue) {
    setCustomError("");
    if (periodValue === "custom") {
      setDraftStart(normalizedValue.startDate);
      setDraftEnd(normalizedValue.endDate);
      setCustomExpanded((prev) => !prev);
      return;
    }

    setCustomExpanded(false);
    setPeriodMenuOpen(false);
    onChange?.({ period: periodValue, startDate: "", endDate: "" });
  }

  function handleApplyCustom(e) {
    e.preventDefault();
    if (!draftStart && !draftEnd) {
      setCustomError("Select at least a From or To date.");
      return;
    }
    if (draftStart && draftEnd && draftStart > draftEnd) {
      setCustomError("From date cannot be after To date.");
      return;
    }
    setCustomError("");
    onChange?.({
      period: "custom",
      startDate: draftStart,
      endDate: draftEnd,
    });
    setPeriodMenuOpen(false);
  }

  function handleClearCustom() {
    setDraftStart("");
    setDraftEnd("");
    setCustomError("");
    setCustomExpanded(false);
    setPeriodMenuOpen(false);
    onChange?.({ period: "all", startDate: "", endDate: "" });
  }

  let customLabel = "Custom Range";
  if (normalizedValue.period === "custom") {
    if (normalizedValue.startDate && normalizedValue.endDate) {
      customLabel = `${formatShortDate(normalizedValue.startDate)} – ${formatShortDate(
        normalizedValue.endDate
      )}`;
    } else if (normalizedValue.startDate) {
      customLabel = `From ${formatShortDate(normalizedValue.startDate)}`;
    } else if (normalizedValue.endDate) {
      customLabel = `Until ${formatShortDate(normalizedValue.endDate)}`;
    }
  }

  const activePeriodOption = PRESET_PERIOD_OPTIONS.find(
    (opt) => opt.value === normalizedValue.period
  );
  const buttonLabel =
    normalizedValue.period === "custom"
      ? customLabel
      : activePeriodOption
        ? activePeriodOption.label
        : "All Time";

  return (
    <div className="sa-period-filter" ref={containerRef}>
      <div
        className="sa-period-bar"
        role="group"
        aria-label="Filter overview by time period"
      >
        <button
          type="button"
          className={`sa-period-dropdown-btn ${periodMenuOpen ? "open" : ""}`}
          aria-haspopup="listbox"
          aria-expanded={periodMenuOpen}
          onClick={() => {
            if (!periodMenuOpen) {
              setDraftStart(normalizedValue.startDate);
              setDraftEnd(normalizedValue.endDate);
              setCustomExpanded(normalizedValue.period === "custom");
              setCustomError("");
            }
            setPeriodMenuOpen((prev) => !prev);
          }}
        >
          <span className="sa-period-dropdown-btn-left">
            <Calendar size={14} className="sa-period-btn-icon" />
            <span>{buttonLabel}</span>
          </span>
          <ChevronDown
            size={15}
            className={`sa-period-dropdown-chevron ${periodMenuOpen ? "open" : ""}`}
          />
        </button>
      </div>

      {periodMenuOpen && (
        <div
          className="sa-period-dropdown-menu"
          role="listbox"
          aria-label="Filter overview period"
        >
          <div className="sa-period-dropdown-header">
            <span>Filter by Period</span>
          </div>
          <div className="sa-period-dropdown-list">
            {PRESET_PERIOD_OPTIONS.map((opt) => {
              const isSelected = normalizedValue.period === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`sa-period-dropdown-item ${isSelected ? "selected" : ""}`}
                  onClick={() => handleOptionClick(opt.value)}
                >
                  <span className="sa-period-dropdown-item-left">
                    <span
                      className="sa-period-dropdown-dot"
                      style={{
                        backgroundColor: PERIOD_DOT_COLORS[opt.value] || "#64748b",
                      }}
                    />
                    <span className="sa-period-dropdown-item-text">{opt.label}</span>
                  </span>
                  {isSelected && (
                    <Check size={14} className="sa-period-dropdown-check" />
                  )}
                </button>
              );
            })}

            <div className="sa-period-dropdown-divider" />

            <button
              type="button"
              role="option"
              aria-selected={normalizedValue.period === "custom"}
              className={`sa-period-dropdown-item custom-option ${
                normalizedValue.period === "custom" || customExpanded ? "selected" : ""
              }`}
              onClick={() => handleOptionClick("custom")}
            >
              <span className="sa-period-dropdown-item-left">
                <Calendar size={13} className="sa-period-custom-option-icon" />
                <span className="sa-period-dropdown-item-text">Custom Range</span>
              </span>
              {normalizedValue.period === "custom" ? (
                <Check size={14} className="sa-period-dropdown-check" />
              ) : (
                <ChevronDown
                  size={13}
                  className={`sa-period-sub-chevron ${customExpanded ? "open" : ""}`}
                />
              )}
            </button>
          </div>

          {customExpanded && (
            <form
              className="sa-period-custom-inline"
              onSubmit={handleApplyCustom}
              aria-label="Select custom date range"
            >
              <div className="sa-period-custom-fields">
                <label className="sa-period-date-field">
                  <span>From</span>
                  <input
                    type="date"
                    value={draftStart}
                    onChange={(e) => {
                      setDraftStart(e.target.value);
                      setCustomError("");
                    }}
                  />
                </label>

                <label className="sa-period-date-field">
                  <span>To</span>
                  <input
                    type="date"
                    value={draftEnd}
                    min={draftStart || undefined}
                    onChange={(e) => {
                      setDraftEnd(e.target.value);
                      setCustomError("");
                    }}
                  />
                </label>
              </div>

              {customError && (
                <p className="sa-period-custom-error" role="alert">
                  {customError}
                </p>
              )}

              <div className="sa-period-custom-actions">
                {normalizedValue.period === "custom" && (
                  <button
                    type="button"
                    className="sa-period-reset-link"
                    onClick={handleClearCustom}
                  >
                    Reset
                  </button>
                )}
                <div className="sa-period-action-group">
                  <button
                    type="button"
                    className="sa-period-cancel-btn"
                    onClick={() => setPeriodMenuOpen(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="sa-period-apply-btn">
                    Apply
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
