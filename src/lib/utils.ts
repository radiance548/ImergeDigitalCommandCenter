import type { DateRangeKey } from "./types";

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

export function dateISO(d: string | number | Date): string {
  return new Date(d).toISOString().slice(0, 10);
}

export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dateISO(d);
}

export function rand(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min));
}

export function choice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, item) => {
    const key = keyFn(item);
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});
}

export function sum<T>(arr: T[], key: keyof T | ((item: T) => number)): number {
  return arr.reduce((a, b) => {
    const v = typeof key === "function" ? key(b) : (b[key] as unknown as number);
    return a + Number(v || 0);
  }, 0);
}

export function monthKey(date: string | number | Date): string {
  return dateISO(date).slice(0, 7);
}

export function sanitizeFileName(name: string): string {
  return String(name || "chart")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function money(currency: string, n: number | undefined): string {
  return `${currency}${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function pct(n: number | undefined): string {
  return `${Number(n || 0).toFixed(1)}%`;
}

export function normalizeEmail(email: string | undefined): string {
  return String(email || "").trim().toLowerCase();
}

/** Filters an array of date-bearing records to the given top-level date range. */
export function getDateFiltered<T extends Record<string, any>>(
  records: T[],
  range: DateRangeKey | undefined,
  dateField: string = "date"
): T[] {
  const today = new Date();
  let from = new Date(daysAgo(89));
  const to = today;

  if (range === "last7") from = new Date(daysAgo(6));
  if (range === "last30") from = new Date(daysAgo(29));
  if (range === "month") from = new Date(today.getFullYear(), today.getMonth(), 1);
  if (range === "last3") from = new Date(daysAgo(89));

  return records.filter((r) => {
    const d = new Date(r[dateField]);
    return d >= from && d <= to;
  });
}

export const DATE_RANGE_OPTIONS: { value: DateRangeKey; label: string }[] = [
  { value: "last7", label: "Last 7 days" },
  { value: "last30", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "last3", label: "Last 3 months" },
  { value: "last90", label: "Last 90 days" },
];
