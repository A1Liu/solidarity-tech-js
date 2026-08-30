import { z } from "zod";

/**
 * The whole response, inferred from `tests/data/custom_user_properties.json`.
 *
 * What this sample does NOT decide:
 * - sampled 5 row(s)
 * - one distinct value across the sample: required, scope_id, scope_type
 */

export const fixtureResponse = z.object({
  data: z.array(
    z.object({
      id: z.number().int(),
      name: z.string(),
      key: z.string(),
      field_type: z.string(),
      options: z.array(
        z.object({ label: z.object({ en: z.string() }), value: z.string() }),
      ),
      required: z.boolean(),
      label: z.string(),
      description: z.union([z.null(), z.string()]),
      scope_id: z.number().int(),
      scope_type: z.string(),
      created_at: z.string(),
    }),
  ),
  meta: z.object({
    total_count: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
  }),
});
