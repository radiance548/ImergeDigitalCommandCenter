import type { NavItem } from "./types";

export const NAV_ITEMS: NavItem[] = [
  { id: "income", href: "/income", icon: "fa-wallet", title: "Income & Expense", question: "Did we make a profit this month?" },
  { id: "marketing", href: "/marketing", icon: "fa-bullhorn", title: "Marketing Activity", question: "Are our campaigns generating leads?" },
  { id: "marketing", href: "/marketing/campaigns", icon: "fa-paper-plane", title: "Campaign Builder", question: "Create, schedule, and track email campaigns end-to-end." },
  { id: "health", href: "/health", icon: "fa-heart-pulse", title: "Business Health", question: "Will we still be here in 12 months?" },
  { id: "clients", href: "/clients", icon: "fa-users", title: "Client Profitability", question: "Which clients caused us to lose profit?" },
  { id: "pipeline", href: "/pipeline", icon: "fa-diagram-project", title: "Pipeline & Capacity", question: "Can we deliver what we're about to sell?" },
  { id: "ltv", href: "/ltv", icon: "fa-seedling", title: "LTV / CAC", question: "Are we acquiring customers profitably?" },
  { id: "settings", href: "/settings", icon: "fa-gear", title: "Settings", question: "Control global assumptions and budgets." },
];

/**
 * Which nav item's href best matches the current path, for active-state
 * highlighting. Plain equality would make "Marketing Activity" (/marketing)
 * light up on Campaign Builder pages too, since /marketing/campaigns starts
 * with it — pick the longest matching href (most specific route) instead.
 */
export function getActiveNavHref(pathname: string | null, items: NavItem[] = NAV_ITEMS): string | undefined {
  if (!pathname) return undefined;
  return items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

export const DEFAULT_STAFF_PERMISSIONS = {
  income: "view",
  marketing: "view",
  health: "none",
  clients: "view",
  pipeline: "view",
  ltv: "view",
  settings: "none",
} as const;
