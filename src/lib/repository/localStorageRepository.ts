import { generateDemoData } from "../demoData";
import type { AppData } from "../types";
import type { DataRepository } from "./types";

const DB_KEY = "imerge_command_center_v6_final_settings";
const THEME_KEY = "imerge_command_center_theme";

function isBrowser() {
  return typeof window !== "undefined";
}

export class LocalStorageRepository implements DataRepository {
  async load(): Promise<AppData> {
    if (!isBrowser()) {
      // SSR-safe fallback; real hydration happens client-side.
      return generateDemoData();
    }
    const raw = window.localStorage.getItem(DB_KEY);
    const data: AppData = raw ? JSON.parse(raw) : generateDemoData();
    this.persist(data);
    return data;
  }

  async save(data: AppData): Promise<void> {
    this.persist(data);
  }

  async resetToDemoData(): Promise<AppData> {
    const data = generateDemoData();
    this.persist(data);
    return data;
  }

  async getTheme(): Promise<"light" | "dark"> {
    if (!isBrowser()) return "dark";
    return (window.localStorage.getItem(THEME_KEY) as "light" | "dark") || "dark";
  }

  async setTheme(theme: "light" | "dark"): Promise<void> {
    if (!isBrowser()) return;
    window.localStorage.setItem(THEME_KEY, theme);
  }

  private persist(data: AppData) {
    if (!isBrowser()) return;
    window.localStorage.setItem(DB_KEY, JSON.stringify(data));
  }
}
