import { z } from "zod";

/** One element, from the document's entity schema — stale, but it declares nullability and closed sets a sample cannot. */

export const specElement = z.object({
  event_id: z.number().int().describe("Identifier for the Mobilize event"),
  event_session_id: z
    .number()
    .int()
    .describe("Identifier for the specific event session"),
  user_id: z
    .number()
    .int()
    .describe("Identifier for the user attending to the event"),
  attended: z.boolean().describe("Indicates if the user attended the event"),
});
