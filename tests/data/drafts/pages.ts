import { z } from "zod";

/** One element, from the document's entity schema — stale, but it declares nullability and closed sets a sample cannot. */

export const specElement = z.object({
  id: z.number().int().describe("Unique identifier for the Page").optional(),
  type: z.string().describe("Type of the action page").optional(),
  url_slug: z.string().describe("URL slug for the Page").optional(),
  name: z.string().describe("Name of the Page").optional(),
  website_id: z
    .number()
    .int()
    .describe("Identifier for the website associated with the Page")
    .optional(),
  is_published: z
    .boolean()
    .describe("Indicates if the Page is published")
    .optional(),
  full_url: z.string().url().describe("Full URL of the Page").optional(),
  scope_id: z
    .number()
    .int()
    .describe("Scope identifier for the Page")
    .optional(),
  scope_type: z.enum(["Organization", "Chapter"]).nullable().optional(),
  supported_languages: z
    .array(z.string())
    .describe("Supported languages for the Page")
    .optional(),
  follow_up: z
    .record(z.string(), z.any())
    .nullable()
    .describe("Follow up configuration for the Page")
    .optional(),
  confirmations: z
    .record(z.string(), z.any())
    .nullable()
    .describe("Confirmation settings for the Page")
    .optional(),
  admin_notifications: z
    .record(z.string(), z.any())
    .nullable()
    .describe("Admin notification settings for the Page")
    .optional(),
  requires_user: z
    .boolean()
    .describe("Indicates if the Page requires a user")
    .optional(),
  always_hide_primary_nav: z
    .boolean()
    .describe(
      "Indicates if the primary navigation should always be hidden for the Page",
    )
    .optional(),
  always_hide_footer: z
    .boolean()
    .describe("Indicates if the footer should always be hidden for the Page")
    .optional(),
  allow_multiple_responses: z
    .boolean()
    .describe("Indicates if the Page allows multiple responses")
    .optional(),
  created_at: z
    .string()
    .datetime({ offset: true })
    .describe("Creation time of the Page")
    .optional(),
  form: z
    .array(
      z.object({
        name: z.string().describe("Name of the form field").optional(),
        show: z
          .enum(["required", "optional", "always_required"])
          .describe("Visibility requirement of the form field")
          .optional(),
        type: z
          .enum(["input", "select", "checkbox", "radio", "textarea", "file"])
          .describe("Type of the form field")
          .optional(),
        label: z
          .object({
            en: z.string().describe("English label").optional(),
            es: z.string().describe("Spanish label").optional(),
          })
          .describe("Label for the form field, supporting multiple languages")
          .optional(),
        input_template: z
          .string()
          .describe("Template type for the input field")
          .optional(),
        opt_in_language: z
          .string()
          .nullable()
          .describe("Language used for opt-in confirmation")
          .optional(),
        requires_opt_in: z
          .boolean()
          .describe("Indicates if opt-in is required")
          .optional(),
        phone_number_origin: z
          .enum(["home_country", "current_location"])
          .describe("Origin of the phone number")
          .optional(),
        validates_if_textable: z
          .boolean()
          .describe(
            "Indicates if the phone number should be validated for textability",
          )
          .optional(),
        desktop_label_column_width: z
          .number()
          .int()
          .describe("Width of the label column on desktop devices")
          .optional(),
      }),
    )
    .nullable()
    .describe("Form configuration for the Page")
    .optional(),
});
