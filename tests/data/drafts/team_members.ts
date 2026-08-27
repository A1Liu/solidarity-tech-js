import { z } from "zod";

/**
 * The whole response, inferred from `tests/data/team_members.json`.
 *
 * What this sample does NOT decide:
 * - sampled 1 row(s)
 * - one row only — this sample decides no nullability at all
 */

export const fixtureResponse = z.object({
  data: z.array(
    z.object({
      id: z.number().int(),
      user_id: z.number().int(),
      scope_id: z.number().int(),
      scope_type: z.string(),
      role_id: z.number().int(),
      logged_in_as_id: z.number().int(),
      logged_in_as_type: z.string(),
      last_app_activity_at: z.string(),
      created_at: z.string(),
      assignments: z.array(
        z.object({
          id: z.number().int(),
          scope_id: z.number().int(),
          scope_type: z.string(),
          role_id: z.number().int(),
          role_name: z.string(),
        }),
      ),
    }),
  ),
  meta: z.object({
    total_count: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
  }),
});
