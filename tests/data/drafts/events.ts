import { z } from "zod";

/**
 * The whole response, inferred from `tests/data/events.json`.
 *
 * What this sample does NOT decide:
 * - sampled 2 row(s)
 * - null in every row, so the non-null type is unverified: accessibility_info, description, image_url, location_data, location_name
 * - empty in every row, so the element type is unverified: campaign_tags, internal_co_host_chapters
 * - one distinct value across the sample: automation_status, hide_address_until_rsvp, is_co_hosted_mirror, show_in_web_calendars, waitlist_enabled
 */

export const fixtureResponse = z.object({
  data: z.array(
    z.object({
      id: z.number().int(),
      title: z.string(),
      scope_id: z.number().int(),
      scope_type: z.string(),
      event_type: z.string(),
      location_name: z.null(),
      location_data: z.null(),
      tags: z.array(z.string()),
      campaign_tags: z.array(z.any()),
      event_sessions: z.array(
        z.object({
          id: z.number().int(),
          mobilize_event_id: z.number().int(),
          primary_session_id: z.number().int(),
          start_time: z.string(),
          end_time: z.string(),
          title: z.string(),
          created_at: z.string(),
          updated_at: z.string(),
          location_name: z.string(),
          location_data: z.union([
            z.null(),
            z.object({
              components: z.string(),
              coordinates: z.union([
                z.string(),
                z.object({ lat: z.number(), lng: z.number() }),
              ]),
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
          note: z.union([z.null(), z.string()]),
          tags: z.array(z.any()),
          event_type: z.string(),
          show_rsvp_bar: z.boolean(),
          show_title_in_form: z.boolean(),
          max_capacity: z.union([z.null(), z.number().int()]),
          zoom_account_id: z.null(),
          zoom_meeting_id: z.null(),
          zoom_meeting_data: z.null(),
          zoom_join_before_host: z.boolean(),
          zoom_attendance_synced_at: z.null(),
          source_calendar_item_id: z.null(),
          paired_meci_id: z.null(),
          recurring_schedule_id: z.null(),
          mobilize_event_task_id: z.null(),
          rsvp_count: z.number().int(),
          attendance_count: z.number().int(),
          host_tools_url: z.string(),
          city_state_label: z.union([z.null(), z.string()]),
          host_user_ids: z.array(z.any()),
        }),
      ),
      event_page_url: z.union([z.null(), z.string()]),
      event_page_id: z.union([z.null(), z.number().int()]),
      image_url: z.null(),
      description: z.null(),
      hide_address_until_rsvp: z.boolean(),
      show_in_web_calendars: z.boolean(),
      automation_status: z.object({
        rsvp_confirmation_email: z.boolean(),
        rsvp_confirmation_text: z.boolean(),
        day_before_email_reminder: z.boolean(),
        day_before_text_reminder: z.boolean(),
        day_of_email_reminder: z.boolean(),
        day_of_text_reminder: z.boolean(),
      }),
      primary_event_id: z.number().int(),
      is_co_hosted_mirror: z.boolean(),
      internal_co_host_chapters: z.array(z.any()),
      created_at: z.string(),
      accessibility_info: z.null(),
      waitlist_enabled: z.boolean(),
    }),
  ),
  meta: z.object({
    total_count: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
  }),
});

/** One element, from the document's entity schema — stale, but it declares nullability and closed sets a sample cannot. */

export const specElement = z.object({
  id: z.number().int().optional(),
  title: z.string().optional(),
  scope_id: z.number().int().optional(),
  scope_type: z.enum(["Organization", "Chapter"]).nullable().optional(),
  event_type: z.string().optional(),
  location_name: z.string().nullable().optional(),
  location_data: z
    .object({
      components: z.string().optional(),
      coordinates: z.string().optional(),
      address_city: z.string().optional(),
      full_address: z.string().optional(),
      address_state: z.string().optional(),
      address_line_1: z.string().optional(),
      address_country: z.string().optional(),
      address_postal_code: z.string().optional(),
    })
    .nullable()
    .optional(),
  mobilize_event_sessions: z
    .array(
      z.object({
        id: z.number().int().optional(),
        mobilize_event_id: z.number().int().optional(),
        start_time: z.string().datetime({ offset: true }).optional(),
        end_time: z.string().datetime({ offset: true }).optional(),
        title: z.string().optional(),
        created_at: z.string().datetime({ offset: true }).optional(),
        updated_at: z.string().datetime({ offset: true }).optional(),
        location_name: z.string().optional(),
        location_data: z
          .object({
            components: z.string().optional(),
            coordinates: z.string().optional(),
            address_city: z.string().optional(),
            full_address: z.string().optional(),
            address_state: z.string().optional(),
            address_line_1: z.string().optional(),
            address_country: z.string().optional(),
            address_postal_code: z.string().optional(),
          })
          .optional(),
        lonlat: z.string().optional(),
        location_address: z.string().optional(),
        show_rsvp_bar: z.boolean().optional(),
        show_title_in_form: z.boolean().optional(),
      }),
    )
    .optional(),
  rsvps_count: z.number().int().optional(),
  attendance_count: z.number().int().optional(),
  automation_status: z
    .object({
      rsvp_confirmation_email: z.boolean().optional(),
      rsvp_confirmation_text: z.boolean().optional(),
      day_before_email_reminder: z.boolean().optional(),
      day_before_text_reminder: z.boolean().optional(),
      day_of_email_reminder: z.boolean().optional(),
      day_of_text_reminder: z.boolean().optional(),
    })
    .optional(),
  created_at: z.string().datetime({ offset: true }).optional(),
});
