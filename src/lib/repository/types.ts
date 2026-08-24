import type { AppData } from "../types";

/**
 * DataRepository is the single seam between the UI and wherever the data
 * actually lives. Every method is async on purpose: the current
 * implementation (LocalStorageRepository) resolves instantly, but a real
 * integration (REST API, Supabase, Postgres via a server action, etc.)
 * will need real network calls here without touching any component code.
 *
 * To integrate a real service:
 *   1. Create a new class implementing this interface (e.g. ApiRepository)
 *      in this folder, calling `fetch()` against your backend.
 *   2. Swap the export in `./index.ts` to use it instead of
 *      LocalStorageRepository.
 *   3. Everything else (store, hooks, views) keeps working unchanged.
 */
export interface DataRepository {
  /** Load the full application dataset, seeding demo data on first run. */
  load(): Promise<AppData>;
  /** Persist the full application dataset. */
  save(data: AppData): Promise<void>;
  /** Replace all data with freshly generated demo data. */
  resetToDemoData(): Promise<AppData>;

  /** Session: which staff user id is currently logged in (if any). */
  getSessionUserId(): Promise<string | null>;
  setSessionUserId(userId: string | null): Promise<void>;

  /** Theme preference persistence. */
  getTheme(): Promise<"light" | "dark">;
  setTheme(theme: "light" | "dark"): Promise<void>;
}
