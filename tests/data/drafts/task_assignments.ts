import { z } from "zod";

/** One element, from the document's entity schema — stale, but it declares nullability and closed sets a sample cannot. */

export const specElement = z.object({
  id: z
    .number()
    .int()
    .describe("Unique identifier for the TaskAssignment")
    .optional(),
  user_id: z
    .number()
    .int()
    .describe("Identifier for the user associated with the TaskAssignment")
    .optional(),
  task_id: z
    .number()
    .int()
    .describe("Identifier for the task associated with the TaskAssignment")
    .optional(),
  agent_user_id: z
    .number()
    .int()
    .describe(
      "Identifier for the agent user associated with the TaskAssignment",
    )
    .optional(),
  created_at: z
    .string()
    .datetime({ offset: true })
    .describe("The date and time when the TaskAssignment was created")
    .optional(),
});
