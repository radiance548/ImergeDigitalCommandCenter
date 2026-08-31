import { create } from "zustand";
import { generateDemoData } from "@/lib/demoData";
import { repository } from "@/lib/repository";
import { getSupabaseBrowserClient } from "@/lib/client/supabase";
import type {
  AppData,
  Campaign,
  ClientRecord,
  CollectionKey,
  Customer,
  DashboardId,
  Deal,
  Permission,
  SessionUser,
  Settings,
  StaffRole,
  TimeEntry,
  Transaction,
} from "@/lib/types";
import { choice, dateISO, normalizeEmail, rand, uid } from "@/lib/utils";

type AssignableStaffRole = Exclude<StaffRole, "SUPER_ADMIN">;

interface AppState {
  data: AppData | null;
  sessionUser: SessionUser | null;
  currentUserId: string | null;
  theme: "light" | "dark";
  isLoading: boolean;

  init: () => Promise<void>;
  toggleTheme: () => Promise<void>;

  login: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  logout: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ ok: boolean; message?: string }>;
  resetDemoData: () => Promise<void>;

  currentUser: () => SessionUser | null;
  permission: (dashboard: DashboardId) => Permission;
  canView: (dashboard: DashboardId) => boolean;
  canEdit: (dashboard: DashboardId) => boolean;
  canExport: (dashboard: DashboardId) => boolean;
  isAdmin: () => boolean;

  // --- mutators ---
  addTransaction: (tx: Omit<Transaction, "id">) => Promise<void>;
  add20DemoTransactions: () => Promise<void>;
  deleteRecord: (collection: CollectionKey, id: string) => Promise<void>;

  addTimeEntry: (entry: Omit<TimeEntry, "id">) => Promise<void>;

  addDeal: (deal: Omit<Deal, "id" | "expectedCloseDate" | "probability" | "industry"> & Partial<Pick<Deal, "expectedCloseDate" | "probability" | "industry">>) => Promise<void>;
  advanceDealStage: (id: string) => Promise<void>;
  simulateHire: () => Promise<void>;

  addCampaign: (campaign: Omit<Campaign, "id">) => Promise<void>;
  addDemoCampaign: () => Promise<void>;

  addClient: (client: Omit<ClientRecord, "id">) => Promise<void>;

  addCustomer: (customer: Omit<Customer, "id">) => Promise<void>;
  addDemoCustomer: () => Promise<void>;
  churnSimulation: () => Promise<void>;

  saveSettings: (settings: Settings) => Promise<void>;
  changeMyPassword: (currentPassword: string, newPassword: string) => Promise<{ ok: boolean; message?: string }>;

  addStaffUser: (input: {
    name: string;
    email: string;
    password: string;
    role: AssignableStaffRole;
  }) => Promise<{ ok: boolean; message?: string }>;
  deleteStaffUser: (userId: string) => Promise<void>;
  saveAllStaffSettings: (
    updates: Record<string, { role?: AssignableStaffRole; isActive?: boolean; permissions?: Partial<Record<DashboardId, Permission>> }>
  ) => Promise<void>;
}

async function persist(data: AppData) {
  await repository.save(data);
}

