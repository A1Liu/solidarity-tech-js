import { z } from "zod";

/** One element, from the document's entity schema — stale, but it declares nullability and closed sets a sample cannot. */

export const specElement = z.object({
  id: z
    .number()
    .int()
    .describe("Unique identifier for the TaskAgent")
    .optional(),
  user_id: z
    .number()
    .int()
    .describe("Identifier for the user associated with the TaskAgent")
    .optional(),
  task_id: z
    .number()
    .int()
    .describe("Identifier for the task associated with the TaskAgent")
    .optional(),
  created_at: z
    .string()
    .datetime({ offset: true })
    .describe("The date and time when the TaskAgent was created")
    .optional(),
});
