import { z } from "zod";
import { apiGet } from "../client";
import type { ApiResult, ClientConfig } from "../client";
import { paginationMeta } from "../schemas";
import type { ListParams } from "../schemas";

/* ------------------------------------------------------------------ *
 * Schemas
 * ------------------------------------------------------------------ */

/** Parsed `{lng, lat}` pair. */
export const StCoordinates = z.object({
  lng: z.number(),
  lat: z.number(),
});

// The raw API sends `coordinates` as either a `{lat, lng}` object, an empty
// string (when ungeocoded), a JSON-stringified `{lng, lat}`, or null/absent.
// Normalize all of those into a `StCoordinates | null`.
const coordinatesField = z
  .union([StCoordinates, z.string(), z.null()])
  .optional()
  .transform((val): z.infer<typeof StCoordinates> | null => {
    if (val == null || val === "") return null;
    if (typeof val === "string") {
      try {
        const parsed = StCoordinates.safeParse(JSON.parse(val));
        return parsed.success ? parsed.data : null;
      } catch {
        return null;
      }
    }
    return val;
  });

/** A single Google-style address component. */
export const StAddressComponent = z.object({
  long_name: z.string(),
  short_name: z.string(),
  types: z.array(z.string()),
});

const componentsArray = z.array(StAddressComponent);

// The raw API sends `components` as a JSON-stringified array of address
// components, an empty string (when none), an already-parsed array, or
// null/absent. Normalize all of those into a `StAddressComponent[] | null`.
const componentsField = z
  .union([z.array(z.unknown()), z.string(), z.null()])
  .optional()
  .transform((val): z.infer<typeof StAddressComponent>[] | null => {
    if (val == null || val === "") return null;
    if (typeof val === "string") {
      try {
        const parsed = componentsArray.safeParse(JSON.parse(val));
        return parsed.success ? parsed.data : null;
      } catch {
        return null;
      }
    }
    const parsed = componentsArray.safeParse(val);
    return parsed.success ? parsed.data : null;
  });

export const StLocationData = z.object({
  components: componentsField,
  coordinates: coordinatesField,
  address_city: z.string().optional(),
  full_address: z.string().optional(),
  address_state: z.string().optional(),
  address_line_1: z.string().optional(),
  address_country: z.string().optional(),
  address_postal_code: z.string().optional(),
});

export const StEventSession = z.object({
  id: z.number().int(),
  mobilize_event_id: z.number().int(),
  primary_session_id: z.number().int(),
  start_time: z.string(),
  end_time: z.string(),
  title: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  location_name: z.string().nullable(),
  location_data: StLocationData.nullable(),
  // PostGIS WKT `POINT (lon lat)` — note lon first. Null when ungeocoded.
  lonlat: z.string().nullable(),
  location_address: z.string().nullable(),
  note: z.string().nullable(),
  tags: z.array(z.string()),
  event_type: z.string(),
  show_rsvp_bar: z.boolean(),
  show_title_in_form: z.boolean(),
  max_capacity: z.number().int().nullable(),
  zoom_account_id: z.number().int().nullable(),
  zoom_meeting_id: z.number().int().nullable(),
  zoom_meeting_data: z.unknown().nullable(),
  zoom_join_before_host: z.boolean(),
  zoom_attendance_synced_at: z.string().nullable(),
  source_calendar_item_id: z.number().int().nullable(),
  paired_meci_id: z.number().int().nullable(),
  recurring_schedule_id: z.string().nullable(),
  mobilize_event_task_id: z.number().int().nullable(),
  rsvp_count: z.number().int(),
  attendance_count: z.number().int(),
  host_tools_url: z.string(),
  city_state_label: z.string().nullable(),
});

/** Per-event toggles for the automated RSVP/reminder messages. */
export const StEventAutomationStatus = z.object({
  rsvp_confirmation_email: z.boolean(),
  rsvp_confirmation_text: z.boolean(),
  day_before_email_reminder: z.boolean(),
  day_before_text_reminder: z.boolean(),
  day_of_email_reminder: z.boolean(),
  day_of_text_reminder: z.boolean(),
});

export const StEvent = z.object({
  id: z.number().int(),
  title: z.string(),
  scope_id: z.number().int(),
  scope_type: z.string(),
  event_type: z.string(),
  location_name: z.string().nullable(),
  location_data: StLocationData.nullable(),
  tags: z.array(z.string()),
  campaign_tags: z.array(z.string()),
  event_sessions: z.array(StEventSession),
  event_page_url: z.string().nullable(),
  event_page_id: z.number().int().nullable(),
  image_url: z.string().nullable(),
  description: z.string().nullable(),
  hide_address_until_rsvp: z.boolean(),
  show_in_web_calendars: z.boolean(),
  automation_status: StEventAutomationStatus,
  primary_event_id: z.number().int(),
  is_co_hosted_mirror: z.boolean(),
  created_at: z.string(),
});

export const StEventsResponse = z.object({
  data: z.array(StEvent),
  meta: paginationMeta,
});

export type StCoordinates = z.infer<typeof StCoordinates>;
export type StAddressComponent = z.infer<typeof StAddressComponent>;
export type StLocationData = z.infer<typeof StLocationData>;
export type StEventSession = z.infer<typeof StEventSession>;
export type StEventAutomationStatus = z.infer<typeof StEventAutomationStatus>;
export type StEvent = z.infer<typeof StEvent>;
export type StEventsResponse = z.infer<typeof StEventsResponse>;

/* ------------------------------------------------------------------ *
 * Events
 * ------------------------------------------------------------------ */

/** GET /events — Lists events. */
export function listEvents(
  config: ClientConfig,
  params: ListParams = {},
): Promise<ApiResult<StEventsResponse>> {
  return apiGet(config, "/events", {
    query: { ...params },
    schema: StEventsResponse,
  });
}

/** GET /events/{id} — Shows a single event. */
export function getEvent(
  config: ClientConfig,
  id: number,
): Promise<ApiResult<unknown>> {
  return apiGet(config, `/events/${id}`);
}
