import { z } from "zod";

/** One element, from the document's entity schema — stale, but it declares nullability and closed sets a sample cannot. */

export const specElement = z.object({
  id: z
    .number()
    .int()
    .describe("Unique identifier for the Email Blast")
    .optional(),
  name: z.string().describe("Name of the Email Blast").optional(),
  target_parameters: z
    .object({
      rules: z
        .array(
          z.object({
            id: z.string().optional(),
            type: z.string().optional(),
            field: z.string().optional(),
            input: z.string().optional(),
            value: z.array(z.string()).optional(),
            operator: z.string().optional(),
          }),
        )
        .optional(),
      valid: z.boolean().optional(),
      condition: z.string().optional(),
    })
    .optional(),
  subject: z.object({ en: z.string().optional() }).optional(),
  content: z.record(z.string(), z.any()).optional(),
  attachments: z.record(z.string(), z.any()).optional(),
  from: z.string().optional(),
  email_sender_id: z.number().int().nullable().optional(),
  reply_to: z.string().nullable().optional(),
  email_wrapper_id: z.number().int().nullable().optional(),
  supported_languages: z.array(z.string()).optional(),
  track_opens: z.boolean().optional(),
  track_clicks: z.boolean().optional(),
  limit_sends: z.number().int().nullable().optional(),
  is_valid: z.boolean().optional(),
  scheduled_to_send_at: z
    .string()
    .datetime({ offset: true })
    .nullable()
    .optional(),
  is_send_in_progress: z.boolean().nullable().optional(),
  finished_delivering_at: z
    .string()
    .datetime({ offset: true })
    .nullable()
    .optional(),
  target_count_at_send_time: z.number().int().nullable().optional(),
  created_at: z.string().datetime({ offset: true }).optional(),
  results: z
    .object({
      sent: z.number().int().optional(),
      delivererd: z.number().int().optional(),
      unsubscribed: z.number().int().optional(),
      bounced: z.number().int().optional(),
      complained: z.number().int().optional(),
      opened: z.number().int().optional(),
      clicked: z.number().int().optional(),
    })
    .optional(),
});
