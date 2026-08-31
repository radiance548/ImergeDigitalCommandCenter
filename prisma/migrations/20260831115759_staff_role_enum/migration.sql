/*
  Warnings:

  - Changed the type of `role` on the `staff_users` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('SUPER_ADMIN', 'CEO', 'SOCIAL_MEDIA_AD_MANAGER');

-- Existing rows are the old fake demo/seed staff accounts being retired by
-- this migration (see the auth-migration plan) — their free-text `role`
-- values ("Super Admin", "Operating Manager", "CTO", etc.) don't map to the
-- new closed enum, and they're being replaced by real accounts anyway.
-- References from EmailCampaign.createdById / AuditLog.userId are
-- onDelete: SetNull, so this is a safe, non-cascading cleanup.
DELETE FROM "staff_users";

-- AlterTable
ALTER TABLE "staff_users" DROP COLUMN "role",
ADD COLUMN     "role" "StaffRole" NOT NULL;
