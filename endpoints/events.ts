import { z } from "zod";
import { apiGet, apiPost } from "../client";
import type { ApiResult, ClientConfig } from "../client";
import { itemResponse, listResponse } from "../schemas";
import type { ListParams, ScopeType } from "../schemas";

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
  // Always empty in captured responses, so the element type is unverified.
  host_user_ids: z.array(z.unknown()),
  rsvp_count: z.number().int(),
  attendance_count: z.number().int(),
  host_tools_url: z.string(),
  city_state_label: z.string().nullable(),
  // Present on GET /event_sessions only when the matching `include_*` query
  // param is set; empty in captured responses, so element types are unverified.
  hosts: z.array(z.unknown()).optional(),
  rsvp_counts: z.record(z.string(), z.unknown()).optional(),
  confirmed_counts: z.record(z.string(), z.unknown()).optional(),
});

/** Per-event toggles for the automated RSVP/reminder messages. */
export const StEventAutomationStatus = z
  .object({
    rsvp_confirmation_email: z.boolean(),
    rsvp_confirmation_text: z.boolean(),
    day_before_email_reminder: z.boolean(),
    day_before_text_reminder: z.boolean(),
    day_of_email_reminder: z.boolean(),
    day_of_text_reminder: z.boolean(),
    ten_min_before_text_reminder: z.boolean(),
    post_event_survey_email: z.boolean(),
    post_event_survey_text: z.boolean(),
  })
  .partial();

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
  // Null in every captured response, so the non-null type is unverified.
  accessibility_info: z.string().nullable(),
  waitlist_enabled: z.boolean(),
  automation_status: StEventAutomationStatus,
  primary_event_id: z.number().int(),
  is_co_hosted_mirror: z.boolean(),
  // Always empty in captured responses, so the element type is unverified.
  internal_co_host_chapters: z.array(z.unknown()),
  created_at: z.string(),
});

export const StEventResponse = itemResponse(StEvent);
export const StEventsResponse = listResponse(StEvent);

export type StCoordinates = z.infer<typeof StCoordinates>;
export type StAddressComponent = z.infer<typeof StAddressComponent>;
export type StLocationData = z.infer<typeof StLocationData>;
export type StEventSession = z.infer<typeof StEventSession>;
export type StEventAutomationStatus = z.infer<typeof StEventAutomationStatus>;
export type StEvent = z.infer<typeof StEvent>;
export type StEventsResponse = z.infer<typeof StEventsResponse>;
export type StEventResponse = z.infer<typeof StEventResponse>;

/* ------------------------------------------------------------------ *
 * Request shapes
 *
 * From the live reference (https://www.solidarity.tech/reference/post_events);
 * the vendored OpenAPI document does not declare `POST /events` at all.
 * ------------------------------------------------------------------ */

/**
 * A hybrid event gets an in-person session at `location_address` and a
 * virtual one at `virtual_url`. Sessions themselves are only ever one or the
 * other (`EventSessionType`).
 */
export type EventType = "virtual" | "in_person" | "hybrid";

/**
 * On/off switches for an event's automated emails and texts -- the same ones
 * as the dashboard's Automated Communications tab. Omitted switches keep their
 * defaults, and the result is echoed back as the event's `automation_status`.
 * Unknown keys or non-boolean values are a 422.
 */
export interface EventAutomatedCommunications {
  /** Default follows the organization's RSVP confirmation template (on for most). */
  rsvp_confirmation_email?: boolean;
  /** 24 hours before the session. Default on. */
  day_before_reminder_email?: boolean;
  /** 24 hours before the session. Default off. */
  day_before_reminder_text?: boolean;
  /** 1 hour before the session. Default on. */
  day_of_reminder_text?: boolean;
  /** Self check-in text 10 minutes before the session. Default off. */
  ten_min_before_reminder_text?: boolean;
  /** 30 to 90 minutes after the session ends. Default off. */
  post_event_survey_email?: boolean;
  /** 30 to 90 minutes after the session ends. Default off. */
  post_event_survey_text?: boolean;
}

/**
 * POST /events. Creates the event and its first session together, so the
 * session's fields (`start_time`, `location_*`, `max_capacity`, ...) are here
 * rather than on a separate `createEventSession` call.
 */
export interface EventCreate {
  title: string;
  event_type: EventType;
  /** Unix seconds. */
  start_time: number;
  /** Unix seconds. */
  end_time: number;
  /** The organization or chapter the event belongs to. */
  scope_id: number;
  scope_type: ScopeType;
  /**
   * For `virtual`, the meeting URL. For `in_person` and `hybrid`, the street
   * address of the in-person session.
   */
  location_address?: string | null;
  /** Meeting URL for the virtual session of a `hybrid` event. */
  virtual_url?: string | null;
  /** Display name for the location, e.g. "City Hall". */
  location_name?: string | null;
  /**
   * Title of the first session; defaults to `title`. Capped at 65 characters,
   * or 200 with `allow_long_title`.
   */
  session_title?: string | null;
  /** Raises the session title cap from 65 to 200 characters. Default false. */
  allow_long_title?: boolean | null;
  tags?: string[] | null;
  /** Capacity of the first session. 0 means unlimited. */
  max_capacity?: number | null;
  /** For `in_person` events. Geocoded from the address when omitted. */
  latitude?: number | null;
  longitude?: number | null;
  /** Duplicate detection otherwise answers 409. Default false. */
  skip_duplicate_check?: boolean | null;
  automated_communications?: EventAutomatedCommunications | null;
}

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

/**
 * POST /events — Creates an event and its first session.
 *
 * Answers 201, 404 when the scope does not exist, 409 for a duplicate (see
 * `skip_duplicate_check`), and 422 on validation. The 201 body is `unknown`
 * because it has not been sampled: the reference does not describe it, and
 * with no `DELETE /events/{id}` a probe would have nothing to clean up with.
 * Every other mutation on this API answers `{ data: <element> }`, so the new
 * event's id is expected at `data.id`.
 */
export function createEvent(
  config: ClientConfig,
  body: EventCreate,
): Promise<ApiResult<StEventResponse>> {
  return apiPost(config, "/events", {
    body,
    schema: StEventResponse,
  });
}

/** GET /events/{id} — Shows a single event. */
export function getEvent(
  config: ClientConfig,
  id: number,
): Promise<ApiResult<StEventResponse>> {
  return apiGet(config, `/events/${id}`, {
    schema: StEventResponse,
  });
}

/** Every event endpoint function, for spreading into `Endpoints`. */
export const eventEndpoints = {
  listEvents,
  createEvent,
  getEvent,
} as const;

/** Every event zod schema, for spreading into `Schemas`. */
export const eventSchemas = {
  StCoordinates,
  StAddressComponent,
  StLocationData,
  StEventSession,
  StEventAutomationStatus,
  StEvent,
  StEventsResponse,
} as const;
