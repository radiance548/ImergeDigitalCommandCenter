import { useEffect } from "react";
import { useUIStore } from "@/store/useUIStore";

export function useSyncExportRows<T extends object>(rows: T[]) {
  const setExportRows = useUIStore((s) => s.setExportRows);
  useEffect(() => {
    setExportRows(rows as unknown as Record<string, unknown>[]);
  }, [rows, setExportRows]);
}
