import { z } from "zod";

/** One element, from the document's entity schema — stale, but it declares nullability and closed sets a sample cannot. */

export const specElement = z.object({
  id: z.number().int().optional(),
  user_id: z.number().int().optional(),
  direction: z.string().optional(),
  body: z.string().optional(),
  media_urls: z.array(z.string()).optional(),
  segment_size: z.number().int().optional(),
  chapter_phone_number_id: z.number().int().optional(),
  twilio_error_code: z.number().int().nullable().optional(),
  created_at: z.string().datetime({ offset: true }).optional(),
});
