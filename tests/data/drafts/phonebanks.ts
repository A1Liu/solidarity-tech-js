import { z } from "zod";

/** One element, from the document's entity schema — stale, but it declares nullability and closed sets a sample cannot. */

export const specElement = z.object({
  id: z
    .number()
    .int()
    .describe("Unique identifier for the phonebank")
    .optional(),
  title: z.string().describe("Title of the phonebank").optional(),
  medium: z.string().describe("Medium used for the phonebank").optional(),
  begins_at: z
    .string()
    .datetime({ offset: true })
    .describe("Start time of the phonebank")
    .optional(),
  ends_at: z
    .string()
    .datetime({ offset: true })
    .nullable()
    .describe("End time of the phonebank")
    .optional(),
  targets: z.string().describe("Targets for the phonebank").optional(),
  mobilize_event_id: z
    .number()
    .int()
    .nullable()
    .describe("Identifier for the associated mobilize event")
    .optional(),
  created_at: z
    .string()
    .datetime({ offset: true })
    .describe("Creation time of the phonebank record")
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
    .describe("Strategy for assigning calls in the phonebank")
    .optional(),
  exclude_previously_rsvpd: z
    .boolean()
    .nullable()
    .describe("Indicates if previously RSVP’d contacts are excluded")
    .optional(),
  sort_order: z
    .string()
    .nullable()
    .describe("Sort order for contacts in the phonebank")
    .optional(),
  sort_order_custom_filter: z
    .record(z.string(), z.any())
    .nullable()
    .describe("Custom filter for sorting order")
    .optional(),
  contact_strategy: z
    .string()
    .nullable()
    .describe("Strategy for contacting in the phonebank")
    .optional(),
  call_script: z
    .string()
    .nullable()
    .describe("Script for calls in the phonebank")
    .optional(),
  dialer_strategy: z
    .string()
    .nullable()
    .describe("Dialer strategy used in the phonebank")
    .optional(),
  voicemail: z
    .record(z.string(), z.any())
    .nullable()
    .describe("Voicemail settings for the phonebank")
    .optional(),
  abandoned_calls: z
    .string()
    .nullable()
    .describe("Policy for abandoned calls in the phonebank")
    .optional(),
  acceptable_abandon_rate: z
    .number()
    .nullable()
    .describe("Acceptable rate of abandoned calls in the phonebank")
    .optional(),
  sms_automation: z
    .record(z.string(), z.any())
    .nullable()
    .describe("SMS automation settings for the phonebank")
    .optional(),
  minimum_callers_for_predictive_dialing: z
    .number()
    .int()
    .nullable()
    .describe("Minimum number of callers for predictive dialing to be enabled")
    .optional(),
});
