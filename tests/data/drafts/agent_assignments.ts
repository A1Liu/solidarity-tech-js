import { z } from "zod";

/**
 * The whole response, inferred from `tests/data/agent_assignments.json`.
 *
 * What this sample does NOT decide:
 * - sampled 4 row(s)
 * - one distinct value across the sample: agent_user_id, is_active, user_id
 */

export const fixtureResponse = z.object({
  data: z.array(
    z.object({
      id: z.number().int(),
      agent_user_id: z.number().int(),
      user_id: z.number().int(),
      created_at: z.string(),
      is_active: z.boolean(),
    }),
  ),
  meta: z.object({
    total_count: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
  }),
});

/**
 * The whole response, inferred from `tests/data/agent_assignments.item.json`.
 */

export const itemResponse = z.object({
  data: z.object({
    id: z.number().int(),
    agent_user_id: z.number().int(),
    user_id: z.number().int(),
    created_at: z.string(),
    is_active: z.boolean(),
  }),
  meta: z.object({
    total_count: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
  }),
});
