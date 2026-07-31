import { describe, it, expect, beforeEach } from "vitest";
import { faker } from "@faker-js/faker";
import {
  StEventSessionsResponse,
  StEventSessionResponse,
  StEventSessionCountResponse,
} from "../endpoints/event_sessions";

// Deterministic data: seed before each test so a failure reproduces exactly.
beforeEach(() => faker.seed(20240730));

/** A raw `location_data` object as the API delivers it (pre-transform). */
function rawLocationData(overrides: Record<string, unknown> = {}) {
  return {
    components: JSON.stringify([
      {
        long_name: faker.location.street(),
        short_name: "St",
        types: ["route"],
      },
    ]),
    coordinates: JSON.stringify({
      lng: faker.location.longitude(),
      lat: faker.location.latitude(),
    }),
    address_city: faker.location.city(),
    full_address: faker.location.streetAddress(),
    address_state: faker.location.state(),
    address_line_1: faker.location.streetAddress(),
    address_country: faker.location.country(),
    address_postal_code: faker.location.zipCode(),
    ...overrides,
  };
}

/** A raw event session as the API delivers it (pre-transform). */
function rawSession(overrides: Record<string, unknown> = {}) {
  const iso = () => faker.date.recent().toISOString();
  return {
    id: faker.number.int(),
    mobilize_event_id: faker.number.int(),
    primary_session_id: faker.number.int(),
    start_time: iso(),
    end_time: iso(),
    title: faker.lorem.words(3),
    created_at: iso(),
    updated_at: iso(),
    location_name: faker.location.city(),
    location_data: rawLocationData(),
    lonlat: `POINT (${faker.location.longitude()} ${faker.location.latitude()})`,
    location_address: faker.location.streetAddress(),
    note: faker.lorem.sentence(),
    tags: [faker.lorem.word()],
    event_type: "canvass",
    show_rsvp_bar: faker.datatype.boolean(),
    show_title_in_form: faker.datatype.boolean(),
    max_capacity: faker.number.int({ min: 1, max: 500 }),
    zoom_account_id: null,
    zoom_meeting_id: null,
    zoom_meeting_data: null,
    zoom_join_before_host: faker.datatype.boolean(),
    zoom_attendance_synced_at: null,
    source_calendar_item_id: null,
    paired_meci_id: null,
    recurring_schedule_id: null,
    mobilize_event_task_id: null,
    host_user_ids: [],
    rsvp_count: faker.number.int({ min: 0, max: 100 }),
    attendance_count: faker.number.int({ min: 0, max: 100 }),
    host_tools_url: faker.internet.url(),
    city_state_label: `${faker.location.city()}, NY`,
    ...overrides,
  };
}

function rawResponse(data: unknown[]) {
  return { data, meta: { total_count: data.length, limit: 25, offset: 0 } };
}

describe("StEventSessionsResponse", () => {
  it("parses a faker-generated list green", () => {
    const result = StEventSessionsResponse.safeParse(
      rawResponse([rawSession(), rawSession(), rawSession()]),
    );
    expect(result.success).toBe(true);
  });

  it("parses a JSON-stringified components array into structured components", () => {
    const parsed = StEventSessionsResponse.parse(
      rawResponse([
        rawSession({
          location_data: rawLocationData({
            components: JSON.stringify([
              {
                long_name: "Dekalb Avenue",
                short_name: "Dekalb",
                types: ["route"],
              },
            ]),
          }),
        }),
      ]),
    );
    expect(parsed.data[0].location_data?.components?.[0]).toEqual({
      long_name: "Dekalb Avenue",
      short_name: "Dekalb",
      types: ["route"],
    });
  });

  it("parses a JSON-stringified coordinates object into { lng, lat }", () => {
    const parsed = StEventSessionsResponse.parse(
      rawResponse([
        rawSession({
          location_data: rawLocationData({
            coordinates: JSON.stringify({ lng: -73.97, lat: 40.69 }),
          }),
        }),
      ]),
    );
    expect(parsed.data[0].location_data?.coordinates).toEqual({
      lng: -73.97,
      lat: 40.69,
    });
  });

  it("normalizes empty-string components and coordinates to null", () => {
    const parsed = StEventSessionsResponse.parse(
      rawResponse([
        rawSession({
          location_data: rawLocationData({ components: "", coordinates: "" }),
        }),
      ]),
    );
    const locationData = parsed.data[0].location_data;
    expect(locationData?.components).toBeNull();
    expect(locationData?.coordinates).toBeNull();
  });

  it("accepts a null location_data", () => {
    const result = StEventSessionsResponse.safeParse(
      rawResponse([rawSession({ location_data: null })]),
    );
    expect(result.success).toBe(true);
  });
});

describe("StEventSessionResponse", () => {
  it("parses a single-session show envelope green", () => {
    const result = StEventSessionResponse.safeParse({
      data: rawSession(),
      meta: { total_count: 1, limit: 1, offset: 0 },
    });
    expect(result.success).toBe(true);
  });

  it("parses the include_* fields (hosts/rsvp_counts/confirmed_counts) when present", () => {
    const result = StEventSessionsResponse.safeParse(
      rawResponse([
        rawSession({ hosts: [], rsvp_counts: {}, confirmed_counts: {} }),
      ]),
    );
    expect(result.success).toBe(true);
  });
});

describe("StEventSessionCountResponse", () => {
  it("parses a count=true envelope green", () => {
    const result = StEventSessionCountResponse.safeParse({ count: 37 });
    expect(result.success).toBe(true);
  });
});
