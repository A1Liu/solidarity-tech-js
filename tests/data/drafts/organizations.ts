import { z } from "zod";

/**
 * The whole response, inferred from `tests/data/organizations.json`.
 *
 * What this sample does NOT decide:
 * - sampled 1 row(s)
 * - one row only — this sample decides no nullability at all
 */

export const fixtureResponse = z.object({
  data: z.array(
    z.object({
      id: z.number().int(),
      name: z.string(),
      image_url: z.string(),
      parent_organization_id: z.number().int(),
      default_language: z.string(),
      supported_languages: z.array(z.string()),
      assessment_statuses: z.array(
        z.object({
          key: z.string(),
          color: z.string(),
          label: z.string(),
          description: z.string(),
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

/**
 * The whole response, inferred from `tests/data/organizations.item.json`.
 */

export const itemResponse = z.object({
  data: z.object({
    id: z.number().int(),
    name: z.string(),
    image_url: z.string(),
    parent_organization_id: z.number().int(),
    default_language: z.string(),
    supported_languages: z.array(z.string()),
    assessment_statuses: z.array(
      z.object({
        key: z.string(),
        color: z.string(),
        label: z.string(),
        description: z.string(),
      }),
    ),
    children: z.array(z.any()),
    parent: z.object({
      id: z.number().int(),
      name: z.string(),
      image_url: z.string(),
      parent_organization_id: z.null(),
      default_language: z.string(),
      supported_languages: z.array(z.string()),
      assessment_statuses: z.array(
        z.object({
          key: z.string(),
          color: z.string(),
          label: z.string(),
          description: z.string(),
        }),
      ),
    }),
  }),
  meta: z.object({
    total_count: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
  }),
});
