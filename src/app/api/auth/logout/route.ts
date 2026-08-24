import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/server/supabase";
import { withErrorHandling } from "@/lib/server/apiUtils";

export const POST = withErrorHandling(async () => {
  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
});
