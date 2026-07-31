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

/* ------------------------------------------------------------------ *
 * Request shapes
 * ------------------------------------------------------------------ */

export interface ListEventSessionsParams extends ListParams {
  event_id?: number;
}

export interface EventSessionCreate {
  event_id: number;
  start_time: number | null;
  end_time: number | null;
  title?: string | null;
  location_name?: string | null;
  location_data?: EventLocationData;
  location_address?: string | null;
  show_rsvp_bar?: boolean | null;
  show_title_in_form?: boolean | null;
}

export interface EventSessionUpdate {
  start_time?: number | null;
  end_time?: number | null;
  title?: string | null;
  location_name?: string | null;
  location_address?: string | null;
  show_rsvp_bar?: boolean | null;
  show_title_in_form?: boolean | null;
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
