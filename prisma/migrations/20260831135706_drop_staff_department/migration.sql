-- Department was removed from the staff data model — see the auth
-- migration plan. Only demo/bootstrap rows exist at this point, so no
-- backfill is needed before dropping.
ALTER TABLE "staff_users" DROP COLUMN "department";
