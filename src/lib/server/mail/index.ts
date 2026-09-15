import { ConsoleMailProvider } from "./consoleProvider";
import { PlunkMailProvider } from "./plunkProvider";
import { LoopsMailProvider } from "./loopsProvider";
import { SmtpMailProvider } from "./smtpProvider";
import type { MailProvider } from "./types";

export type { MailProvider } from "./types";
export * from "./types";

const registry = new Map<string, MailProvider>();

function buildProvider(key: string): MailProvider {
  switch (key) {
    case "plunk": {
      const apiKey = process.env.PLUNK_API_KEY;
      if (!apiKey) throw new Error("PLUNK_API_KEY is not set");
      return new PlunkMailProvider(apiKey);
    }
    case "loops": {
      const apiKey = process.env.LOOPS_API_KEY;
      if (!apiKey) throw new Error("LOOPS_API_KEY is not set");
      return new LoopsMailProvider(apiKey, process.env.LOOPS_TRANSACTIONAL_ID);
    }
    case "smtp": {
      const host = process.env.SMTP_HOST;
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;
      if (!host || !user || !pass) throw new Error("SMTP_HOST, SMTP_USER, SMTP_PASS must all be set");
      return new SmtpMailProvider({
        host,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === "true",
        user,
        pass,
      });
    }
    case "console":
    default:
      return new ConsoleMailProvider();
  }
}

/**
 * Returns the mail provider for the given key, defaulting to the
 * MAIL_PROVIDER environment variable, then "console" (dev-safe no-op).
 * Campaigns store the provider key they were sent through on the
 * EmailCampaign row, so historic sends always resolve to the right
 * implementation even if the default changes later.
 */
export function getMailProvider(key?: string): MailProvider {
  const resolvedKey = key || process.env.MAIL_PROVIDER || "console";
  const cached = registry.get(resolvedKey);
  if (cached) return cached;
  const provider = buildProvider(resolvedKey);
  registry.set(resolvedKey, provider);
  return provider;
}

/** All providers available for the campaign wizard's "send via" picker. */
export function listMailProviders(): { key: string; label: string; configured: boolean }[] {
  return [
    { key: "console", label: "Console (dev only — logs instead of sending)", configured: true },
    { key: "plunk", label: "Plunk", configured: Boolean(process.env.PLUNK_API_KEY) },
    { key: "loops", label: "Loops", configured: Boolean(process.env.LOOPS_API_KEY) },
    { key: "smtp", label: "SMTP (e.g. Zoho Mail)", configured: Boolean(process.env.SMTP_HOST) },
  ];
}