export const useAppStore = create<AppState>((set, get) => ({
  data: null,
  sessionUser: null,
  currentUserId: null,
  theme: "dark",
  isLoading: true,

  init: async () => {
    const [data, theme, meRes] = await Promise.all([
      repository.load(),
      repository.getTheme(),
      fetch("/api/auth/me").catch(() => null),
    ]);
    const sessionUser: SessionUser | null = meRes && meRes.ok ? (await meRes.json()).user : null;
    set({ data, theme, sessionUser, currentUserId: sessionUser?.id ?? null, isLoading: false });
  },

  toggleTheme: async () => {
    const next = get().theme === "dark" ? "light" : "dark";
    await repository.setTheme(next);
    set({ theme: next });
  },

  login: async (email, password) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalizeEmail(email), password }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, message: body.error || "Login failed." };

    const sessionUser: SessionUser = body.user;
    set({ sessionUser, currentUserId: sessionUser.id });
    return { ok: true };
  },

  logout: async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore — still clear local session state below regardless, so the
      // user can always get back to the login screen.
    }
    set({ sessionUser: null, currentUserId: null });
  },

  requestPasswordReset: async (email) => {
    const supabase = getSupabaseBrowserClient();
    // Points at the server-side verification route (src/app/auth/confirm),
    // not directly at /reset-password — see that route's docstring.
    await supabase.auth.resetPasswordForEmail(normalizeEmail(email), {
      redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
    });
    // Always the same message regardless of outcome — don't leak whether
    // an account exists for this email (Supabase itself doesn't error on
    // an unknown address for this call, so this falls out naturally).
    return { ok: true, message: "If that email has an account, a reset link was sent." };
  },

  resetDemoData: async () => {
    const data = await repository.resetToDemoData();
    set({ data });
  },

  currentUser: () => get().sessionUser,

  permission: (dashboard) => {
    const user = get().sessionUser;
    return (user?.permissionMap?.[dashboard] as Permission) || "none";
  },

  canView: (dashboard) => ["view", "edit", "full"].includes(get().permission(dashboard)),
  canEdit: (dashboard) => ["edit", "full"].includes(get().permission(dashboard)),
  canExport: (dashboard) => ["view", "edit", "full"].includes(get().permission(dashboard)),
  isAdmin: () => get().sessionUser?.role === "SUPER_ADMIN",

  addTransaction: async (tx) => {
    const data = get().data;
    if (!data) return;
    const next = { ...data, transactions: [...data.transactions, { ...tx, id: uid("tx") }] };
    set({ data: next });
    await persist(next);
  },

  add20DemoTransactions: async () => {
    const data = get().data;
    if (!data) return;
    const demo = generateDemoData().transactions.slice(0, 20);
    const next = { ...data, transactions: [...data.transactions, ...demo] };
    set({ data: next });
    await persist(next);
  },

  deleteRecord: async (collection, id) => {
    const data = get().data;
    if (!data) return;
    const next = { ...data, [collection]: (data[collection] as any[]).filter((r) => r.id !== id) } as AppData;
    set({ data: next });
    await persist(next);
  },

  addTimeEntry: async (entry) => {
    const data = get().data;
    if (!data) return;
    const clients = data.clients.map((c) => {
      if (c.id !== entry.clientId) return c;
      const updated = { ...c, actualHours: c.actualHours + entry.hours };
      if (!entry.billable) updated.scopeCreepHours = c.scopeCreepHours + entry.hours;
      return updated;
    });
    const next = { ...data, clients, time_entries: [...data.time_entries, { ...entry, id: uid("time") }] };
    set({ data: next });
    await persist(next);
  },

  addDeal: async (deal) => {
    const data = get().data;
    if (!data) return;
    const newDeal: Deal = {
      id: uid("deal"),
      clientName: deal.clientName,
      value: deal.value,
      stage: deal.stage,
      requiredRole: deal.requiredRole,
      hoursNeeded: deal.hoursNeeded,
      expectedCloseDate: deal.expectedCloseDate || dateISO(new Date()),
      probability: deal.probability ?? (deal.stage === "Negotiation" ? 70 : 35),
      industry: deal.industry || "SaaS",
    };
    const next = { ...data, deals: [...data.deals, newDeal] };
    set({ data: next });
    await persist(next);
  },

  advanceDealStage: async (id) => {
    const data = get().data;
    if (!data) return;
    const order: Deal["stage"][] = ["Proposal", "Negotiation", "Closed Won", "Closed Lost"];
    const deals = data.deals.map((d) => {
      if (d.id !== id) return d;
      const current = order.indexOf(d.stage);
      const stage = order[Math.min(current + 1, order.length - 1)];
      const probability = stage === "Proposal" ? 35 : stage === "Negotiation" ? 70 : stage === "Closed Won" ? 100 : 0;
      return { ...d, stage, probability };
    });
    const next = { ...data, deals };
    set({ data: next });
    await persist(next);
  },

  simulateHire: async () => {
    const data = get().data;
    if (!data) return;
    const target = choice(data.team);
    const team = data.team.map((t) =>
      t.role === target.role ? { ...t, availableHoursThisMonth: t.availableHoursThisMonth + 80, totalCapacity: t.totalCapacity + 80 } : t
    );
    const next = { ...data, team };
    set({ data: next });
    await persist(next);
  },

  addCampaign: async (campaign) => {
    const data = get().data;
    if (!data) return;
    const next = {
      ...data,
      campaigns: [...data.campaigns, { ...campaign, id: uid("camp") }],
      daily_metrics: [
        ...data.daily_metrics,
        {
          date: campaign.startDate,
          channel: campaign.channel,
          spend: campaign.spend,
          clicks: campaign.clicks,
          leads: campaign.conversions,
          hour: rand(8, 21),
          costPerLead: campaign.conversions ? campaign.spend / campaign.conversions : campaign.spend,
        },
      ],
    };
    set({ data: next });
    await persist(next);
  },

  addDemoCampaign: async () => {
    const data = get().data;
    if (!data) return;
    const c = generateDemoData().campaigns[0];
    const next = {
      ...data,
      campaigns: [...data.campaigns, c],
      daily_metrics: [
        ...data.daily_metrics,
        {
          date: c.startDate,
          channel: c.channel,
          spend: c.spend,
          clicks: c.clicks,
          leads: c.conversions,
          hour: rand(8, 21),
          costPerLead: c.conversions ? c.spend / c.conversions : c.spend,
        },
      ],
    };
    set({ data: next });
    await persist(next);
  },

  addClient: async (client) => {
    const data = get().data;
    if (!data) return;
    const next = { ...data, clients: [...data.clients, { ...client, id: uid("client") }] };
    set({ data: next });
    await persist(next);
  },

  addCustomer: async (customer) => {
    const data = get().data;
    if (!data) return;
    const next = { ...data, customers: [...data.customers, { ...customer, id: uid("cust") }] };
    set({ data: next });
    await persist(next);
  },

  addDemoCustomer: async () => {
    const data = get().data;
    if (!data) return;
    const next = { ...data, customers: [...data.customers, generateDemoData().customers[0]] };
    set({ data: next });
    await persist(next);
  },

  churnSimulation: async () => {
    const data = get().data;
    if (!data) return;
    const active = data.customers.filter((c) => !c.churnDate);
    if (!active.length) return;
    const target = choice(active);
    const customers = data.customers.map((c) => (c.id === target.id ? { ...c, churnDate: dateISO(new Date()) } : c));
    const next = { ...data, customers };
    set({ data: next });
    await persist(next);
  },

  saveSettings: async (settings) => {
    const data = get().data;
    if (!data) return;
    const next = { ...data, settings };
    set({ data: next });
    await persist(next);
  },

  changeMyPassword: async (currentPassword, newPassword) => {
    const user = get().sessionUser;
    if (!user) return { ok: false, message: "You need to login first." };
    if (!newPassword || newPassword.length < 8) {
      return { ok: false, message: "New password must be at least 8 characters." };
    }
    const supabase = getSupabaseBrowserClient();
    // Re-verify the current password the same way logging in does, rather
    // than trusting the caller — Supabase's updateUser() doesn't require
    // this itself, but the old "type your current password" UX contract
    // depends on it.
    const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
    if (verifyError) return { ok: false, message: "Current password is incorrect." };
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) return { ok: false, message: updateError.message };
    return { ok: true };
  },

  addStaffUser: async ({ name, email, password, role }) => {
    const res = await fetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email: normalizeEmail(email), password, role }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, message: body.error || "Could not save staff account." };
    return { ok: true };
  },

  deleteStaffUser: async (userId) => {
    await fetch(`/api/staff/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });
  },

  saveAllStaffSettings: async (updates) => {
    await Promise.all(
      Object.entries(updates).map(([userId, update]) =>
        fetch(`/api/staff/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: update.role,
            isActive: update.isActive,
            permissionMap: update.permissions,
          }),
        })
      )
    );
  },
}));
