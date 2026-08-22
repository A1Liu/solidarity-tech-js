import { z } from "zod";

/**
 * The whole response, inferred from `tests/data/team_members.json`.
 *
 * What this sample does NOT decide:
 * - sampled 1 row(s)
 * - one row only — this sample decides no nullability at all; take it from `specElement`
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

/** One element, from the document's entity schema — stale, but it declares nullability and closed sets a sample cannot. */

export const specElement = z.object({
  id: z
    .number()
    .int()
    .describe("Unique identifier for the TeamMember")
    .optional(),
  user_id: z
    .number()
    .int()
    .describe("Identifier for the user associated with the TeamMember")
    .optional(),
  scope_id: z
    .number()
    .int()
    .describe("Identifier for the scope associated with the TeamMember")
    .optional(),
  scope_type: z.enum(["Organization", "Chapter"]).nullable().optional(),
  logged_in_as_id: z
    .number()
    .int()
    .nullable()
    .describe("Identifier for the entity the TeamMember is logged in as")
    .optional(),
  logged_in_as_type: z
    .string()
    .nullable()
    .describe("Type of entity the TeamMember is logged in as")
    .optional(),
  last_app_activity_at: z
    .string()
    .datetime({ offset: true })
    .nullable()
    .describe("The date and time of the last app activity by the TeamMember")
    .optional(),
  created_at: z
    .string()
    .datetime({ offset: true })
    .describe("The date and time when the TeamMember was created")
    .optional(),
});
