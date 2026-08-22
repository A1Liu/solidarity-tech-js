import { z } from "zod";

/** One element, from the document's entity schema — stale, but it declares nullability and closed sets a sample cannot. */

export const specElement = z.object({
  name: z.string().describe("Name of the UserList").optional(),
  parameters: z
    .record(z.string(), z.any())
    .describe("JSONB parameters associated with the UserList")
    .optional(),
  user_id: z
    .number()
    .int()
    .describe("Identifier for the user associated with the UserList")
    .optional(),
  scope_id: z
    .number()
    .int()
    .describe("Identifier for the scope associated with the UserList")
    .optional(),
  scope_type: z.enum(["Organization", "Chapter"]).nullable().optional(),
  created_at: z
    .string()
    .datetime({ offset: true })
    .describe("The date and time when the UserList was created")
    .optional(),
});
