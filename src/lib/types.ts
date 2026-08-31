// ============================================================
// CORE DOMAIN TYPES
// These mirror the original app's data shapes so the migration
// to a real backend (REST/GraphQL/Supabase/etc.) only requires
// swapping the Repository implementation, not the UI layer.
// ============================================================

export type Permission = "none" | "view" | "edit" | "full";

export type DashboardId =
  | "income"
  | "marketing"
  | "health"
  | "clients"
  | "pipeline"
  | "ltv"
  | "settings";

export type Permissions = Record<DashboardId, Permission>;

export type StaffRole = "SUPER_ADMIN" | "CEO" | "SOCIAL_MEDIA_AD_MANAGER";

/** The authenticated session's own profile — backed by real Supabase Auth
 *  + the `staff_users` table (see src/lib/server/auth.ts), not local demo
 *  data. No password field: credentials never leave Supabase Auth. */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  isActive: boolean;
  permissionMap: Permissions;
}

export interface Transaction {
  id: string;
  date: string; // ISO date
  type: "income" | "expense";
  category: string;
  amount: number;
  description: string;
}

export interface Campaign {
  id: string;
  name: string;
  channel: string;
  campaignType: string;
  startDate: string;
  endDate: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
}

export interface DailyMetric {
  date: string;
  channel: string;
  spend: number;
  clicks: number;
  leads: number;
  hour: number;
  costPerLead: number;
}

export interface ClientRecord {
  id: string;
  name: string;
  tier: "A" | "B" | "C";
  serviceLine: string;
  monthlyRetainer: number;
  contractHours: number;
  actualHours: number;
  scopeCreepHours: number;
  billableExpenses: number;
  clientRevenue: number;
}

export interface TimeEntry {
  id: string;
  clientId: string;
  date: string;
  hours: number;
  description: string;
  billable: boolean;
  approved: boolean;
}

export type DealStage = "Proposal" | "Negotiation" | "Closed Won" | "Closed Lost";

export interface Deal {
  id: string;
  clientName: string;
  value: number;
  stage: DealStage;
  industry: string;
  expectedCloseDate: string;
  probability: number;
  requiredRole: string;
  hoursNeeded: number;
}

export interface TeamCapacity {
  role: string;
  availableHoursThisMonth: number;
  totalCapacity: number;
}

export interface Customer {
  id: string;
  name: string;
  acquisitionDate: string;
  acquisitionChannel: string;
  cac: number;
  firstYearRevenue: number;
  lifetimeRevenue: number;
  churnDate: string | null;
}

export interface Settings {
  currency: string;
  fiscalStartMonth: string;
  hourlyCost: number;
  targetLtvCac: number;
  monthlyBudget: number;
  categoryBudgets: Record<string, number>;
}

/** The whole application dataset. In a real integration this would
 *  likely be split across several API resources instead of one blob. */
export interface AppData {
  settings: Settings;
  transactions: Transaction[];
  campaigns: Campaign[];
  daily_metrics: DailyMetric[];
  clients: ClientRecord[];
  time_entries: TimeEntry[];
  deals: Deal[];
  team: TeamCapacity[];
  customers: Customer[];
}

export type CollectionKey =
  | "transactions"
  | "campaigns"
  | "daily_metrics"
  | "clients"
  | "time_entries"
  | "deals"
  | "team"
  | "customers";

export interface NavItem {
  /** Which permission dimension gates this item (see canView/canEdit). */
  id: DashboardId;
  /** Where it links to — not always `/${id}`, e.g. Campaign Builder shares
   *  the "marketing" permission but links to a different sub-route. */
  href: string;
  icon: string;
  title: string;
  question: string;
}

export type DateRangeKey = "last7" | "last30" | "month" | "last3" | "last90";

export interface TopFilters {
  range?: DateRangeKey;
  [key: string]: string | undefined;
}

export interface VisualFilters {
  [key: string]: string | undefined;
}
