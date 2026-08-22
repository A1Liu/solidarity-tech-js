import { z } from "zod";

/** One element, from the document's entity schema — stale, but it declares nullability and closed sets a sample cannot. */

export const specElement = z.object({
  due_at: z
    .string()
    .datetime({ offset: true })
    .describe("The date and time when the task is due"),
  remind_at: z
    .string()
    .datetime({ offset: true })
    .nullable()
    .describe("The date and time when a reminder for the task should be sent")
    .optional(),
  agent_user_id: z
    .number()
    .int()
    .nullable()
    .describe("Identifier for the agent user assigned to the task"),
  user_id: z
    .number()
    .int()
    .describe("Identifier for the user who created the task"),
  notes: z
    .string()
    .nullable()
    .describe("Additional notes or details about the task")
    .optional(),
  task_type: z.string().describe("The type or category of the task").optional(),
  marked_as_completed: z
    .boolean()
    .nullable()
    .describe("Indicates if the task has been marked as completed")
    .optional(),
});
