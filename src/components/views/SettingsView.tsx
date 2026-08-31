"use client";

import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { useSyncExportRows } from "@/hooks/useSyncExportRows";
import { NAV_ITEMS, STAFF_ROLE_LABELS } from "@/lib/constants";
import type { DashboardId, Permission, StaffRole } from "@/lib/types";

const CURRENCIES = ["$", "€", "£", "₦", "₮"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const PERMISSION_LEVELS: Permission[] = ["none", "view", "edit", "full"];
const ASSIGNABLE_ROLES: Exclude<StaffRole, "SUPER_ADMIN">[] = ["CEO", "SOCIAL_MEDIA_AD_MANAGER"];
// dedupe: Campaign Builder shares the "marketing" id with Marketing
// Activity (see constants.ts), and this table has one column per
// permission dimension, not per nav link.
const ROUTES = Array.from(new Set(NAV_ITEMS.map((n) => n.id)));

interface StaffRow {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  isActive: boolean;
  permissionMap: Partial<Record<DashboardId, Permission>>;
}

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

  const [staff, setStaff] = useState<StaffRow[] | null>(null);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);
  const [staffNotice, setStaffNotice] = useState<string | null>(null);

  const settingsFormRef = useRef<HTMLDivElement>(null);
  const categoryBudgetsRef = useRef<HTMLDivElement>(null);
  const passwordFormRef = useRef<HTMLDivElement>(null);
  const newStaffFormRef = useRef<HTMLDivElement>(null);
  const staffTableRef = useRef<HTMLTableSectionElement>(null);

  const loadStaff = () => {
    fetch("/api/staff")
      .then((r) => r.json())
      .then((body) => setStaff(body.staff || []))
      .catch(() => setStaff([]));
  };

  useEffect(() => {
    if (isAdmin) loadStaff();
  }, [isAdmin]);

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
    const role = (el.querySelector("#newUserRole") as HTMLSelectElement).value as Exclude<StaffRole, "SUPER_ADMIN">;
    const result = await addStaffUser({ name, email, password, role });
    setStaffNotice(result.ok ? "Staff account saved." : result.message || "Could not save staff account.");
    if (result.ok) loadStaff();
    setTimeout(() => setStaffNotice(null), 3000);
  };

  const handleDeleteStaff = async (userId: string) => {
    await deleteStaffUser(userId);
    loadStaff();
  };

  const handleSaveAllStaff = async () => {
    const tbody = staffTableRef.current;
    if (!tbody) return;
    const updates: Parameters<typeof saveAllStaffSettings>[0] = {};
    tbody.querySelectorAll<HTMLTableRowElement>("[data-user-row]").forEach((row) => {
      const userId = row.dataset.userRow;
      if (!userId) return;
      const role = (row.querySelector('[data-field="role"]') as HTMLSelectElement)?.value as
        | Exclude<StaffRole, "SUPER_ADMIN">
        | undefined;
      const isActive = (row.querySelector('[data-field="isActive"]') as HTMLSelectElement)?.value === "active";
      const permissions: Partial<Record<DashboardId, Permission>> = {};
      row.querySelectorAll<HTMLSelectElement>("[data-permission]").forEach((select) => {
        const route = select.dataset.permission as DashboardId;
        permissions[route] = select.value as Permission;
      });
      updates[userId] = { role, isActive, permissions };
    });
    await saveAllStaffSettings(updates);
    loadStaff();
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
            <input id="newPassword" type="password" placeholder="At least 8 characters" />
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
                <label>Initial Password</label>
                <input id="newUserPassword" type="text" placeholder="At least 8 characters" />
              </div>
              <div className="field">
                <label>Role</label>
                <select id="newUserRole" defaultValue={ASSIGNABLE_ROLES[0]}>
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {STAFF_ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
              <button className="btn primary" onClick={handleAddStaff}>
                Create Staff
              </button>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
              <button className="btn success" onClick={handleSaveAllStaff}>
                Save All Staff Settings
              </button>
              {staffNotice && <span style={{ color: "var(--success)", fontWeight: 900 }}>{staffNotice}</span>}
            </div>

            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  {ROUTES.map((r) => (
                    <th key={r}>{r}</th>
                  ))}
                  <th>Action</th>
                </tr>
              </thead>
              <tbody ref={staffTableRef}>
                {(staff || []).map((u) => {
                  const isSuperAdmin = u.role === "SUPER_ADMIN";
                  return (
                    <tr data-user-row={u.id} key={u.id}>
                      <td>
                        <strong>{u.name}</strong>
                        <br />
                        <span style={{ color: "var(--muted)", fontSize: 12 }}>{u.email}</span>
                      </td>
                      <td>
                        {isSuperAdmin ? (
                          STAFF_ROLE_LABELS[u.role]
                        ) : (
                          <select data-field="role" defaultValue={u.role}>
                            {ASSIGNABLE_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {STAFF_ROLE_LABELS[r]}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td>
                        {isSuperAdmin ? (
                          <span className="badge good">Protected</span>
                        ) : (
                          <select data-field="isActive" defaultValue={u.isActive !== false ? "active" : "inactive"}>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        )}
                      </td>
                      {ROUTES.map((r) => (
                        <td key={r}>
                          <select data-permission={r} defaultValue={u.permissionMap?.[r] || "none"} disabled={isSuperAdmin}>
                            {PERMISSION_LEVELS.map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                        </td>
                      ))}
                      <td>
                        {isSuperAdmin ? (
                          <span className="badge good">Owner</span>
                        ) : (
                          <button className="btn danger" onClick={() => handleDeleteStaff(u.id)}>
                            Deactivate
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p style={{ color: "var(--muted)", fontWeight: 700, marginBottom: 0 }}>
              Change any dropdowns, then click Save All Staff Settings. Staff should log out and log back in to see new
              dashboard access.
            </p>
          </>
        ) : (
          <p style={{ color: "var(--muted)", fontWeight: 700 }}>Only the Super Admin can manage users and dashboard permissions.</p>
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
        Logged in as <strong>{currentUser?.name}</strong> ({currentUser && STAFF_ROLE_LABELS[currentUser.role]})
      </p>
    </>
  );
}
