import { z } from "zod";

/**
 * The whole response, inferred from `tests/data/organizations.json`.
 *
 * What this sample does NOT decide:
 * - sampled 1 row(s)
 * - one row only — this sample decides no nullability at all; take it from `specElement`
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

/** One element, from the document's entity schema — stale, but it declares nullability and closed sets a sample cannot. */

export const specElement = z.object({
  name: z.string().describe("Name of the organization").optional(),
  image_url: z
    .string()
    .nullable()
    .describe("URL of the organization's image")
    .optional(),
  parent_organization_id: z
    .number()
    .int()
    .nullable()
    .describe("ID of the parent organization, if any")
    .optional(),
  default_language: z
    .string()
    .describe("Default language of the organization")
    .optional(),
  supported_languages: z
    .array(z.string())
    .describe("List of languages supported by the organization")
    .optional(),
});
