import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/auth";
import { apiError, withErrorHandling } from "@/lib/server/apiUtils";

export const GET = withErrorHandling(async () => {
  const user = await getSessionUser();
  if (!user) return apiError(401, "Not signed in");
  return NextResponse.json({ user });
});
