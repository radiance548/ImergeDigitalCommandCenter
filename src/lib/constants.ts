import type { NavItem } from "./types";

export const NAV_ITEMS: NavItem[] = [
  { id: "income", icon: "fa-wallet", title: "Income & Expense", question: "Did we make a profit this month?" },
  { id: "marketing", icon: "fa-bullhorn", title: "Marketing Activity", question: "Are our campaigns generating leads?" },
  { id: "health", icon: "fa-heart-pulse", title: "Business Health", question: "Will we still be here in 12 months?" },
  { id: "clients", icon: "fa-users", title: "Client Profitability", question: "Which clients caused us to lose profit?" },
  { id: "pipeline", icon: "fa-diagram-project", title: "Pipeline & Capacity", question: "Can we deliver what we're about to sell?" },
  { id: "ltv", icon: "fa-seedling", title: "LTV / CAC", question: "Are we acquiring customers profitably?" },
  { id: "settings", icon: "fa-gear", title: "Settings", question: "Control global assumptions and budgets." },
];

export const DEFAULT_STAFF_PERMISSIONS = {
  income: "view",
  marketing: "view",
  health: "none",
  clients: "view",
  pipeline: "view",
  ltv: "view",
  settings: "none",
} as const;
