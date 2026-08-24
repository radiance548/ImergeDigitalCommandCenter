import assert from "node:assert/strict";
import { describe, test } from "./harness";
import { LocalStorageRepository } from "../src/lib/repository/localStorageRepository";
import { SEED_USERS } from "../src/lib/demoData";

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
  test("generates demo data with all seed users present when storage is empty", async () => {
    installFakeWindow();
    const repo = new LocalStorageRepository();
    const data = await repo.load();

    for (const seedUser of SEED_USERS) {
      const found = data.users.find((u) => u.email.toLowerCase() === seedUser.email.toLowerCase());
      assert.ok(found, `seed user ${seedUser.email} should be present after first load`);
    }
  });

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

describe("LocalStorageRepository: reconcileUsers self-healing", () => {
  test("re-adds the admin account if it was deleted from storage entirely", async () => {
    installFakeWindow();
    const repo = new LocalStorageRepository();
    const data = await repo.load();
    data.users = data.users.filter((u) => u.id !== "admin");
    await repo.save(data);

    const reloaded = await repo.load();
    const admin = reloaded.users.find((u) => u.id === "admin");
    assert.ok(admin, "admin account should be restored on next load");
    assert.equal(admin!.permissions.settings, "full");
  });

  test("forcibly restores admin's full permissions even if they were tampered with", async () => {
    installFakeWindow();
    const repo = new LocalStorageRepository();
    const data = await repo.load();
    const admin = data.users.find((u) => u.id === "admin")!;
    admin.permissions = { ...admin.permissions, settings: "none", income: "view" };
    await repo.save(data);

    const reloaded = await repo.load();
    const reloadedAdmin = reloaded.users.find((u) => u.id === "admin")!;
    assert.equal(reloadedAdmin.permissions.settings, "full");
    assert.equal(reloadedAdmin.permissions.income, "full");
  });

  test("does NOT clobber a non-admin user's custom password with the seed default", async () => {
    installFakeWindow();
    const repo = new LocalStorageRepository();
    const data = await repo.load();
    const esther = data.users.find((u) => u.id === "esther")!;
    esther.password = "MyOwnNewPassword1";
    await repo.save(data);

    const reloaded = await repo.load();
    const reloadedEsther = reloaded.users.find((u) => u.id === "esther")!;
    assert.equal(reloadedEsther.password, "MyOwnNewPassword1");
  });

  test("fills in a missing department with a sane default rather than leaving it falsy", async () => {
    installFakeWindow();
    const repo = new LocalStorageRepository();
    const data = await repo.load();
    data.users.push({
      id: "custom_1",
      name: "Custom Staffer",
      email: "custom1@example.com",
      role: "Staff",
      department: "",
      isActive: true,
      password: "",
      permissions: { income: "view", marketing: "view", health: "none", clients: "view", pipeline: "view", ltv: "view", settings: "none" },
    });
    await repo.save(data);

    const reloaded = await repo.load();
    const custom = reloaded.users.find((u) => u.id === "custom_1")!;
    assert.equal(custom.department, "General");
    assert.equal(custom.password, "Staff123");
  });

  test("normalizes email casing to lowercase on every load", async () => {
    installFakeWindow();
    const repo = new LocalStorageRepository();
    const data = await repo.load();
    const esther = data.users.find((u) => u.id === "esther")!;
    const originalEmail = esther.email;
    esther.email = `  ${originalEmail.toUpperCase()}  `;
    await repo.save(data);

    const reloaded = await repo.load();
    const reloadedEsther = reloaded.users.find((u) => u.id === "esther")!;
    assert.equal(reloadedEsther.email, originalEmail.toLowerCase());
  });

  test("an explicitly deactivated non-admin user stays deactivated across reloads", async () => {
    installFakeWindow();
    const repo = new LocalStorageRepository();
    const data = await repo.load();
    const esther = data.users.find((u) => u.id === "esther")!;
    esther.isActive = false;
    await repo.save(data);

    const reloaded = await repo.load();
    const reloadedEsther = reloaded.users.find((u) => u.id === "esther")!;
    assert.equal(reloadedEsther.isActive, false);
  });
});

describe("LocalStorageRepository: session + theme", () => {
  test("getSessionUserId returns null when nothing has been set", async () => {
    installFakeWindow();
    const repo = new LocalStorageRepository();
    assert.equal(await repo.getSessionUserId(), null);
  });

  test("setSessionUserId/getSessionUserId round-trip", async () => {
    installFakeWindow();
    const repo = new LocalStorageRepository();
    await repo.setSessionUserId("admin");
    assert.equal(await repo.getSessionUserId(), "admin");
  });

  test("setSessionUserId(null) clears the session", async () => {
    installFakeWindow();
    const repo = new LocalStorageRepository();
    await repo.setSessionUserId("admin");
    await repo.setSessionUserId(null);
    assert.equal(await repo.getSessionUserId(), null);
  });

  test("getTheme defaults to 'light' when unset", async () => {
    installFakeWindow();
    const repo = new LocalStorageRepository();
    assert.equal(await repo.getTheme(), "light");
  });

  test("setTheme/getTheme round-trip", async () => {
    installFakeWindow();
    const repo = new LocalStorageRepository();
    await repo.setTheme("dark");
    assert.equal(await repo.getTheme(), "dark");
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
