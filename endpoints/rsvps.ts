import { apiGet, apiPost, apiPut } from "../client";
import type { ApiResult, ClientConfig } from "../client";
import type { ListParams } from "../schemas";

export interface ListEventRsvpsParams extends ListParams {
  event_id?: number;
}

export interface EventRsvpCreate {
  event_id: number;
  event_session_id: number;
  user_id?: number;
  is_attending: "yes" | "no" | "maybe";
  is_confirmed?: boolean;
  agent_user_id: number | null;
  source?: string | null;
  source_system?: string | null;
}

export interface EventRsvpUpdate {
  is_attending?: "yes" | "no" | "maybe";
  is_confirmed?: boolean;
  agent_user_id?: number | null;
  source?: string | null;
  source_system?: string | null;
}

/** POST /event_rsvps — Creates an event rsvp. */
export function createEventRsvp(
  config: ClientConfig,
  body: EventRsvpCreate,
): Promise<ApiResult<unknown>> {
  return apiPost(config, "/event_rsvps", { body });
}

/** GET /event_rsvps — Lists event rsvps. */
export function listEventRsvps(
  config: ClientConfig,
  params: ListEventRsvpsParams = {},
): Promise<ApiResult<unknown>> {
  return apiGet(config, "/event_rsvps", { query: { ...params } });
}

/** PUT /event_rsvps/{id} — Updates an event rsvp. */
export function updateEventRsvp(
  config: ClientConfig,
  id: number,
  body: EventRsvpUpdate,
): Promise<ApiResult<unknown>> {
  return apiPut(config, `/event_rsvps/${id}`, { body });
}
