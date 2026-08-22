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
    .describe("Identifier for the user RSVPing to the event"),
  is_attending: z
    .enum(["yes", "no", "maybe"])
    .describe("Indicates if the user is attending the event")
    .optional(),
  is_confirmed: z
    .boolean()
    .describe("Indicates if the RSVP is confirmed")
    .optional(),
  agent_user_id: z
    .number()
    .int()
    .nullable()
    .describe("Identifier for the agent user, if applicable")
    .optional(),
  source: z.string().nullable().describe("Source of the RSVP").optional(),
  source_system: z
    .string()
    .nullable()
    .describe("System from which the RSVP originated")
    .optional(),
});
