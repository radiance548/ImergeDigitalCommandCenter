import { DEFAULT_STAFF_PERMISSIONS } from "../constants";
import { generateDemoData, SEED_USERS } from "../demoData";
import type { AppData } from "../types";
import { normalizeEmail } from "../utils";
import type { DataRepository } from "./types";

const DB_KEY = "imerge_command_center_v6_final_settings";
const THEME_KEY = "imerge_command_center_theme";
const USER_KEY = "imerge_command_center_current_user_v6";

function isBrowser() {
  return typeof window !== "undefined";
}

/** Ensures required seed users exist and every user record has sane defaults. */
function reconcileUsers(data: AppData): AppData {
  data.users = data.users || [];

  SEED_USERS.forEach((required) => {
    const email = normalizeEmail(required.email);
    const existing = data.users.find(
      (u) => normalizeEmail(u.email) === email || u.id === required.id
    );
    if (!existing) {
      data.users.push({ ...required, permissions: { ...required.permissions } });
    } else if (required.id === "admin") {
      Object.assign(existing, required, { permissions: { ...required.permissions } });
    } else {
      existing.id = existing.id || required.id;
      existing.name = existing.name || required.name;
      existing.email = email;
      existing.role = existing.role || required.role;
      existing.department = existing.department || required.department;
      existing.isActive = existing.isActive !== false;
      existing.password = existing.password || required.password;
      existing.permissions = existing.permissions || { ...required.permissions };
    }
  });

  data.users.forEach((u) => {
    u.email = normalizeEmail(u.email);
    u.isActive = u.isActive !== false;
    u.department = u.department || "General";
    u.password = u.password || "Staff123";
    u.permissions = u.permissions || { ...DEFAULT_STAFF_PERMISSIONS };
  });

  return data;
}

export class LocalStorageRepository implements DataRepository {
  async load(): Promise<AppData> {
    if (!isBrowser()) {
      // SSR-safe fallback; real hydration happens client-side.
      return generateDemoData();
    }
    const raw = window.localStorage.getItem(DB_KEY);
    let data: AppData = raw ? JSON.parse(raw) : generateDemoData();
    data = reconcileUsers(data);
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

  async getSessionUserId(): Promise<string | null> {
    if (!isBrowser()) return null;
    return window.localStorage.getItem(USER_KEY);
  }

  async setSessionUserId(userId: string | null): Promise<void> {
    if (!isBrowser()) return;
    if (userId) window.localStorage.setItem(USER_KEY, userId);
    else window.localStorage.removeItem(USER_KEY);
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
