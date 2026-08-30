import { z } from "zod";

/**
 * The whole response, inferred from `tests/data/event_sessions.json`.
 *
 * What this sample does NOT decide:
 * - sampled 25 row(s)
 * - null in every row, so the non-null type is unverified: mobilize_event_task_id, paired_meci_id, recurring_schedule_id, source_calendar_item_id, zoom_account_id, zoom_attendance_synced_at, zoom_meeting_data, zoom_meeting_id
 * - empty in every row, so the element type is unverified: host_user_ids
 * - one distinct value across the sample: attendance_count, show_rsvp_bar, zoom_join_before_host
 */

export const fixtureResponse = z.object({
  data: z.array(
    z.object({
      id: z.number().int(),
      mobilize_event_id: z.number().int(),
      start_time: z.string(),
      end_time: z.string(),
      title: z.string(),
      created_at: z.string(),
      updated_at: z.string(),
      location_name: z.union([z.null(), z.string()]),
      location_data: z.union([
        z.null(),
        z.object({
          components: z.string(),
          coordinates: z.string(),
          address_city: z.string(),
          full_address: z.string(),
          address_state: z.string(),
          address_line_1: z.string(),
          address_country: z.string(),
          address_postal_code: z.string(),
        }),
      ]),
      lonlat: z.union([z.null(), z.string()]),
      location_address: z.union([z.null(), z.string()]),
      show_rsvp_bar: z.boolean(),
      show_title_in_form: z.boolean(),
      max_capacity: z.union([z.null(), z.number().int()]),
      note: z.union([z.null(), z.string()]),
      tags: z.array(z.string()),
      zoom_account_id: z.null(),
      zoom_meeting_id: z.null(),
      zoom_meeting_data: z.null(),
      zoom_join_before_host: z.boolean(),
      zoom_attendance_synced_at: z.null(),
      source_calendar_item_id: z.null(),
      event_type: z.string(),
      paired_meci_id: z.null(),
      recurring_schedule_id: z.null(),
      mobilize_event_task_id: z.null(),
      host_user_ids: z.array(z.any()),
      rsvp_count: z.number().int(),
      attendance_count: z.number().int(),
      host_tools_url: z.string(),
      primary_session_id: z.number().int(),
      city_state_label: z.union([z.null(), z.string()]),
    }),
  ),
  meta: z.object({
    total_count: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
  }),
});

/**
 * The whole response, inferred from `tests/data/event_sessions.item.json`.
 */

export const itemResponse = z.object({
  data: z.object({
    id: z.number().int(),
    mobilize_event_id: z.number().int(),
    start_time: z.string(),
    end_time: z.string(),
    title: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
    location_name: z.null(),
    location_data: z.null(),
    lonlat: z.null(),
    location_address: z.null(),
    show_rsvp_bar: z.boolean(),
    show_title_in_form: z.boolean(),
    max_capacity: z.number().int(),
    note: z.null(),
    tags: z.array(z.any()),
    zoom_account_id: z.null(),
    zoom_meeting_id: z.null(),
    zoom_meeting_data: z.null(),
    zoom_join_before_host: z.boolean(),
    zoom_attendance_synced_at: z.null(),
    source_calendar_item_id: z.null(),
    event_type: z.string(),
    paired_meci_id: z.null(),
    recurring_schedule_id: z.null(),
    mobilize_event_task_id: z.null(),
    host_user_ids: z.array(z.any()),
    rsvp_count: z.number().int(),
    attendance_count: z.number().int(),
    host_tools_url: z.string(),
    primary_session_id: z.number().int(),
    city_state_label: z.null(),
  }),
  meta: z.object({
    total_count: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
  }),
});
