// Pure, dependency-free permission logic — kept separate from auth.ts
// (which needs Prisma + Supabase's request-bound client) so it's directly
// unit-testable. Password hashing and session tokens used to live here
// too, before the app moved to Supabase Auth, which now owns both.

const PERMISSION_LEVELS = { none: 0, view: 1, edit: 2, full: 3 } as const;

export function permissionRank(level: string | undefined): number {
  return PERMISSION_LEVELS[(level as keyof typeof PERMISSION_LEVELS) || "none"] ?? 0;
}
