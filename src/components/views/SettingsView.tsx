"use client";

import { useRef, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { useSyncExportRows } from "@/hooks/useSyncExportRows";
import { NAV_ITEMS } from "@/lib/constants";
import type { DashboardId, Permission } from "@/lib/types";

const CURRENCIES = ["$", "€", "£", "₦", "₮"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const PERMISSION_LEVELS: Permission[] = ["none", "view", "edit", "full"];
const ROUTES = NAV_ITEMS.map((n) => n.id);

export default function SettingsView() {
  const data = useAppStore((s) => s.data);
  const isAdmin = useAppStore((s) => s.isAdmin());
  const currentUser = useAppStore((s) => s.currentUser());
  const saveSettings = useAppStore((s) => s.saveSettings);
  const changeMyPassword = useAppStore((s) => s.changeMyPassword);
  const addStaffUser = useAppStore((s) => s.addStaffUser);
  const deleteStaffUser = useAppStore((s) => s.deleteStaffUser);
  const saveAllStaffSettings = useAppStore((s) => s.saveAllStaffSettings);

  useSyncExportRows(data ? [data.settings] : []);

  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);
  const [staffNotice, setStaffNotice] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState(false);

  const settingsFormRef = useRef<HTMLDivElement>(null);
  const categoryBudgetsRef = useRef<HTMLDivElement>(null);
  const passwordFormRef = useRef<HTMLDivElement>(null);
  const newStaffFormRef = useRef<HTMLDivElement>(null);
  const staffTableRef = useRef<HTMLTableSectionElement>(null);

  if (!data) return null;
  const s = data.settings;

  const handleSaveSettings = async () => {
    const el = settingsFormRef.current;
    if (!el) return;
    const currency = (el.querySelector("#setCurrency") as HTMLSelectElement).value;
    const fiscalStartMonth = (el.querySelector("#setFiscal") as HTMLSelectElement).value;
    const hourlyCost = Number((el.querySelector("#setHourly") as HTMLInputElement).value);
    const targetLtvCac = Number((el.querySelector("#setRatio") as HTMLInputElement).value);
    const monthlyBudget = Number((el.querySelector("#setBudget") as HTMLInputElement).value);
    const categoryBudgets = { ...s.categoryBudgets };
    categoryBudgetsRef.current?.querySelectorAll<HTMLInputElement>(".catBudget").forEach((input) => {
      const cat = input.dataset.cat;
      if (cat) categoryBudgets[cat] = Number(input.value);
    });
    await saveSettings({ currency, fiscalStartMonth, hourlyCost, targetLtvCac, monthlyBudget, categoryBudgets });
  };

  const handleChangePassword = async () => {
    const el = passwordFormRef.current;
    if (!el) return;
    const current = (el.querySelector("#currentPassword") as HTMLInputElement).value;
    const next = (el.querySelector("#newPassword") as HTMLInputElement).value;
    const result = await changeMyPassword(current, next);
    setPasswordNotice(result.ok ? "Password updated." : result.message || "Could not update password.");
    if (result.ok) {
      (el.querySelector("#currentPassword") as HTMLInputElement).value = "";
      (el.querySelector("#newPassword") as HTMLInputElement).value = "";
    }
    setTimeout(() => setPasswordNotice(null), 3000);
  };

  const handleAddStaff = async () => {
    const el = newStaffFormRef.current;
    if (!el) return;
    const name = (el.querySelector("#newUserName") as HTMLInputElement).value.trim();
    const email = (el.querySelector("#newUserEmail") as HTMLInputElement).value.trim();
    const password = (el.querySelector("#newUserPassword") as HTMLInputElement).value.trim();
    const department = (el.querySelector("#newUserDept") as HTMLInputElement).value.trim();
    const role = (el.querySelector("#newUserRole") as HTMLInputElement).value.trim();
    const result = await addStaffUser({ name, email, password, department, role });
    setStaffNotice(result.ok ? "Staff account saved." : result.message || "Could not save staff account.");
    setTimeout(() => setStaffNotice(null), 3000);
  };

  const handleSaveAllStaff = async () => {
    const tbody = staffTableRef.current;
    if (!tbody) return;
    const updates: Parameters<typeof saveAllStaffSettings>[0] = {};
    tbody.querySelectorAll<HTMLTableRowElement>("[data-user-row]").forEach((row) => {
      const userId = row.dataset.userRow;
      if (!userId || userId === "admin") return;
      const role = (row.querySelector('[data-field="role"]') as HTMLInputElement)?.value;
      const department = (row.querySelector('[data-field="department"]') as HTMLInputElement)?.value;
      const password = (row.querySelector('[data-field="password"]') as HTMLInputElement)?.value;
      const isActive = (row.querySelector('[data-field="isActive"]') as HTMLSelectElement)?.value === "active";
      const permissions: Partial<Record<DashboardId, Permission>> = {};
      row.querySelectorAll<HTMLSelectElement>("[data-permission]").forEach((select) => {
        const route = select.dataset.permission as DashboardId;
        permissions[route] = select.value as Permission;
      });
      updates[userId] = { role, department, password, isActive, permissions };
    });
    await saveAllStaffSettings(updates);
    setStaffNotice("Saved all staff settings.");
    setTimeout(() => setStaffNotice(null), 2500);
  };

  return (
    <>
      <div className="panel-card" ref={settingsFormRef}>
        <h3>Global Settings</h3>
        <div className="form-grid">
          <div className="field">
            <label>Currency</label>
            <select id="setCurrency" defaultValue={s.currency}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Fiscal Year Start</label>
            <select id="setFiscal" defaultValue={s.fiscalStartMonth}>
              {MONTHS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Default Hourly Cost</label>
            <input id="setHourly" type="number" defaultValue={s.hourlyCost} />
          </div>
          <div className="field">
            <label>Target LTV:CAC</label>
            <input id="setRatio" type="number" defaultValue={s.targetLtvCac} />
          </div>
          <div className="field">
            <label>Monthly Budget</label>
            <input id="setBudget" type="number" defaultValue={s.monthlyBudget} />
          </div>
          <button className="btn primary" onClick={handleSaveSettings}>
            Save Settings
          </button>
        </div>
      </div>

      <div className="panel-card" style={{ marginTop: 16 }} ref={passwordFormRef}>
        <h3>Change My Password</h3>
        {passwordNotice && <p style={{ color: "var(--success)", fontWeight: 800 }}>{passwordNotice}</p>}
        <div className="form-grid">
          <div className="field">
            <label>Current Password</label>
            <input id="currentPassword" type="password" />
          </div>
          <div className="field">
            <label>New Password</label>
            <input id="newPassword" type="password" />
          </div>
          <button className="btn primary" onClick={handleChangePassword}>
            Update Password
          </button>
        </div>
      </div>

      <div className="panel-card" style={{ marginTop: 16 }}>
        <h3>User Access &amp; Permissions</h3>
        {isAdmin ? (
          <>
            <div className="form-grid" style={{ marginBottom: 16 }} ref={newStaffFormRef}>
              <div className="field">
                <label>Staff Name</label>
                <input id="newUserName" placeholder="e.g. Sarah" />
              </div>
              <div className="field">
                <label>Staff Email</label>
                <input id="newUserEmail" type="email" placeholder="name@gmail.com" />
              </div>
              <div className="field">
                <label>Password</label>
                <input id="newUserPassword" type="text" placeholder="Create password" />
              </div>
              <div className="field">
                <label>Department</label>
                <input id="newUserDept" defaultValue="General" />
              </div>
              <div className="field">
                <label>Role Name</label>
                <input id="newUserRole" defaultValue="General Staff" />
              </div>
              <button className="btn primary" onClick={handleAddStaff}>
                Create Staff
              </button>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
              <button className="btn success" onClick={handleSaveAllStaff}>
                Save All Staff Settings
              </button>
              <button className="btn" onClick={() => setShowPasswords((v) => !v)}>
                Show/Hide All Passwords
              </button>
              {staffNotice && <span style={{ color: "var(--success)", fontWeight: 900 }}>{staffNotice}</span>}
            </div>

            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role / Dept.</th>
                  <th>Password</th>
                  <th>Status</th>
                  {ROUTES.map((r) => (
                    <th key={r}>{r}</th>
                  ))}
                  <th>Action</th>
                </tr>
              </thead>
              <tbody ref={staffTableRef}>
                {data.users.map((u) => (
                  <tr data-user-row={u.id} key={u.id}>
                    <td>
                      <strong>{u.name}</strong>
                      <br />
                      <span style={{ color: "var(--muted)", fontSize: 12 }}>{u.email}</span>
                    </td>
                    <td>
                      <input data-field="role" defaultValue={u.role || ""} disabled={u.id === "admin"} />
                      <input data-field="department" style={{ marginTop: 6 }} defaultValue={u.department || ""} disabled={u.id === "admin"} />
                    </td>
                    <td>
                      {u.id === "admin" ? (
                        <span className="badge good">Protected</span>
                      ) : (
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <input data-field="password" className="staff-pass" type={showPasswords ? "text" : "password"} defaultValue={u.password || ""} />
                        </div>
                      )}
                    </td>
                    <td>
                      <select data-field="isActive" defaultValue={u.isActive !== false ? "active" : "inactive"} disabled={u.id === "admin"}>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </td>
                    {ROUTES.map((r) => (
                      <td key={r}>
                        <select data-permission={r} defaultValue={u.permissions?.[r] || "none"} disabled={u.id === "admin"}>
                          {PERMISSION_LEVELS.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </td>
                    ))}
                    <td>
                      {u.id === "admin" ? (
                        <span className="badge good">Owner</span>
                      ) : (
                        <button className="btn danger" onClick={() => deleteStaffUser(u.id)}>
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ color: "var(--muted)", fontWeight: 700, marginBottom: 0 }}>
              Change any dropdowns, then click Save All Staff Settings. Staff should log out and log back in to see new
              dashboard access.
            </p>
          </>
        ) : (
          <p style={{ color: "var(--muted)", fontWeight: 700 }}>Only admin can manage users and dashboard permissions.</p>
        )}
      </div>

      <div className="panel-card" style={{ marginTop: 16 }}>
        <h3>Expense Category Budgets</h3>
        <div className="form-grid" ref={categoryBudgetsRef}>
          {Object.entries(s.categoryBudgets).map(([k, v]) => (
            <div className="field" key={k}>
              <label>{k}</label>
              <input className="catBudget" data-cat={k} type="number" defaultValue={v} />
            </div>
          ))}
        </div>
      </div>

      <p style={{ color: "var(--muted)", fontSize: 12 }}>
        Logged in as <strong>{currentUser?.name}</strong> ({currentUser?.role})
      </p>
    </>
  );
}
