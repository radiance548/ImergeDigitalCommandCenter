import { NextResponse } from "next/server";
import { listMailProviders } from "@/lib/server/mail";
import { withErrorHandling } from "@/lib/server/apiUtils";
import { requirePermission } from "@/lib/server/auth";

export const GET = withErrorHandling(async () => {
  await requirePermission("marketing", "view");
  return NextResponse.json({ providers: listMailProviders() });
});
