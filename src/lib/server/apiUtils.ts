import { NextResponse } from "next/server";
import type { z, ZodTypeAny } from "zod";

export function apiError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

/** Throw this from a service/helper to have withErrorHandling translate it into the right HTTP status. */
export class ApiHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function parseJsonBody<S extends ZodTypeAny>(
  req: Request,
  schema: S
): Promise<{ data: z.infer<S> } | { error: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { error: apiError(400, "Request body must be valid JSON") };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return { error: apiError(400, result.error.issues.map((i) => i.message).join("; ")) };
  }
  return { data: result.data };
}

/** Wraps a route handler so unexpected errors become a clean error response instead of an unhandled crash. */
export function withErrorHandling<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<NextResponse>
) {
  return async (...args: TArgs): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof ApiHttpError) {
        return apiError(error.status, error.message);
      }
      console.error("[api] unhandled error:", error);
      const message = error instanceof Error ? error.message : "Internal server error";
      return apiError(500, message);
    }
  };
}
