import assert from "node:assert/strict";
import { describe, test } from "./harness";
import { LocalStorageRepository } from "../src/lib/repository/localStorageRepository";

// --- minimal in-memory localStorage polyfill ---
// LocalStorageRepository checks `typeof window !== "undefined"` inside each
// method (not at module load time), so it's enough to install this before
// each test calls into the repository — no import-order tricks needed.
class FakeStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

function installFakeWindow(): FakeStorage {
  const storage = new FakeStorage();
  (globalThis as unknown as { window: unknown }).window = { localStorage: storage };
  return storage;
}

describe("LocalStorageRepository: first load", () => {
  test("persists the generated data so a second load reads the same dataset back", async () => {
    installFakeWindow();
    const repo = new LocalStorageRepository();
    const first = await repo.load();
    const second = await repo.load();
    assert.equal(first.transactions.length, second.transactions.length);
    assert.deepEqual(
      first.transactions.map((t) => t.id),
      second.transactions.map((t) => t.id)
    );
  });
});

describe("LocalStorageRepository: session + theme", () => {
  test("getTheme defaults to 'dark' when unset", async () => {
    installFakeWindow();
    const repo = new LocalStorageRepository();
    assert.equal(await repo.getTheme(), "dark");
  });

  test("setTheme/getTheme round-trip", async () => {
    installFakeWindow();
    const repo = new LocalStorageRepository();
    await repo.setTheme("light");
    assert.equal(await repo.getTheme(), "light");
  });
});

describe("LocalStorageRepository: resetToDemoData", () => {
  test("produces a fresh dataset and persists it", async () => {
    installFakeWindow();
    const repo = new LocalStorageRepository();
    await repo.load();
    const reset = await repo.resetToDemoData();
    const reloaded = await repo.load();
    assert.deepEqual(
      reset.transactions.map((t) => t.id),
      reloaded.transactions.map((t) => t.id)
    );
  });
});
