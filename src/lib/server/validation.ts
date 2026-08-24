import { z } from "zod";

// A campaign can be created/saved before its sending address is known —
// ScheduleStep already blocks actually sending until fromEmail is a real
// value (see ScheduleStep.tsx's canSend check) — so validation here only
// needs to reject garbage, not require a value to be present yet.
const blankOrEmail = z.union([z.literal(""), z.string().email()]);

export const campaignContentSchema = z.object({
  subject: z.string().min(1, "Subject is required").max(200),
  preheader: z.string().max(200).optional(),
  bodyHtml: z.string().min(1, "Email body is required"),
  fromName: z.string().min(1).max(100).default("Imerge"),
  fromEmail: blankOrEmail,
});

export const createCampaignSchema = campaignContentSchema.extend({
  templateId: z.string().optional(),
  audienceId: z.string().optional(),
  provider: z.string().optional(),
});

export const updateCampaignSchema = campaignContentSchema.partial().extend({
  templateId: z.string().nullable().optional(),
  audienceId: z.string().nullable().optional(),
  provider: z.string().optional(),
});

export const scheduleCampaignSchema = z.object({
  scheduledAt: z.string().datetime(),
});

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  html: z.string().min(1),
  thumbnailUrl: z.string().url().optional(),
});

export const createAudienceSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
});

export const importContactsSchema = z.object({
  contacts: z
    .array(
      z.object({
        email: z.string().email(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        attributes: z.record(z.unknown()).optional(),
      })
    )
    .min(1)
    .max(5000),
});
