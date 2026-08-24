import { create } from "zustand";
import { DEFAULT_STAFF_PERMISSIONS } from "@/lib/constants";
import { generateDemoData } from "@/lib/demoData";
import { repository } from "@/lib/repository";
import type {
  AppData,
  Campaign,
  ClientRecord,
  CollectionKey,
  Customer,
  DashboardId,
  Deal,
  Permission,
  Settings,
  StaffUser,
  TimeEntry,
  Transaction,
} from "@/lib/types";
import { choice, dateISO, normalizeEmail, rand, uid } from "@/lib/utils";

interface AppState {
  data: AppData | null;
  currentUserId: string | null;
  theme: "light" | "dark";
  isLoading: boolean;

  init: () => Promise<void>;
  toggleTheme: () => Promise<void>;

  login: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  logout: () => Promise<void>;
  resetDemoData: () => Promise<void>;

  currentUser: () => StaffUser | null;
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

  addStaffUser: (input: { name: string; email: string; password: string; department: string; role: string }) => Promise<{ ok: boolean; message?: string }>;
  deleteStaffUser: (userId: string) => Promise<void>;
  saveAllStaffSettings: (
    updates: Record<string, { role?: string; department?: string; password?: string; isActive?: boolean; permissions?: Partial<Record<DashboardId, Permission>> }>
  ) => Promise<void>;
}

async function persist(data: AppData) {
  await repository.save(data);
}

export const useAppStore = create<AppState>((set, get) => ({
  data: null,
  currentUserId: null,
  theme: "dark",
  isLoading: true,

  init: async () => {
    const [data, currentUserId, theme] = await Promise.all([
      repository.load(),
      repository.getSessionUserId(),
      repository.getTheme(),
    ]);
    set({ data, currentUserId, theme, isLoading: false });
  },

  toggleTheme: async () => {
    const next = get().theme === "dark" ? "light" : "dark";
    await repository.setTheme(next);
    set({ theme: next });
  },

  login: async (email, password) => {
    const data = get().data;
    if (!data) return { ok: false, message: "App is still loading." };
    const normalized = normalizeEmail(email);
    const user = data.users.find((u) => normalizeEmail(u.email) === normalized);
    if (!user) return { ok: false, message: "No account found. Please check email spelling." };
    if (user.isActive === false) return { ok: false, message: "This account is inactive. Please contact admin." };
    if (String(user.password) !== String(password)) return { ok: false, message: "Incorrect password." };

    // Best-effort: also establish a real backend session (httpOnly cookie)
    // for the Campaign Builder's API routes. This is a separate auth system
    // from the localStorage-backed dashboards above (see README — "Two data
    // layers"), so if the backend isn't configured yet (no DATABASE_URL) or
    // this account hasn't been seeded server-side, the dashboards still work
    // fine; only Campaign Builder API calls would be unavailable until it is.
    //
    // Must happen BEFORE currentUserId is set below: setting currentUserId
    // flips AppShell straight to the authenticated view, remounting whatever
    // page the user was last on. A page like Campaign Builder's list
    // (marketing/campaigns/page.tsx) fetches from a cookie-authenticated API
    // route in a mount-only effect — if that fetch fires before this cookie
    // exists, it 401s once and has no way to know to retry, leaving a stale
    // "not signed in" error on screen until the user navigates away and back.
    try {
      await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized, password }),
      });
    } catch {
      // Ignore — backend may not be configured. See note above.
    }

    await repository.setSessionUserId(user.id);
    set({ currentUserId: user.id });

    return { ok: true };
  },

  logout: async () => {
    await repository.setSessionUserId(null);
    set({ currentUserId: null });
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore — see note in login().
    }
  },

  resetDemoData: async () => {
    const data = await repository.resetToDemoData();
    set({ data });
  },

  currentUser: () => {
    const { data, currentUserId } = get();
    if (!data || !currentUserId) return null;
    return data.users.find((u) => u.id === currentUserId && u.isActive !== false) || null;
  },

  permission: (dashboard) => {
    const user = get().currentUser();
    return user?.permissions?.[dashboard] || "none";
  },

  canView: (dashboard) => ["view", "edit", "full"].includes(get().permission(dashboard)),
  canEdit: (dashboard) => ["edit", "full"].includes(get().permission(dashboard)),
  canExport: (dashboard) => ["view", "edit", "full"].includes(get().permission(dashboard)),
  isAdmin: () => get().currentUser()?.id === "admin" || get().permission("settings") === "full",

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
    const data = get().data;
    const user = get().currentUser();
    if (!data || !user) return { ok: false, message: "You need to login first." };
    if (!newPassword || newPassword.length < 6) return { ok: false, message: "New password must be at least 6 characters." };
    const stored = data.users.find((u) => u.id === user.id);
    if (!stored) return { ok: false, message: "User not found." };
    if (String(stored.password) !== String(currentPassword)) return { ok: false, message: "Current password is incorrect." };
    const users = data.users.map((u) => (u.id === user.id ? { ...u, password: newPassword } : u));
    const next = { ...data, users };
    set({ data: next });
    await persist(next);
    return { ok: true };
  },

  addStaffUser: async ({ name, email, password, department, role }) => {
    const data = get().data;
    if (!data) return { ok: false, message: "App is still loading." };
    const normalized = normalizeEmail(email);
    if (!normalized || !normalized.includes("@")) return { ok: false, message: "Enter a valid staff email." };
    if (!password || password.length < 4) return { ok: false, message: "Enter a password of at least 4 characters." };

    const existing = data.users.find((u) => normalizeEmail(u.email) === normalized);
    let users: StaffUser[];
    if (existing) {
      users = data.users.map((u) =>
        u.id === existing.id
          ? { ...u, name: name || u.name, password, department: department || u.department, role: role || u.role, isActive: true }
          : u
      );
    } else {
      users = [
        ...data.users,
        {
          id: `user_${Date.now()}`,
          name: name || normalized.split("@")[0],
          email: normalized,
          password,
          department: department || "General",
          role: role || "General Staff",
          isActive: true,
          permissions: { ...DEFAULT_STAFF_PERMISSIONS },
        },
      ];
    }
    const next = { ...data, users };
    set({ data: next });
    await persist(next);
    return { ok: true };
  },

  deleteStaffUser: async (userId) => {
    const data = get().data;
    if (!data) return;
    const users = data.users.filter((u) => u.id !== userId || u.id === "admin");
    const next = { ...data, users };
    set({ data: next });
    await persist(next);
  },

  saveAllStaffSettings: async (updates) => {
    const data = get().data;
    if (!data) return;
    const users = data.users.map((u) => {
      if (u.id === "admin") return u;
      const update = updates[u.id];
      if (!update) return u;
      return {
        ...u,
        role: update.role ?? u.role,
        department: update.department ?? u.department,
        password: update.password ?? u.password,
        isActive: update.isActive ?? u.isActive,
        permissions: { ...u.permissions, ...(update.permissions || {}) } as StaffUser["permissions"],
      };
    });
    const next = { ...data, users };
    set({ data: next });
    await persist(next);
  },
}));
