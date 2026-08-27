import { z } from "zod";

/**
 * The whole response, inferred from `tests/data/chapters.json`.
 *
 * What this sample does NOT decide:
 * - sampled 1 row(s)
 * - null in every row, so the non-null type is unverified: calendar_feed_url, logo_url
 * - one row only — this sample decides no nullability at all
 */

export const fixtureResponse = z.object({
  data: z.array(
    z.object({
      id: z.number().int(),
      name: z.string(),
      logo_url: z.null(),
      organization_id: z.number().int(),
      chapter_phone_number: z.string(),
      calendar_feed_url: z.null(),
    }),
  ),
  meta: z.object({
    total_count: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
    organization_name: z.string(),
  }),
});
