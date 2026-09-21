import z from "zod";
import { apiGet, apiPost, apiPut } from "../client";
import type { ApiResult, ClientConfig } from "../client";
import { listResponse, mutationResponse } from "../schemas";
import type { ListParams } from "../schemas";

/**
 * `waitlisted` is from the live reference
 * (https://www.solidarity.tech/reference/post_event-rsvps); no sample has
 * shown it yet.
 */
export const StIsAttendingSchema = z.union([
  z.literal("yes"),
  z.literal("no"),
  z.literal("maybe"),
  z.literal("waitlisted"),
]);

export type StIsAttending = z.infer<typeof StIsAttendingSchema>;

export interface StListEventRsvpsParams extends ListParams {
  event_id?: number;
  session_id?: number;
}

export interface StEventRsvpCreate {
  event_id: number;
  event_session_id: number;
  user_id: number;
  is_attending: StIsAttending;
  is_confirmed?: boolean;
  agent_user_id: number | null;
  source?: string | null;
  source_system?: string | null;
  /**
   * Skips the confirmation email the RSVP would otherwise send the user.
   * Default false. From the live reference
   * (https://www.solidarity.tech/reference/post_event-rsvps); the vendored
   * document does not declare it.
   */
  skip_email_confirmation?: boolean | null;
}

export interface StEventRsvpUpdate {
  is_attending?: StIsAttending;
  is_confirmed?: boolean;
  agent_user_id?: number | null;
  source?: string | null;
  source_system?: string | null;
}

export const StEventRsvpSchema = z.object({
  id: z.number(),
  event_id: z.number(),
  event_session_id: z.number(),
  user_id: z.number(),
  user_details: z.object({
    first_name: z.string().nullable(),
    last_name: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
  }),
  is_attending: StIsAttendingSchema,
  is_confirmed: z.boolean().nullable(),
  confirmed_at: z.string().nullable(),
  confirmed_by_agent_id: z.number().nullable(),
  unconfirmed_at: z.string().nullable(),
  unconfirmed_by_agent_id: z.number().nullable(),
  confirmation_source: z.number().nullable(),
  mobilize_event_task_id: z.number().nullable(),
  agent_user_id: z.number(),
  source: z.string().nullable(),
  source_system: z.string().nullable(),
  cancel_rsvp_url: z.string(),
  confirm_rsvp_url: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const StCreateEventRsvpsResponseSchema =
  mutationResponse(StEventRsvpSchema);

export const StListEventRsvpsResponseSchema = listResponse(StEventRsvpSchema);

export type StEventRsvp = z.infer<typeof StEventRsvpSchema>;

export type StCreateEventRsvpsResponse = z.infer<
  typeof StCreateEventRsvpsResponseSchema
>;

export type StListEventRsvpsResponse = z.infer<
  typeof StListEventRsvpsResponseSchema
>;

/** POST /event_rsvps — Creates an event rsvp. */
export function createEventRsvp(
  config: ClientConfig,
  body: StEventRsvpCreate,
): Promise<ApiResult<StCreateEventRsvpsResponse>> {
  return apiPost(config, "/event_rsvps", {
    body,
    schema: StCreateEventRsvpsResponseSchema,
  });
}

/** GET /event_rsvps — Lists event rsvps. */
export function listEventRsvps(
  config: ClientConfig,
  params: StListEventRsvpsParams = {},
): Promise<ApiResult<StListEventRsvpsResponse>> {
  return apiGet(config, "/event_rsvps", {
    query: { ...params },
    schema: StListEventRsvpsResponseSchema,
  });
}

/** PUT /event_rsvps/{id} — Updates an event rsvp. */
export function updateEventRsvp(
  config: ClientConfig,
  id: number,
  body: StEventRsvpUpdate,
): Promise<ApiResult<StCreateEventRsvpsResponse>> {
  return apiPut(config, `/event_rsvps/${id}`, {
    body,
    schema: StCreateEventRsvpsResponseSchema,
  });
}

/** Every event RSVP endpoint function, for spreading into `Endpoints`. */
export const rsvpEndpoints = {
  createEventRsvp,
  listEventRsvps,
  updateEventRsvp,
} as const;

/** Every event RSVP zod schema, for spreading into `Schemas`. */
export const rsvpSchemas = {
  StIsAttendingSchema,
  StEventRsvpSchema,
  StCreateEventRsvpsResponseSchema,
  StListEventRsvpsResponseSchema,
} as const;
