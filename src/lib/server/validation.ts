import { z } from "zod";

export const campaignContentSchema = z.object({
  subject: z.string().min(1, "Subject is required").max(200),
  preheader: z.string().max(200).optional(),
  bodyHtml: z.string().min(1, "Email body is required"),
  fromName: z.string().min(1).max(100).default("Imerge"),
  fromEmail: z.string().email(),
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
