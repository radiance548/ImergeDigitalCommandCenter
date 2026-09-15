import nodemailer, { type Transporter } from "nodemailer";
import type { MailProvider, NormalizedWebhookEvent, SendEmailInput, SendEmailResult } from "./types";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

/**
 * Generic SMTP provider — works with Zoho Mail's SMTP relay (smtp.zoho.com,
 * port 465/587), or any other SMTP account. No native audience management
 * or delivery webhooks, so this is best suited to low-volume sends or as a
 * fallback; for real campaign analytics prefer Plunk or Loops.
 */
export class SmtpMailProvider implements MailProvider {
  readonly key = "smtp";
  readonly label = "SMTP (e.g. Zoho Mail)";
  private transporter: Transporter;

  constructor(config: SmtpConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
    });
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    try {
      const info = await this.transporter.sendMail({
        from: input.from.name ? `"${input.from.name}" <${input.from.email}>` : input.from.email,
        to: input.to.name ? `"${input.to.name}" <${input.to.email}>` : input.to.email,
        subject: input.content.subject,
        html: input.content.html,
        text: input.content.text,
      });
      return { ok: true, providerMessageId: info.messageId };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "SMTP send failed" };
    }
  }

  async parseWebhookEvents(_payload: unknown, _headers: Headers): Promise<NormalizedWebhookEvent[]> {
    // Plain SMTP has no delivery/open/click webhooks. Analytics for
    // campaigns sent via this provider will only ever show "sent".
    return [];
  }
}
