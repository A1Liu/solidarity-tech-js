import { z } from "zod";

/** One element, from the document's entity schema — stale, but it declares nullability and closed sets a sample cannot. */

export const specElement = z.object({
  id: z
    .number()
    .int()
    .describe("Unique identifier for the textbank")
    .optional(),
  title: z.string().describe("Title of the textbank").optional(),
  medium: z.string().describe("Medium used for the textbank").optional(),
  begins_at: z
    .string()
    .datetime({ offset: true })
    .describe("Start time of the textbank")
    .optional(),
  ends_at: z
    .string()
    .datetime({ offset: true })
    .nullable()
    .describe("End time of the textbank")
    .optional(),
  targets: z.string().describe("Targets for the textbank").optional(),
  mobilize_event_id: z
    .number()
    .int()
    .nullable()
    .describe("Identifier for the associated mobilize event")
    .optional(),
  created_at: z
    .string()
    .datetime({ offset: true })
    .describe("Creation time of the textbank record")
    .optional(),
  sms_starting_script: z
    .object({
      en: z
        .string()
        .describe(
          "English version of the starting SMS script applies for multiple languages",
        )
        .optional(),
    })
    .nullable()
    .describe("Starting script for SMS in the textbank, localized by language")
    .optional(),
  sms_attachments: z
    .object({
      en: z
        .array(z.string().url().describe("URL of the attachment"))
        .describe("English version of the SMS attachments")
        .optional(),
    })
    .nullable()
    .describe("Attachments for SMS in the textbank, localized by language")
    .optional(),
  target_parameters: z
    .object({
      rules: z
        .array(
          z.object({
            id: z.string().describe("Identifier for the rule").optional(),
            type: z.string().describe("Type of the value").optional(),
            input: z.string().describe("Type of input").optional(),
            value: z.string().describe("Value for the rule").optional(),
            operator: z.string().describe("Operator for the rule").optional(),
          }),
        )
        .describe("Rules for targeting")
        .optional(),
      valid: z
        .boolean()
        .describe("Validity of the target parameters")
        .optional(),
      condition: z
        .string()
        .describe("Condition for combining rules")
        .optional(),
    })
    .nullable()
    .describe("Parameters for targeting in the phonebank")
    .optional(),
  hours: z
    .object({
      end: z.string().describe("End time in HH:MM format").optional(),
      start: z.string().describe("Start time in HH:MM format").optional(),
      enabled: z
        .boolean()
        .describe("Indicates if the hours are enabled")
        .optional(),
      timezone: z.string().describe("Timezone of the hours").optional(),
    })
    .nullable()
    .describe("Hours allocated for the textbank")
    .optional(),
  assignment_strategy: z
    .string()
    .nullable()
    .describe("Strategy for assigning texts in the textbank")
    .optional(),
  exclude_previously_rsvpd: z
    .boolean()
    .nullable()
    .describe("Indicates if previously RSVP’d contacts are excluded")
    .optional(),
  sort_order: z
    .string()
    .nullable()
    .describe("Sort order for contacts in the textbank")
    .optional(),
  sort_order_custom_filter: z
    .record(z.string(), z.any())
    .nullable()
    .describe("Custom filter for sorting order")
    .optional(),
  contact_strategy: z
    .string()
    .nullable()
    .describe("Strategy for contacting in the textbank")
    .optional(),
});
