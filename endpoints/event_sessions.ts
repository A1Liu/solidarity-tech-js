import { z } from "zod";
import { apiGet, apiPost, apiPut, apiDelete } from "../client";
import type { ApiResult, ClientConfig } from "../client";
import { paginationMeta } from "../schemas";
import type { EventLocationData, ListParams } from "../schemas";
import { StEventSession } from "./events";

/* ------------------------------------------------------------------ *
 * Schemas
 * ------------------------------------------------------------------ */

/**
 * GET /event_sessions list envelope. Reuses the `StEventSession` element already
 * verified via `StEventsResponse` (a session nested inside an event); the
 * standalone list is expected to return the same element shape, which the live
 * audit confirms.
 */
export const StEventSessionsResponse = z.object({
  data: z.array(StEventSession),
  meta: paginationMeta,
});

export type StEventSessionsResponse = z.infer<typeof StEventSessionsResponse>;

/**
 * GET /event_sessions/{id} envelope. The show endpoint wraps a single
 * `StEventSession` in the same `{ data, meta }` shape as the list; the live
 * audit confirms the element and a `{total_count, limit, offset}` meta.
 */
export const StEventSessionResponse = z.object({
  data: StEventSession,
  meta: paginationMeta,
});

export type StEventSessionResponse = z.infer<typeof StEventSessionResponse>;

/**
 * POST/PUT /event_sessions envelope. Create and update wrap the session in
 * `{ data }` with no `meta` (the list/show `meta` is pagination, absent here),
 * per the live audit.
 */
export const StEventSessionMutationResponse = z.object({
  data: StEventSession,
});

export type StEventSessionMutationResponse = z.infer<
  typeof StEventSessionMutationResponse
>;

/**
 * GET /event_sessions?count=true envelope. With `count` set the endpoint drops
 * the list/`meta` entirely and returns just a total, per the live audit.
 */
export const StEventSessionCountResponse = z.object({
  count: z.number().int(),
});

export type StEventSessionCountResponse = z.infer<
  typeof StEventSessionCountResponse
>;

/* ------------------------------------------------------------------ *
 * Request shapes
 * ------------------------------------------------------------------ */

/** In-person sessions carry an address; virtual ones carry a meeting link. */
export type EventSessionType = "virtual" | "in_person";

export interface ListEventSessionsParams extends ListParams {
  event_id?: number;
  /** Only sessions whose start time is in the future. */
  upcoming?: boolean;
  /** Unix seconds — only sessions starting at/after this time. */
  starts_after?: number;
  /** Unix seconds — only sessions starting at/before this time. */
  starts_before?: number;
  chapter_id?: number;
  /** Comma-separated event tags to filter by. */
  event_tags?: string;
  /** Populate each session's `rsvp_counts`. */
  include_rsvp_counts?: boolean;
  /** Populate each session's `confirmed_counts`. */
  include_confirmed_counts?: boolean;
  /** Populate each session's `hosts`. */
  include_hosts?: boolean;
}

export interface EventSessionCreate {
  event_id: number;
  start_time: number | null;
  end_time: number | null;
  event_type?: EventSessionType | null;
  title?: string | null;
  location_name?: string | null;
  location_data?: EventLocationData;
  location_address?: string | null;
  show_rsvp_bar?: boolean | null;
  show_title_in_form?: boolean | null;
  note?: string | null;
  max_capacity?: number | null;
  tags?: string[];
}

export interface EventSessionUpdate {
  start_time?: number | null;
  end_time?: number | null;
  title?: string | null;
  location_name?: string | null;
  location_data?: EventLocationData;
  location_address?: string | null;
  show_rsvp_bar?: boolean | null;
  show_title_in_form?: boolean | null;
  note?: string | null;
  max_capacity?: number | null;
  tags?: string[];
}

/* ------------------------------------------------------------------ *
 * Event Sessions
 * ------------------------------------------------------------------ */

/** GET /event_sessions — Lists event sessions. */
export function listEventSessions(
  config: ClientConfig,
  params: ListEventSessionsParams = {},
): Promise<ApiResult<StEventSessionsResponse>> {
  return apiGet(config, "/event_sessions", {
    query: { ...params },
    schema: StEventSessionsResponse,
  });
}

/**
 * GET /event_sessions?count=true — Returns the number of matching sessions
 * instead of the list. Accepts the same filters as {@link listEventSessions}.
 */
export function countEventSessions(
  config: ClientConfig,
  params: Omit<ListEventSessionsParams, "_limit" | "_offset"> = {},
): Promise<ApiResult<StEventSessionCountResponse>> {
  return apiGet(config, "/event_sessions", {
    query: { ...params, count: true },
    schema: StEventSessionCountResponse,
  });
}

/** POST /event_sessions — Creates an event session. */
export function createEventSession(
  config: ClientConfig,
  body: EventSessionCreate,
): Promise<ApiResult<StEventSessionMutationResponse>> {
  return apiPost(config, "/event_sessions", {
    body,
    schema: StEventSessionMutationResponse,
  });
}

/** GET /event_sessions/{id} — Shows a single event session. */
export function getEventSession(
  config: ClientConfig,
  id: number,
): Promise<ApiResult<StEventSessionResponse>> {
  return apiGet(config, `/event_sessions/${id}`, {
    schema: StEventSessionResponse,
  });
}

/** PUT /event_sessions/{id} — Updates an event session. */
export function updateEventSession(
  config: ClientConfig,
  id: number,
  body: EventSessionUpdate,
): Promise<ApiResult<StEventSessionMutationResponse>> {
  return apiPut(config, `/event_sessions/${id}`, {
    body,
    schema: StEventSessionMutationResponse,
  });
}

/** DELETE /event_sessions/{id} — Deletes an event session. */
export function deleteEventSession(
  config: ClientConfig,
  id: number,
): Promise<ApiResult<unknown>> {
  return apiDelete(config, `/event_sessions/${id}`);
}
