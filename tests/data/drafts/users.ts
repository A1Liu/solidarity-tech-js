import { z } from "zod";

/**
 * The whole response, inferred from `tests/data/users.json`.
 *
 * What this sample does NOT decide:
 * - sampled 1 row(s)
 * - null in every row, so the non-null type is unverified: age, alternate_name, assessment, branch_id, date_of_birth, second_language, timezone
 * - empty in every row, so the element type is unverified: other_emails, other_phone_numbers, secondary_languages, tags
 * - one row only — this sample decides no nullability at all; take it from `specElement`
 */

export const fixtureResponse = z.object({
  data: z.array(
    z.object({
      id: z.number().int(),
      hash_id: z.string(),
      phone_number: z.string(),
      email: z.string(),
      first_name: z.string(),
      last_name: z.string(),
      alternate_name: z.null(),
      date_of_birth: z.null(),
      age: z.null(),
      preferred_language: z.string(),
      second_language: z.null(),
      secondary_languages: z.array(z.any()),
      chapter_id: z.number().int(),
      chapter_ids: z.array(z.number().int()),
      branch_id: z.null(),
      created_at: z.string(),
      updated_at: z.string(),
      custom_user_properties: z.object({
        "ballot-revisit-url": z.null(),
        "ballot-image-url": z.null(),
        "2026_slate_candidate_engagements": z.null(),
        slate_event_count: z.null(),
        zohran_rsvp_count: z.null(),
        actionnetwork_action_count: z.null(),
        actionnetwork_action_types: z.null(),
      }),
      tags: z.array(z.any()),
      referral_code: z.string(),
      timezone: z.null(),
      address: z.object({
        address1: z.null(),
        address2: z.null(),
        city: z.null(),
        state: z.null(),
        zip_code: z.null(),
        country: z.null(),
        latitude: z.null(),
        longitude: z.null(),
      }),
      assessment: z.null(),
      sms_permission: z.boolean(),
      call_permission: z.boolean(),
      email_permission: z.boolean(),
      other_emails: z.array(z.any()),
      other_phone_numbers: z.array(z.any()),
    }),
  ),
  meta: z.object({
    total_count: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
  }),
});

/** One element, from the document's entity schema — stale, but it declares nullability and closed sets a sample cannot. */

export const specElement = z.object({
  id: z.number().int().optional(),
  hash_id: z.string().optional(),
  phone_number: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  preferred_language: z.string().optional(),
  second_language: z.string().nullable().optional(),
  chapter_id: z.number().int().optional(),
  branch_id: z.number().int().nullable().optional(),
  created_at: z.string().datetime({ offset: true }).optional(),
  custom_user_properties: z.record(z.string(), z.string()).optional(),
  address: z
    .object({
      address1: z.string().nullable().optional(),
      address2: z.string().nullable().optional(),
      city: z.string().nullable().optional(),
      state: z.string().nullable().optional(),
      zip_code: z.string().nullable().optional(),
      country: z.string().nullable().optional(),
    })
    .optional(),
  sms_permission: z.boolean().optional(),
  call_permission: z.boolean().optional(),
  email_permission: z.boolean().optional(),
});
