import { z } from "zod";
import type { ZodType } from "zod";

/**
 * Zod schemas for the only endpoints whose responses are described with a body
 * schema in the OpenAPI document. Every other endpoint documents its response
 * with a bare description, so those calls fall back to `z.unknown()`.
 */

/** Pagination envelope returned alongside every list response. */
export const paginationMeta = z.object({
  total_count: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
});

/* ------------------------------------------------------------------ *
 * Response envelopes
 *
 * The API wraps every resource in one of three envelopes, confirmed live
 * across resources. Building them from an element schema keeps the split
 * visible — in particular that a mutation carries no `meta`, which is easy to
 * copy wrongly from the list schema next to it.
 * ------------------------------------------------------------------ */

/** `GET /things` — a page of elements. */
export function listResponse<T extends ZodType>(element: T) {
  return z.object({ data: z.array(element), meta: paginationMeta });
}

/** `GET /things/{id}` — one element, in the same envelope as the list. */
export function itemResponse<T extends ZodType>(element: T) {
  return z.object({ data: element, meta: paginationMeta });
}

/** `POST /things`, `PUT /things/{id}` — one element, and no pagination `meta`. */
export function mutationResponse<T extends ZodType>(element: T) {
  return z.object({ data: element });
}

/** Postal address embedded in a user record. */
export const userAddress = z.object({
  address1: z.string().nullable(),
  address2: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  zip_code: z.string().nullable(),
  country: z.string().nullable(),
  // Null in every captured address, so the non-null type is unverified.
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
});

/**
 * Cursor-paginated `meta`. GET /activities streams by cursor, so `total_count`
 * is null and cursor tokens accompany it — unlike the offset {@link paginationMeta}.
 */
export const cursorMeta = z.object({
  total_count: z.number().int().nullable(),
  limit: z.number().int(),
  offset: z.number().int(),
  // Cursor tokens are numeric ids; null when there is no page in that direction.
  cursor: z.number().int().nullable(),
  next_cursor: z.number().int().nullable(),
});

// GET /activities
export const activity = z.object({
  id: z.number().int(),
  user_id: z.number().int(),
  name: z.string(),
  actionable_id: z.number().int(),
  actionable_type: z.string(),
  // `action` is polymorphic: its shape depends on `actionable_type` (an email
  // action, a field-change action, an RSVP, …), so the value type is left open.
  // Null for actionable types that carry no payload.
  action: z.record(z.string(), z.unknown()).nullable(),
  created_at: z.string(),
});
export const activitiesResponse = z.object({
  data: z.array(activity),
  meta: cursorMeta,
});

// GET /calls
export const call = z.object({
  id: z.number().int(),
  user_id: z.number().int(),
  direction: z.string(),
  agent_user_id: z.number().int().nullable(),
  duration: z.number().int(),
  picked_up: z.boolean(),
  left_voicemail: z.boolean(),
  twilio_call_sid: z.string(),
  created_at: z.string(),
  ended_at: z.string(),
});
export const callsResponse = listResponse(call);

// GET /chapters
export const chapter = z.object({
  id: z.number().int(),
  name: z.string(),
  logo_url: z.string().nullable(),
  organization_id: z.number().int(),
  chapter_phone_number: z.string(),
  calendar_feed_url: z.string().nullable(),
});
export const chaptersResponse = listResponse(chapter);

// GET /custom_user_properties
export const customUserProperty = z.object({
  id: z.number().int(),
  name: z.string(),
  key: z.string(),
  field_type: z.string(),
  options: z
    .array(
      z.object({
        label: z.record(z.string(), z.string().nullable()),
        value: z.string(),
      }),
    )
    .nullable(),
  required: z.boolean(),
  label: z.string(),
  description: z.string().nullable(),
  scope_id: z.number().int(),
  scope_type: z.enum(["Organization", "Chapter"]),
  created_at: z.string(),
});
export const customUserPropertiesResponse = listResponse(customUserProperty);

// GET /texts
export const text = z.object({
  id: z.number().int(),
  user_id: z.number().int(),
  direction: z.string(),
  body: z.string(),
  media_urls: z.array(z.string()),
  segment_size: z.number().int(),
  chapter_phone_number_id: z.number().int(),
  twilio_error_code: z.number().int().nullable(),
  created_at: z.string(),
});
export const textsResponse = listResponse(text);

// GET /users
// NOTE: the test account holds a single user, so nullability of the fields that
// were null/empty in that one row (alternate_name, date_of_birth, age, timezone,
// assessment, and the empty arrays) is inferred defensively, not verified.
export const user = z.object({
  id: z.number().int(),
  hash_id: z.string(),
  phone_number: z.string().nullable(),
  email: z.string().nullable(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  alternate_name: z.string().nullable(),
  date_of_birth: z.string().nullable(),
  age: z.number().int().nullable(),
  preferred_language: z.string(),
  second_language: z.string().nullable(),
  secondary_languages: z.array(z.string()),
  chapter_id: z.number().int(),
  chapter_ids: z.array(z.number().int()),
  branch_id: z.number().int().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  // Values are per-organization and not all strings (numbers, arrays, nulls all
  // appear in the live audit), so the value type is left open.
  custom_user_properties: z.record(z.string(), z.unknown()),
  tags: z.array(z.string()),
  referral_code: z.string(),
  timezone: z.string().nullable(),
  address: userAddress,
  // Shape unverified — null in every captured user.
  assessment: z.unknown().nullable(),
  sms_permission: z.boolean(),
  call_permission: z.boolean(),
  email_permission: z.boolean(),
  // Empty in every captured user, so element types are unverified.
  other_emails: z.array(z.unknown()),
  other_phone_numbers: z.array(z.unknown()),
});
export const usersResponse = listResponse(user);

/* ------------------------------------------------------------------ *
 * Shared request shapes
 * ------------------------------------------------------------------ */

/** Pagination/`_since` parameters common to every list endpoint. */
export interface ListParams {
  _limit?: number;
  _offset?: number;
  _since?: number;
}

export type ScopeType = "Organization" | "Chapter";

export interface Address {
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  country?: string | null;
}

export interface EventLocationData {
  components?: string | null;
  coordinates?: string | null;
  address_city?: string | null;
  full_address?: string | null;
  address_state?: string | null;
  address_line_1?: string | null;
  address_country?: string | null;
  address_postal_code?: string | null;
}

export type CursorMeta = z.infer<typeof cursorMeta>;
export type Activity = z.infer<typeof activity>;
export type ActivitiesResponse = z.infer<typeof activitiesResponse>;
export type Call = z.infer<typeof call>;
export type CallsResponse = z.infer<typeof callsResponse>;
export type Chapter = z.infer<typeof chapter>;
export type ChaptersResponse = z.infer<typeof chaptersResponse>;
export type CustomUserProperty = z.infer<typeof customUserProperty>;
export type CustomUserPropertiesResponse = z.infer<
  typeof customUserPropertiesResponse
>;
export type Text = z.infer<typeof text>;
export type TextsResponse = z.infer<typeof textsResponse>;
export type User = z.infer<typeof user>;
export type UsersResponse = z.infer<typeof usersResponse>;
