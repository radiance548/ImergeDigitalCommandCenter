-- ============================================================
-- Row Level Security policies (Supabase Postgres)
--
-- Run this AFTER `prisma migrate deploy` / `prisma db push` has created
-- the tables — Prisma has no native RLS policy syntax, so this lives as
-- plain SQL, applied separately:
--
--   psql "$DIRECT_URL" -f prisma/rls.sql
--
-- or paste it into the Supabase SQL editor.
--
-- WHY "FORCE ROW LEVEL SECURITY":
-- Postgres does NOT apply RLS policies to a table's owning role by
-- default, only to other roles. The role Prisma's DATABASE_URL connects
-- as is typically the owner of these tables (it's the role that ran the
-- migrations), so without FORCE, every policy below would silently be a
-- no-op for Prisma's own queries specifically — this is the standard,
-- documented gotcha when combining Prisma with Supabase RLS. FORCE ROW
-- LEVEL SECURITY closes that gap (it still doesn't apply to a genuine
-- Postgres superuser, but Supabase's project-level `postgres` role is not
-- one in their hosted product).
--
-- WHY THIS NEEDS Prisma's queries wrapped in `withRLS(...)`:
-- auth.uid() (Supabase's helper, defined as reading the `sub` claim out
-- of the `request.jwt.claims` Postgres session setting) only resolves
-- correctly if something has set that session variable first. Supabase's
-- own client (PostgREST) does this automatically from the request's JWT;
-- a direct Prisma connection does not. See src/lib/server/withRLS.ts,
-- which sets it explicitly, in the same transaction/connection as the
-- real query, before every RLS-protected call from an API route.
-- ============================================================

alter table staff_users            enable row level security;
alter table staff_users            force  row level security;
alter table email_campaigns        enable row level security;
alter table email_campaigns        force  row level security;
alter table email_templates        enable row level security;
alter table email_templates        force  row level security;
alter table audiences              enable row level security;
alter table audiences              force  row level security;
alter table audience_contacts      enable row level security;
alter table audience_contacts      force  row level security;
alter table campaign_recipients    enable row level security;
alter table campaign_recipients    force  row level security;
alter table campaign_events        enable row level security;
alter table campaign_events        force  row level security;

-- staff_users: everyone authenticated can read their own row (needed to
-- resolve their own permissions); only the Super Admin (or, incidentally,
-- anyone else granted settings=full) can modify other users' rows.
drop policy if exists staff_users_select_self on staff_users;
create policy staff_users_select_self on staff_users
  for select
  using (id = auth.uid());

drop policy if exists staff_users_admin_all on staff_users;
create policy staff_users_admin_all on staff_users
  for all
  using (
    exists (
      select 1 from staff_users su
      where su.id = auth.uid()
        and su."isActive" = true
        and (su."role" = 'SUPER_ADMIN' or (su."permissionMap"->>'settings') = 'full')
    )
  )
  with check (
    exists (
      select 1 from staff_users su
      where su.id = auth.uid()
        and su."isActive" = true
        and (su."role" = 'SUPER_ADMIN' or (su."permissionMap"->>'settings') = 'full')
    )
  );

-- Reusable pattern for every Campaign Builder table: SELECT requires
-- "marketing" >= view, INSERT/UPDATE/DELETE requires "marketing" >= edit.
-- (Written out per-table since Postgres policies aren't parameterizable.)

drop policy if exists email_campaigns_select on email_campaigns;
create policy email_campaigns_select on email_campaigns
  for select
  using (
    exists (
      select 1 from staff_users su
      where su.id = auth.uid() and su."isActive" = true
        and (su."permissionMap"->>'marketing') in ('view','edit','full')
    )
  );

drop policy if exists email_campaigns_modify on email_campaigns;
create policy email_campaigns_modify on email_campaigns
  for all
  using (
    exists (
      select 1 from staff_users su
      where su.id = auth.uid() and su."isActive" = true
        and (su."permissionMap"->>'marketing') in ('edit','full')
    )
  )
  with check (
    exists (
      select 1 from staff_users su
      where su.id = auth.uid() and su."isActive" = true
        and (su."permissionMap"->>'marketing') in ('edit','full')
    )
  );

drop policy if exists email_templates_select on email_templates;
create policy email_templates_select on email_templates
  for select
  using (
    exists (
      select 1 from staff_users su
      where su.id = auth.uid() and su."isActive" = true
        and (su."permissionMap"->>'marketing') in ('view','edit','full')
    )
  );

drop policy if exists email_templates_modify on email_templates;
create policy email_templates_modify on email_templates
  for all
  using (
    exists (
      select 1 from staff_users su
      where su.id = auth.uid() and su."isActive" = true
        and (su."permissionMap"->>'marketing') in ('edit','full')
    )
  )
  with check (
    exists (
      select 1 from staff_users su
      where su.id = auth.uid() and su."isActive" = true
        and (su."permissionMap"->>'marketing') in ('edit','full')
    )
  );

drop policy if exists audiences_select on audiences;
create policy audiences_select on audiences
  for select
  using (
    exists (
      select 1 from staff_users su
      where su.id = auth.uid() and su."isActive" = true
        and (su."permissionMap"->>'marketing') in ('view','edit','full')
    )
  );

drop policy if exists audiences_modify on audiences;
create policy audiences_modify on audiences
  for all
  using (
    exists (
      select 1 from staff_users su
      where su.id = auth.uid() and su."isActive" = true
        and (su."permissionMap"->>'marketing') in ('edit','full')
    )
  )
  with check (
    exists (
      select 1 from staff_users su
      where su.id = auth.uid() and su."isActive" = true
        and (su."permissionMap"->>'marketing') in ('edit','full')
    )
  );

drop policy if exists audience_contacts_select on audience_contacts;
create policy audience_contacts_select on audience_contacts
  for select
  using (
    exists (
      select 1 from staff_users su
      where su.id = auth.uid() and su."isActive" = true
        and (su."permissionMap"->>'marketing') in ('view','edit','full')
    )
  );

drop policy if exists audience_contacts_modify on audience_contacts;
create policy audience_contacts_modify on audience_contacts
  for all
  using (
    exists (
      select 1 from staff_users su
      where su.id = auth.uid() and su."isActive" = true
        and (su."permissionMap"->>'marketing') in ('edit','full')
    )
  )
  with check (
    exists (
      select 1 from staff_users su
      where su.id = auth.uid() and su."isActive" = true
        and (su."permissionMap"->>'marketing') in ('edit','full')
    )
  );

-- Analytics tables: read-only for staff with view+ access. Writes to
-- these two only ever happen from recordWebhookEvent (see
-- campaignService.ts), which intentionally runs on the unrestricted
-- `prisma` singleton (no user session exists for an inbound webhook) —
-- so no modify policy is defined here on purpose; with RLS enabled and
-- forced, that leaves these tables writable only via the direct
-- postgres-role connection Prisma uses server-side, never through a
-- user-scoped session.
drop policy if exists campaign_recipients_select on campaign_recipients;
create policy campaign_recipients_select on campaign_recipients
  for select
  using (
    exists (
      select 1 from staff_users su
      where su.id = auth.uid() and su."isActive" = true
        and (su."permissionMap"->>'marketing') in ('view','edit','full')
    )
  );

drop policy if exists campaign_events_select on campaign_events;
create policy campaign_events_select on campaign_events
  for select
  using (
    exists (
      select 1 from staff_users su
      where su.id = auth.uid() and su."isActive" = true
        and (su."permissionMap"->>'marketing') in ('view','edit','full')
    )
  );
