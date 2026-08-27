import { z } from "zod";

/**
 * The whole response, inferred from `tests/data/event_rsvps.json`.
 *
 * What this sample does NOT decide:
 * - sampled 3 row(s)
 * - null in every row, so the non-null type is unverified: confirmation_source, confirmed_at, confirmed_by_agent_id, is_confirmed, mobilize_event_task_id, unconfirmed_at, unconfirmed_by_agent_id
 * - one distinct value across the sample: is_attending
 */

export const fixtureResponse = z.object({
  data: z.array(
    z.object({
      id: z.number().int(),
      event_id: z.number().int(),
      event_session_id: z.number().int(),
      user_id: z.number().int(),
      user_details: z.object({
        first_name: z.string(),
        last_name: z.string(),
        email: z.string(),
        phone: z.string(),
      }),
      is_attending: z.string(),
      is_confirmed: z.null(),
      confirmed_at: z.null(),
      confirmed_by_agent_id: z.null(),
      unconfirmed_at: z.null(),
      unconfirmed_by_agent_id: z.null(),
      confirmation_source: z.null(),
      mobilize_event_task_id: z.null(),
      agent_user_id: z.number().int(),
      source: z.string(),
      source_system: z.union([z.null(), z.string()]),
      cancel_rsvp_url: z.string(),
      confirm_rsvp_url: z.string(),
      created_at: z.string(),
      updated_at: z.string(),
    }),
  ),
  meta: z.object({
    total_count: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
  }),
});

/**
 * The whole response, inferred from `tests/data/event_rsvps.item.json`.
 */

export const itemResponse = z.object({
  data: z.object({
    id: z.number().int(),
    event_id: z.number().int(),
    event_session_id: z.number().int(),
    user_id: z.number().int(),
    user_details: z.object({
      first_name: z.string(),
      last_name: z.string(),
      email: z.string(),
      phone: z.string(),
    }),
    is_attending: z.string(),
    is_confirmed: z.null(),
    confirmed_at: z.null(),
    confirmed_by_agent_id: z.null(),
    unconfirmed_at: z.null(),
    unconfirmed_by_agent_id: z.null(),
    confirmation_source: z.null(),
    mobilize_event_task_id: z.null(),
    agent_user_id: z.number().int(),
    source: z.string(),
    source_system: z.null(),
    cancel_rsvp_url: z.string(),
    confirm_rsvp_url: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
  }),
  meta: z.object({
    total_count: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
  }),
});
