"use client";

import { DATE_RANGE_OPTIONS } from "@/lib/utils";
import type { DateRangeKey, VisualFilters } from "@/lib/types";

export interface FilterDef {
  key: string;
  label: string;
  options: string[];
}

interface FilterBarProps {
  range: DateRangeKey;
  onRangeChange: (value: DateRangeKey) => void;
  filters?: FilterDef[];
  values: Record<string, string | undefined>;
  onFilterChange: (key: string, value: string) => void;
  visualFilters: VisualFilters;
  onRemoveVisualFilter: (key: string) => void;
  onClearVisualFilters: () => void;
}

export default function FilterBar({
  range,
  onRangeChange,
  filters = [],
  values,
  onFilterChange,
  visualFilters,
  onRemoveVisualFilter,
  onClearVisualFilters,
}: FilterBarProps) {
  const chips = Object.entries(visualFilters).filter(([, v]) => v !== undefined);

  return (
    <>
      <div className="filter-bar">
        <div className="field">
          <label>Date Range</label>
          <select value={range} onChange={(e) => onRangeChange(e.target.value as DateRangeKey)}>
            {DATE_RANGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {filters.map((f) => (
          <div className="field" key={f.key}>
            <label>{f.label}</label>
            <select value={values[f.key] || ""} onChange={(e) => onFilterChange(f.key, e.target.value)}>
              <option value="">All</option>
              {f.options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
        ))}
        <div className="field">
          <label>Visual Filters</label>
          <button className="btn" style={{ width: "100%" }} onClick={onClearVisualFilters}>
            Clear visual filters
          </button>
        </div>
      </div>
      {chips.length > 0 && (
        <div className="chips">
          {chips.map(([k, v]) => (
            <span className="chip" key={k}>
              {k}: {v}
              <button onClick={() => onRemoveVisualFilter(k)}>×</button>
            </span>
          ))}
        </div>
      )}
    </>
  );
}
