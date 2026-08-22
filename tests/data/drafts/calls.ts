import { z } from "zod";

/** One element, from the document's entity schema — stale, but it declares nullability and closed sets a sample cannot. */

export const specElement = z.object({
  id: z.number().int().optional(),
  user_id: z.number().int().optional(),
  direction: z.string().optional(),
  agent_user_id: z.number().int().nullable().optional(),
  duration: z.number().int().optional(),
  picked_up: z.boolean().optional(),
  left_voicemail: z.boolean().optional(),
  twilio_call_sid: z.string().optional(),
  created_at: z.string().datetime({ offset: true }).optional(),
  ended_at: z.string().datetime({ offset: true }).optional(),
});
