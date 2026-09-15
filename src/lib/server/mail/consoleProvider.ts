import type { MailProvider, NormalizedWebhookEvent, SendEmailInput, SendEmailResult } from "./types";

/**
 * Logs emails to the console instead of sending them. This is the default
 * provider so the app runs end-to-end (including the campaign builder)
 * with zero external accounts configured. Swap MAIL_PROVIDER to "plunk"
 * or "loops" once you have API keys.
 */
export class ConsoleMailProvider implements MailProvider {
  readonly key = "console";
  readonly label = "Console (dev only — logs instead of sending)";

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    // eslint-disable-next-line no-console
    console.log(
      `[ConsoleMailProvider] would send "${input.content.subject}" from ${input.from.email} to ${input.to.email}`
    );
    return { ok: true, providerMessageId: `console_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` };
  }

  async parseWebhookEvents(_payload: unknown, _headers: Headers): Promise<NormalizedWebhookEvent[]> {
    return [];
  }
}
