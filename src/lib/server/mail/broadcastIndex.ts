import { ResendBroadcastProvider } from "./resendBroadcastProvider";
import type { BroadcastProvider } from "./broadcastProvider";

export * from "./broadcastProvider";

let instance: BroadcastProvider | undefined;

/**
 * Returns the Campaign Builder's broadcast provider. Resend today — see
 * broadcastProvider.ts for why this is a narrower, Resend-specific
 * interface rather than folded into the general MailProvider abstraction.
 */
export function getBroadcastProvider(): BroadcastProvider {
  if (!instance) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY is not set — required for the Campaign Builder (Resend Broadcasts).");
    instance = new ResendBroadcastProvider(apiKey);
  }
  return instance;
}
