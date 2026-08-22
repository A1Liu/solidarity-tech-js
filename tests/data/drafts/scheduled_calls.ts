import { z } from "zod";

/** One element, from the document's entity schema — stale, but it declares nullability and closed sets a sample cannot. */

export const specElement = z.object({
  user_id: z
    .number()
    .int()
    .describe("Identifier for the user associated with the scheduled call"),
  agent_user_id: z
    .number()
    .int()
    .nullable()
    .describe(
      "Identifier for the agent user associated with the scheduled call",
    )
    .optional(),
  call_time: z
    .string()
    .datetime({ offset: true })
    .describe("The scheduled time for the call"),
  language: z
    .string()
    .nullable()
    .describe("The language preference for the scheduled call")
    .optional(),
  page_id: z
    .number()
    .int()
    .describe(
      "Identifier for the action page associated with the scheduled call",
    ),
  created_at: z
    .string()
    .datetime({ offset: true })
    .describe("The creation time of the scheduled call record"),
  agent_user_call_id: z
    .number()
    .int()
    .nullable()
    .describe("Unique identifier for the call made by the agent user")
    .optional(),
});
