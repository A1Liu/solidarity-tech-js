import { z } from "zod";

/**
 * The whole response, inferred from `tests/data/activities.json`.
 *
 * What this sample does NOT decide:
 * - sampled 6 row(s)
 * - one distinct value across the sample: user_id
 */

export const fixtureResponse = z.object({
  data: z.array(
    z.object({
      id: z.number().int(),
      user_id: z.number().int(),
      name: z.string(),
      actionable_id: z.number().int(),
      actionable_type: z.string(),
      action: z.union([
        z.null(),
        z.object({
          id: z.number().int(),
          to: z.string().optional(),
          user_id: z.number().int().optional(),
          subject: z.string().optional(),
          sent_at: z.string().optional(),
          opened_at: z.string().optional(),
          clicked_at: z.null().optional(),
          did_bounce: z.null().optional(),
          email_message_id: z.null().optional(),
          user_marked_as_spam: z.null().optional(),
          event_rsvp_id: z.null().optional(),
          action_page_id: z.null().optional(),
          user_action_id: z.null().optional(),
          user_role_scope_id: z.number().int().optional(),
          scope_id: z.number().int().optional(),
          scope_type: z.string().optional(),
          role_id: z.number().int().optional(),
          created_at: z.string().optional(),
          updated_at: z.string().optional(),
        }),
      ]),
      created_at: z.string(),
    }),
  ),
  meta: z.object({
    total_count: z.null(),
    limit: z.number().int(),
    offset: z.number().int(),
    cursor: z.null(),
    next_cursor: z.null(),
  }),
});
