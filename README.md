# Imerge Command Center (Next.js + TypeScript)

A full rewrite of the original single-file HTML/vanilla-JS dashboard into a
**Next.js 14 (App Router) + TypeScript + React** application — now with a
real backend: **Supabase** (Postgres + Auth + Row Level Security) and a full
**Campaign Builder** subsystem (content → template → audience →
schedule/send → analytics) built directly on **Plunk's Campaigns API**.

The 7 original dashboards (Income, Marketing, Business Health, Client
Profitability, Pipeline & Capacity, LTV/CAC, Settings) still run their
*business data* entirely client-side against `localStorage` by default — see
[Two data layers](#two-data-layers) below for how that relates to the
backend. **Auth and permissions, however, are unified and real app-wide**:
every dashboard is gated by the same Supabase Auth session + `staff_users`
permissions the Campaign Builder uses — there's no separate demo login
anymore, so a Supabase project is required even just to sign in.

## Stack

- **Hosting**: Vercel
- **Database**: Postgres via **Supabase** (Pro plan recommended — no
  project auto-pausing, and it's what makes Row Level Security available)
- **ORM**: Prisma
- **Auth**: **Supabase Auth** — real sessions, no homemade password
  hashing/JWT code in this app anymore
- **Campaign sending**: **Plunk Campaigns** — audiences (Plunk segments),
  scheduling, and send throttling are all handled by Plunk itself, not by
  this app
- **Login rate limiting**: **Upstash Redis** (`@upstash/ratelimit`), with an
  in-memory fallback for local dev

## Testing

```bash
npm test
```

Runs a real (133-test) suite covering the logic that doesn't require a live
database connection:

- **Formatting/date/aggregation helpers** (`src/lib/utils.ts`)
- **Every Zod validation schema** — including a regression test for a real
  bug caught during development (a generic-inference issue that made Zod
  `.default()` values appear optional instead of guaranteed)
- **CSV/chart export logic** against every Plotly trace type the dashboards use
- **Demo data generator** — referential integrity, no NaN/negative amounts,
  unique ids
- **Permission ranking** (`permissionRank`) — including an explicit test
  that `view` does *not* satisfy an `edit` requirement, the core invariant
  the whole permission system (both the app-code checks and the RLS
  policies) relies on
- **Mail provider webhook parsing** for Plunk and Loops, including a real
  HMAC signature round-trip test for Loops that signs a payload exactly the
  way Loops' docs specify and confirms our code both accepts a valid one and
  rejects a tampered one
- **`PlunkBroadcastProvider`** — every method, against a mocked `fetch`
- **`contactFileParser`** — spreadsheet contact-import parsing (name/title
  splitting, header matching, email dedup) against real `.xlsx` workbooks
  built in-memory via `exceljs`
- **Campaign analytics aggregation** — delivery/open/click/bounce rate math
- **Login rate limiting** — window/reset behavior, IP+email key isolation
- **`LocalStorageRepository`'s self-healing user reconciliation**

Uses a tiny custom harness (`tests/harness.ts`, no extra dependency) run via
`tsx`.

**What this suite intentionally does *not* cover** (needs a live Supabase
project, so isn't runnable in a fully offline/sandboxed environment): the
actual `/api/*` route handlers end-to-end, whether the RLS policies in
`prisma/rls.sql` actually block what they should when queried through a real
Supabase session, and real sends through Plunk. Before going to production,
add integration tests against a real (e.g. Supabase branch/preview) project
for at least: login → session cookie → an authenticated API call that RLS
should allow; the same call with a user who should be denied by RLS;
schedule → cancel-before-send; and a full campaign send against a real
Plunk account.

## Getting started

A Supabase project is required before you can log in at all — there's no
offline/demo-only login anymore (see the auth note above). The dashboards'
own *business data* (transactions, deals, customers, etc.) still runs
locally against `localStorage` with no setup, but you won't see it until
you've signed in.

1. **Create a Supabase project** at https://supabase.com (Pro plan for
   production — see the Stack section above for why). From **Settings ->
   Database**, copy the pooled and direct connection strings. From
   **Settings -> API**, copy the project URL, anon key, and service role key.
2. Copy `.env.example` to `.env.local` and fill in the Supabase and database
   values.
3. Create the tables, then apply Row Level Security:
   ```bash
   npm run db:migrate        # creates all tables
   psql "$DIRECT_URL" -f prisma/rls.sql   # enables + defines RLS policies
   npm run db:seed             # starter templates + demo audience (no staff accounts)
   ```
   (`psql` ships with Postgres; alternatively paste `prisma/rls.sql` into the
   Supabase SQL editor.)
4. **Provision the Super Admin** — the one account not created through the
   app itself:
   ```bash
   npm run bootstrap:superadmin -- you@yourdomain.com "Your Name"
   ```
   This only takes an email + name, never a password — it sends a real
   Supabase invite email, and you set your own password by clicking the
   link (lands on `/reset-password`). Every other staff account (CEOs,
   Social Media & Ad Manager, etc. — see the Auth section) is then created
   the same self-service way, through **Settings → User Access &
   Permissions**, once you're signed in as Super Admin.
5. Set `PLUNK_API_KEY` in `.env.local` — the Campaign Builder is built
   directly on Plunk's Campaigns API, so this one is required, not optional
   (unlike the other `MAIL_PROVIDER` options, which are for possible future
   transactional-email use elsewhere — see "Mail providers" below).
6. ```bash
   npm run dev
   ```
   Sign in with the Super Admin account from step 4. Go to **Marketing →
   Campaign Builder** to create your first campaign.

### Deploying (Vercel)

- Add the same environment variables from `.env.example` in your Vercel
  project settings (Production + Preview as needed).
- No webhook registration needed for the Campaign Builder's analytics —
  `campaignService.getAnalytics()` polls Plunk's `GET /campaigns/:id/stats`
  directly instead. (Plunk has no dashboard-configurable webhook
  subscription like Resend's — see `plunkProvider.ts`'s class comment if
  you want delivery events for the separate, currently-unused
  `MailProvider.send()` transactional path; that needs a manually-built
  Plunk Workflow with a Webhook step, plus `PLUNK_WEBHOOK_SECRET`.)
- No cron job is needed — Plunk's Campaigns API owns scheduling internally
  once you call schedule/send.

## Two data layers

This project intentionally has **two separate data mechanisms** right now,
reflecting how it evolved:

1. **Dashboard data** (Income, Clients, Pipeline, etc.) — still goes
   through the `DataRepository` abstraction in `src/lib/repository/`,
   backed by `localStorage`. This keeps the original 7 dashboards fully
   working with zero setup. A `PrismaRepository` implementing the same
   interface (backed by the tables already defined in `prisma/schema.prisma`
   — `Transaction`, `ClientRecord`, `Deal`, `Customer`, etc.) is a natural
   next step to move this onto the real database; see "Connecting a real
   backend" further down.
2. **Campaign Builder data** — goes straight through real API routes
   (`src/app/api/`) backed by Prisma/Postgres/Supabase, because campaigns,
   audiences, and send analytics only make sense as durable, server-side
   data (you can't "send an email from localStorage").

## Auth: Supabase Auth + Row Level Security

Both layers of enforcement are real, not just UI-level checks:

**1. Supabase Auth owns identity.** `POST /api/auth/login` is a thin server
proxy: it applies our own rate limiter (see below), then calls Supabase's
own `signInWithPassword` — Supabase verifies the password and issues the
session cookie; we never see or store a password hash ourselves anymore.
`src/lib/server/auth.ts`'s `getSessionUser()` resolves the current session
via `@supabase/ssr`, then joins it to our `staff_users` table (role,
per-dashboard permissions) by matching id — `StaffUser.id` in
`prisma/schema.prisma` is a UUID that **must equal** the corresponding
`auth.users.id`. Two provisioning paths create that pair: `scripts/bootstrapSuperAdmin.ts`
(one-time, for the single Super Admin account — see Getting started) and
`POST /api/staff` (for every other account, Super Admin only, via
Settings → User Access & Permissions in the app itself) — both follow the
same pattern (`supabase.auth.admin.createUser`/`inviteUserByEmail`, then a
matching `staffUser` row with the same id).

**Roles and permissions.** `StaffRole` (`prisma/schema.prisma`) is a closed
enum: `SUPER_ADMIN` (exactly one, always full access on every dashboard,
non-editable — enforced both by `getSessionUser()` overriding its
permissionMap unconditionally and by `PATCH /api/staff/[id]` refusing to
touch a `SUPER_ADMIN` row at all), `CEO`, and `SOCIAL_MEDIA_AD_MANAGER`.
Only the Super Admin can create staff or edit anyone's per-dashboard
permission map; everyone can change their own password
(`useAppStore.changeMyPassword`, re-verifies the current one via
`supabase.auth.signInWithPassword` before calling `updateUser`) or request
a reset link while logged out (`/reset-password`, which also doubles as
the landing page for the Super Admin's initial invite link).

**2. `requirePermission()` enforces it in application code**, same as
before: every campaign/template/audience route calls
`requirePermission("marketing", "view" | "edit")`, re-reading permissions
from the database on every request (not cached at login) and throwing a
401/403 automatically if they don't qualify.

**3. Row Level Security enforces it again, at the database itself**
(`prisma/rls.sql`) — genuine defense-in-depth: even a bug in a route
handler's permission check couldn't leak data, because Postgres itself
blocks the row. This needed one non-obvious piece to actually work with
Prisma specifically: Postgres doesn't apply RLS to a table's owning role by
default (the role Prisma's connection string uses, since it's the role that
ran the migrations), so every policy is defined with `FORCE ROW LEVEL
SECURITY`. And since `auth.uid()` (what the policies check against) reads a
Postgres session variable that only Supabase's own client sets
automatically, `src/lib/server/withRLS.ts` sets it explicitly — inside the
same transaction as the real query, so it lands on the same pooled
connection — before every RLS-protected call. Every service method
(`campaignService`, `templateService`, `audienceService`) accepts an
optional `db` parameter for exactly this purpose; every API route calls
`withRLS(user.id, tx => service.method(..., tx))` rather than the plain
`prisma` singleton.

**Login rate limiting**: `POST /api/auth/login` is rate-limited (5 attempts
per 15 minutes per IP+email) via `src/lib/server/rateLimit.ts`, either
Upstash Redis (if `UPSTASH_REDIS_REST_URL`/`TOKEN` are set — correct across
every serverless instance) or an in-memory fallback (fine for local dev, not
reliable across multiple concurrent instances in production — see that
file's docstring for exactly why).

The `/api/webhooks/mail/[provider]` route intentionally stays outside this
session system — it's authenticated by a provider-specific shared secret
instead (for Plunk, a `Bearer` header — see `plunkProvider.ts`), since it's
called by the provider's own servers, not a logged-in user. Not currently
exercised in production: the Campaign Builder's analytics poll Plunk's
stats endpoint instead of relying on this route (see below).

**Please verify before relying on this in production**: the RLS
integration above (`withRLS` + `FORCE ROW LEVEL SECURITY`) is a known,
documented pattern for Prisma+Supabase, but wasn't and couldn't be tested
against a live Supabase project in this environment — confirm it actually
blocks what it should with a real session before depending on it as your
only line of defense.

## Campaign Builder: built on Plunk Campaigns

1. **Content** — subject, preheader, from name/email, HTML body editor with
   a live preview. Merge tags use Plunk's Liquid-based syntax —
   `{{firstName ?? 'there'}}`, `{{lastName}}`, `{{email}}`. No need to add
   an unsubscribe link yourself — every campaign is sent as Plunk's
   `MARKETING` type, which automatically appends Plunk's own hosted
   unsubscribe footer and skips already-unsubscribed contacts; the
   built-in `{{unsubscribeUrl}}` merge tag is only for opting into a
   custom-styled link instead of that default footer.
2. **Template** — pick a starter template (seeded by `npm run db:seed`) or
   any saved template; selecting one replaces the body HTML.
3. **Audience** — pick an existing audience or create one by pasting a list
   of emails or uploading a spreadsheet. `audienceService.create()` creates
   a matching **Plunk segment** too (`Audience.externalId`), and every
   contact import (`audienceService.importContacts`) upserts each contact's
   data into Plunk and adds them to that segment — Plunk is the actual
   source of truth campaigns send against, our tables are a local mirror
   for the UI picker and permission-gated browsing.
4. **Schedule / Send** — `campaignService.schedule()`/`sendNow()` push the
   campaign's current content to a Plunk campaign
   (`EmailCampaign.externalBroadcastId`) and either call `sendBroadcast()`
   immediately or with a future date. **Plunk owns the actual
   queueing/throttling/scheduling from that point on** — this app has no
   dispatch queue or cron job of its own anymore.
5. **Analytics** — `campaignService.getAnalytics()` polls Plunk's
   `GET /campaigns/:id/stats` directly for any campaign that's been sent
   (live-recomputed counts, not eventually-consistent webhook ingestion —
   see the method's doc comment). `engaged`/`engagedRate` (opened *and*
   clicked by the same recipient) has no equivalent in Plunk's aggregate
   stats and is always 0 for a sent campaign as a result. Draft campaigns
   fall back to the local `CampaignRecipient`/`CampaignEvent` tables, which
   `recordWebhookEvent()` can still populate if you separately wire up a
   Plunk Workflow webhook (see `plunkProvider.ts`), but nothing does by
   default.

### Mail providers (`src/lib/server/mail/`) — not used by the Campaign Builder

This is a separate, more general abstraction (`MailProvider`) for sending a
single email, with Plunk/Loops/SMTP implementations and provider-agnostic
webhook parsing. It predates the Campaign rework and isn't wired into the
Campaign Builder anymore (campaigns are a fundamentally different,
audience-targeted primitive — see `broadcastProvider.ts`'s docstring for why
that's a deliberately separate, Plunk-specific interface rather than
folded into this one). Kept available for any future transactional-email
use case (e.g. a password-reset email, a health-dashboard alert) outside
the Campaign Builder — note `PlunkMailProvider.send()` has no per-message
tracking id (Plunk's `/send` response doesn't return one), unlike the
Resend implementation this replaced.

## Project structure (backend additions)

```
prisma/
  schema.prisma              # full data model: dashboards + campaign builder
  rls.sql                     # Row Level Security policies — run manually, see Auth section
  seed.ts                    # provisions demo Supabase Auth users + staff profiles + starter templates + demo audience
src/
  lib/server/
    db.ts                     # Prisma client singleton
    supabase.ts                # Supabase server client (session-bound) + admin client (service role)
    withRLS.ts                   # makes Prisma queries respect RLS policies — see Auth section
    apiUtils.ts                # shared API route helpers (error handling, zod parsing, ApiHttpError)
    authTokens.ts                # pure logic: permission ranking (unit-tested)
    auth.ts                       # getSessionUser/requirePermission — Supabase session -> staff_users profile
    rateLimit.ts                   # login rate limiting: Upstash (real) + in-memory (fallback)
    validation.ts                   # zod schemas for every campaign builder request
    mail/
      types.ts, consoleProvider.ts, plunkProvider.ts, loopsProvider.ts, smtpProvider.ts, index.ts
                                # general single-email MailProvider abstraction — see "Mail providers" above
      broadcastProvider.ts       # BroadcastProvider interface — Plunk-specific, Campaign Builder's actual send path
      plunkBroadcastProvider.ts   # the (only, currently) implementation
      broadcastIndex.ts            # factory
    services/
      campaignService.ts          # orchestrates all 5 campaign builder steps + Plunk campaign sync
      templateService.ts           # template CRUD (step 2)
      audienceService.ts            # audience/contacts CRUD + Plunk sync (step 3)
    campaignAnalytics.ts       # pure aggregation math for step 5 — unit-tested
  app/api/
    auth/                        # login (Supabase proxy + rate limit), logout, me
    campaigns/                  # CRUD, /schedule, /send, /analytics
    templates/                  # CRUD
    audiences/                  # CRUD + /contacts (bulk import)
    mail/providers/               # lists configured MailProvider implementations
    webhooks/mail/[provider]/     # provider-agnostic inbound webhook receiver
  lib/campaignApi.ts           # typed client-side fetch wrapper used by the wizard
  components/campaign-builder/  # the 5-step wizard UI
tests/                        # unit/logic test suite — see "Testing" above
```

(See below for the original frontend-only structure — still unchanged.)

## Project structure (frontend)

```
src/
  app/
    page.tsx                 # redirects to /income
    (app)/                   # route group: every dashboard route
      layout.tsx              # wraps pages in <AppShell>
      income/page.tsx, marketing/page.tsx, marketing/campaigns/, health/page.tsx,
      clients/page.tsx, pipeline/page.tsx, ltv/page.tsx, settings/page.tsx
    globals.css               # ported design system (CSS variables, light/dark theme)
  components/
    layout/                   # Sidebar, BottomNav, Topbar, FloatingAdd, AppShell
    auth/                     # LoginScreen, AccessDenied
    ui/                       # Modal, KpiGrid, FilterBar, ChartCard (generic building blocks)
    charts/                   # PlotlyChart (client-only wrapper)
    modals/                   # One component per "Add X" flow + ModalHost
    views/                    # One component per dashboard (the bulk of the business logic)
  hooks/                      # useDashboardFilters, useSyncExportRows, useMoney
  store/
    useAppStore.ts            # Zustand store: data, auth/session, theme, all CRUD actions
    useUIStore.ts              # ephemeral UI state: active modal, current export rows
  lib/
    types.ts, constants.ts, demoData.ts, utils.ts, exportUtils.ts
    repository/
      types.ts                    # DataRepository interface — the backend integration seam
      localStorageRepository.ts   # current implementation (localStorage-backed)
      index.ts                    # swap point: change one line to use a different repository
```

## Architecture notes

- **State**: [Zustand](https://github.com/pmndrs/zustand) holds the whole
  dashboard dataset (`useAppStore`) plus small ephemeral UI state
  (`useUIStore`). The Campaign Builder is separate — it talks directly to
  the API routes (`src/lib/campaignApi.ts`) since that data lives
  server-side. `useAppStore.login`/`logout` call the dashboards'
  `localStorage`-backed login *and*, best-effort, `/api/auth/login`/`logout`
  — so one login screen establishes both sessions, but the backend session
  failing to establish (e.g. not configured yet) never blocks the
  dashboards from working.
- **Filters**: each dashboard view owns its own date-range/top-filter/visual-filter
  state locally (`useDashboardFilters`) rather than one global filter blob.
- **Charts**: `PlotlyChart` dynamically imports `plotly.js-dist-min` (no
  SSR); `ChartCard` wraps it with per-chart CSV/PNG/SVG/PDF export buttons.
- **Permissions**: `useAppStore` exposes `canView`, `canEdit`, `canExport`,
  `isAdmin` for the dashboards (still `localStorage`-based — see "Known
  gaps"). The Campaign Builder's own permission enforcement is described in
  full in the Auth section above.

## Connecting a real backend (for the dashboards)

Everything the dashboards read/write goes through a single interface:

```ts
// src/lib/repository/types.ts
export interface DataRepository {
  load(): Promise<AppData>;
  save(data: AppData): Promise<void>;
  resetToDemoData(): Promise<AppData>;
  getTheme(): Promise<"light" | "dark">;
  setTheme(theme: "light" | "dark"): Promise<void>;
}
```

Note this interface only covers business data + theme — auth/session state
isn't part of it. That lives entirely in Supabase Auth + the real
`/api/auth/*` routes now (see the Auth section), fetched via `/api/auth/me`
on load rather than read from `localStorage`.

To move the 7 dashboards onto the same Supabase database the Campaign
Builder already uses: implement a `PrismaRepository` against the tables
already defined in `prisma/schema.prisma` (`Transaction`, `ClientRecord`,
`Deal`, `Customer`, `TeamCapacity`, `DailyMetric`,
`MarketingCampaignMetric`, `Settings`), then swap the export in
`src/lib/repository/index.ts`. Since these routes would then need to be
server-backed, you'd call them via API routes (mirroring the campaign
builder's pattern, including `withRLS`) rather than reading `localStorage`
directly.

## Known gaps / next steps

- **RLS is implemented but unverified against a live database** — see the
  callout at the end of the Auth section. Worth a deliberate test pass
  (confirm a user *without* marketing access is actually denied by
  Postgres, not just by the app-code check) before trusting it as a real
  security boundary.
- **Loops webhook verification** follows Loops' documented scheme precisely
  as of when this was written, but provider webhook formats do change over
  time — worth a sanity check against Loops' current docs before depending
  on it, if you ever do wire Loops back in for something.
- **`Audience`/`AudienceContact` are a local mirror of Plunk's own
  segment/contact data**, kept for the UI picker and RLS-gated browsing.
  If they ever drift (e.g. someone unsubscribes directly in Plunk's
  dashboard), there's no sync-back path from Plunk to us yet — only
  local-to-Plunk, on import.
- **Migrated from Resend to Plunk** — existing `Audience` rows created
  before the migration still carry a Resend-format `externalId`, which
  Plunk's API won't recognize. Re-create (or re-sync) any pre-migration
  audiences before importing contacts or sending a campaign against them.
- **Split `AppData` into real API resources** remains future work if/when
  you move the 7 dashboards onto Postgres too — one blob (matching the
  original's single `localStorage` object) doesn't scale the way separate
  paginated resources do. The `DataRepository` seam is what makes this an
  additive change rather than a rewrite when you get there.

## Scripts

```bash
npm run dev         # start dev server
npm run build        # production build
npm run start         # run the production build
npm run lint            # eslint
npm test                 # run the unit/logic test suite (see "Testing" above)
npm run db:migrate        # create/update database tables
npm run db:deploy          # apply migrations in production (no prompts)
npm run db:studio           # Prisma Studio — browse your data
npm run db:seed              # starter templates + demo audience (no staff accounts)
npm run bootstrap:superadmin  # one-time: invite the Super Admin account (see Getting started)
```

After `db:migrate`/`db:deploy`, remember to (re-)apply
`psql "$DIRECT_URL" -f prisma/rls.sql` if you've changed any RLS-related
tables — Prisma migrations don't know about the policies in that file.
