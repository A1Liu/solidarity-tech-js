import z from "zod";
import { apiGet, apiPost, apiPut } from "../client";
import type { ApiResult, ClientConfig } from "../client";
import type { ListParams } from "../schemas";

export const StIsAttendingSchema = z.union([
  z.literal("yes"),
  z.literal("no"),
  z.literal("maybe"),
]);

export interface ListEventRsvpsParams extends ListParams {
  event_id?: number;
}

export interface EventRsvpCreate {
  event_id: number;
  event_session_id: number;
  user_id: number;
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

const CreateEventRsvpsResponseSchema = z.object({
  data: {
    id: z.number(),
    event_id: z.number(),
    event_session_id: z.number(),
    user_id: z.number(),
    user_details: z.object({
      first_name: z.string(),
      last_name: z.string(),
      email: z.string(),
      phone: z.string(),
    }),
    is_attending: StIsAttendingSchema,
    is_confirmed: z.boolean().nullable(),
    confirmed_at: z.string().nullable(),
    confirmed_by_agent_id: z.number().nullable(),
    unconfirmed_at: z.string().nullable(),
    unconfirmed_by_agent_id: null,
    confirmation_source: z.number().nullable(),
    mobilize_event_task_id: z.number().nullable(),
    agent_user_id: z.number(),
    source: z.string().nullable(),
    source_system: z.string().nullable(),
    cancel_rsvp_url: z.string(),
    confirm_rsvp_url: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
  },
});

export type StCreateEventRsvpsResponse = z.infer<
  typeof CreateEventRsvpsResponseSchema
>;

/** PUT /event_rsvps/{id} — Updates an event rsvp. */
export function updateEventRsvp(
  config: ClientConfig,
  id: number,
  body: EventRsvpUpdate,
): Promise<ApiResult<unknown>> {
  return apiPut(config, `/event_rsvps/${id}`, {
    body,
    schema: CreateEventRsvpsResponseSchema,
  });
}
