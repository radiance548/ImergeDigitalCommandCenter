import { PlunkBroadcastProvider } from "./plunkBroadcastProvider";
import type { BroadcastProvider } from "./broadcastProvider";

export * from "./broadcastProvider";

let instance: BroadcastProvider | undefined;

/**
 * Returns the Campaign Builder's broadcast provider. Plunk today — see
 * broadcastProvider.ts for why this is a narrower, Plunk-specific
 * interface rather than folded into the general MailProvider abstraction.
 */
export function getBroadcastProvider(): BroadcastProvider {
  if (!instance) {
    const apiKey = process.env.PLUNK_API_KEY;
    if (!apiKey) throw new Error("PLUNK_API_KEY is not set — required for the Campaign Builder (Plunk Campaigns).");
    instance = new PlunkBroadcastProvider(apiKey);
  }
  return instance;
}
