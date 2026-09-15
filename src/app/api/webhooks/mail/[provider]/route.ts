import { NextResponse } from "next/server";
import { getMailProvider } from "@/lib/server/mail";
import { campaignService } from "@/lib/server/services/campaignService";
import { apiError, withErrorHandling } from "@/lib/server/apiUtils";

interface Params {
  params: { provider: string };
}

/**
 * Single webhook endpoint for every mail provider, e.g.:
 *   https://your-domain.com/api/webhooks/mail/plunk
 *   https://your-domain.com/api/webhooks/mail/loops
 *
 * Register this URL in each provider's dashboard. The provider-specific
 * signature verification and payload shape are entirely encapsulated in
 * that provider's `parseWebhookEvents` implementation — this route stays
 * the same no matter how many providers you add.
 */
export const POST = withErrorHandling(async (req: Request, { params }: Params) => {
  let provider;
  try {
    provider = getMailProvider(params.provider);
  } catch {
    return apiError(400, `Unknown or unconfigured mail provider: ${params.provider}`);
  }

  const payload = await req.json().catch(() => null);
  if (payload === null) return apiError(400, "Invalid JSON payload");

  let events;
  try {
    events = await provider.parseWebhookEvents(payload, req.headers);
  } catch (error) {
    // Signature verification failures land here — reject, don't process.
    return apiError(401, error instanceof Error ? error.message : "Webhook verification failed");
  }

  for (const event of events) {
    await campaignService.recordWebhookEvent(event);
  }

  return NextResponse.json({ received: events.length });
});
