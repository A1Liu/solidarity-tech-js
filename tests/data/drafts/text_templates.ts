import { z } from "zod";

/** One element, from the document's entity schema — stale, but it declares nullability and closed sets a sample cannot. */

export const specElement = z.object({
  id: z
    .number()
    .int()
    .describe("Unique identifier for the TextTemplate")
    .optional(),
  name: z.string().describe("Name of the TextTemplate"),
  scope_id: z
    .number()
    .int()
    .describe("Identifier for the scope associated with the TextTemplate"),
  scope_type: z.enum(["Organization", "Chapter"]).nullable(),
  template: z
    .record(z.string(), z.string())
    .describe(
      "Template content in various languages, where keys are 2-character language codes and values are the corresponding messages.",
    )
    .optional(),
  event_id: z
    .number()
    .int()
    .nullable()
    .describe(
      "Identifier for the event associated with the TextTemplate, if applicable",
    )
    .optional(),
  created_at: z
    .string()
    .datetime({ offset: true })
    .describe("The date and time when the TextTemplate was created")
    .optional(),
});
