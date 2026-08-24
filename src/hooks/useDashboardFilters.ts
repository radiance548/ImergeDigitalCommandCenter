import { useState } from "react";
import type { DateRangeKey, VisualFilters } from "@/lib/types";

export function useDashboardFilters(defaultRange: DateRangeKey = "last90") {
  const [range, setRange] = useState<DateRangeKey>(defaultRange);
  const [filterValues, setFilterValues] = useState<Record<string, string | undefined>>({});
  const [visualFilters, setVisualFilters] = useState<VisualFilters>({});

  const setFilterValue = (key: string, value: string) => {
    setFilterValues((prev) => ({ ...prev, [key]: value || undefined }));
  };

  const addVisualFilter = (key: string, value: string) => {
    setVisualFilters((prev) => ({ ...prev, [key]: value }));
  };

  const removeVisualFilter = (key: string) => {
    setVisualFilters((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const clearVisualFilters = () => setVisualFilters({});

  return {
    range,
    setRange,
    filterValues,
    setFilterValue,
    visualFilters,
    addVisualFilter,
    removeVisualFilter,
    clearVisualFilters,
  };
}
