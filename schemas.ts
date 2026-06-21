import { z } from "zod";

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

/** Postal address embedded in a user record. */
export const userAddress = z.object({
  address1: z.string().nullable(),
  address2: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  zip_code: z.string().nullable(),
  country: z.string().nullable(),
});

// GET /activities
export const activity = z.object({
  id: z.number().int(),
  user_id: z.number().int(),
  name: z.string(),
  actionable_id: z.number().int(),
  actionable_type: z.string(),
  action: z.object({
    id: z.number().int(),
    user_id: z.number().int(),
    agent_user_id: z.number().int().nullable(),
    field_type: z.string().nullable(),
    old_value: z.string().nullable(),
    new_value: z.string().nullable(),
    data_import_id: z.number().int().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
  }),
  created_at: z.string(),
  updated_at: z.string(),
});
export const activitiesResponse = z.object({
  data: z.array(activity),
  meta: paginationMeta,
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
export const callsResponse = z.object({
  data: z.array(call),
  meta: paginationMeta,
});

// GET /chapters
export const chapter = z.object({
  id: z.number().int(),
  name: z.string(),
  logo_url: z.string().nullable(),
  organization_id: z.number().int(),
  chapter_phone_number: z.string(),
});
export const chaptersResponse = z.object({
  data: z.array(chapter),
  meta: paginationMeta,
});

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
  scope_id: z.number().int(),
  scope_type: z.enum(["Organization", "Chapter"]),
});
export const customUserPropertiesResponse = z.object({
  data: z.array(customUserProperty),
  meta: paginationMeta,
});

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
export const textsResponse = z.object({
  data: z.array(text),
  meta: paginationMeta,
});

// GET /users
export const user = z.object({
  id: z.number().int(),
  hash_id: z.string(),
  phone_number: z.string().nullable(),
  email: z.string().nullable(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  preferred_language: z.string(),
  second_language: z.string().nullable(),
  chapter_id: z.number().int(),
  branch_id: z.number().int().nullable(),
  created_at: z.string(),
  custom_user_properties: z.record(z.string(), z.string()),
  address: userAddress,
  sms_permission: z.boolean(),
  call_permission: z.boolean(),
  email_permission: z.boolean(),
});
export const usersResponse = z.object({
  data: z.array(user),
  meta: paginationMeta,
});

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

export type Activity = z.infer<typeof activity>;
export type ActivitiesResponse = z.infer<typeof activitiesResponse>;
export type Call = z.infer<typeof call>;
export type CallsResponse = z.infer<typeof callsResponse>;
export type Chapter = z.infer<typeof chapter>;
export type ChaptersResponse = z.infer<typeof chaptersResponse>;
export type CustomUserProperty = z.infer<typeof customUserProperty>;
export type CustomUserPropertiesResponse = z.infer<typeof customUserPropertiesResponse>;
export type Text = z.infer<typeof text>;
export type TextsResponse = z.infer<typeof textsResponse>;
export type User = z.infer<typeof user>;
export type UsersResponse = z.infer<typeof usersResponse>;
