export interface Campaign {
  id: string;
  subject: string;
  preheader: string | null;
  bodyHtml: string;
  fromName: string;
  fromEmail: string;
  templateId: string | null;
  audienceId: string | null;
  status: "draft" | "scheduled" | "sending" | "sent" | "failed" | "canceled";
  scheduledAt: string | null;
  sentAt: string | null;
  provider: string;
  createdAt: string;
  updatedAt: string;
  template?: { id: string; name: string } | null;
  audience?: { id: string; name: string } | null;
  _count?: { recipients: number };
}

export interface EmailTemplate {
  id: string;
  name: string;
  description: string | null;
  html: string;
  thumbnailUrl: string | null;
  isSystem: boolean;
}

export interface Audience {
  id: string;
  name: string;
  description: string | null;
  _count?: { contacts: number };
}

export interface AudienceContact {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
}

export interface CampaignAnalytics {
  totalRecipients: number;
  pending: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  engaged: number;
  bounced: number;
  unsubscribed: number;
  complained: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  engagedRate: number;
  bounceRate: number;
}

export interface MailProviderInfo {
  key: string;
  label: string;
  configured: boolean;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `Request to ${url} failed with status ${res.status}`);
  }
  return body as T;
}

export const campaignApi = {
  list: () => request<{ campaigns: Campaign[] }>("/api/campaigns"),
  get: (id: string) => request<{ campaign: Campaign }>(`/api/campaigns/${id}`),
  create: (input: Partial<Campaign>) =>
    request<{ campaign: Campaign }>("/api/campaigns", { method: "POST", body: JSON.stringify(input) }),
  update: (id: string, input: Partial<Campaign>) =>
    request<{ campaign: Campaign }>(`/api/campaigns/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  remove: (id: string) => request<{ ok: boolean }>(`/api/campaigns/${id}`, { method: "DELETE" }),
  schedule: (id: string, scheduledAt?: string) =>
    request<{ campaign: Campaign }>(`/api/campaigns/${id}/schedule`, {
      method: "POST",
      body: JSON.stringify({ scheduledAt }),
    }),
  cancelSchedule: (id: string) =>
    request<{ campaign: Campaign }>(`/api/campaigns/${id}/schedule`, { method: "DELETE" }),
  sendNow: (id: string) => request<{ campaign: Campaign }>(`/api/campaigns/${id}/send`, { method: "POST" }),
  analytics: (id: string) => request<{ analytics: CampaignAnalytics }>(`/api/campaigns/${id}/analytics`),

  templates: {
    list: () => request<{ templates: EmailTemplate[] }>("/api/templates"),
    create: (input: { name: string; description?: string; html: string }) =>
      request<{ template: EmailTemplate }>("/api/templates", { method: "POST", body: JSON.stringify(input) }),
  },

  audiences: {
    list: () => request<{ audiences: Audience[] }>("/api/audiences"),
    get: (id: string) => request<{ audience: Audience & { contacts: AudienceContact[] } }>(`/api/audiences/${id}`),
    create: (input: { name: string; description?: string }) =>
      request<{ audience: Audience }>("/api/audiences", { method: "POST", body: JSON.stringify(input) }),
    importContacts: (id: string, contacts: { email: string; firstName?: string; lastName?: string }[]) =>
      request<{ imported: number }>(`/api/audiences/${id}/contacts`, {
        method: "POST",
        body: JSON.stringify({ contacts }),
      }),
  },

  mailProviders: () => request<{ providers: MailProviderInfo[] }>("/api/mail/providers"),
};
