import { describe, it, expect } from "vitest";
import { StEventsResponse, createEvent } from "../endpoints/events";
import sample from "./data/events.json";

describe("StEventsResponse schema", () => {
  it("parses a real listEvents payload", () => {
    const result = StEventsResponse.safeParse(sample);
    expect(result.success).toBe(true);
  });

  it("parses a JSON-stringified components array into structured components", () => {
    const parsed = StEventsResponse.parse(sample);
    const components =
      parsed.data[0].event_sessions[1].location_data?.components;
    expect(Array.isArray(components)).toBe(true);
    expect(components?.[0]).toEqual({
      long_name: "Dekalb Avenue &",
      short_name: "",
      types: [],
    });
    expect(components?.[1].types).toContain("route");
  });

  it("normalizes object coordinates into { lat, lng }", () => {
    const parsed = StEventsResponse.parse(sample);
    const coordinates =
      parsed.data[0].event_sessions[1].location_data?.coordinates;
    expect(coordinates).toEqual({ lat: 40.6914322, lng: -73.975246 });
  });

  it("normalizes empty-string components and coordinates to null", () => {
    const parsed = StEventsResponse.parse(sample);
    const locationData = parsed.data[1].event_sessions[0].location_data;
    expect(locationData?.components).toBeNull();
    expect(locationData?.coordinates).toBeNull();
  });

  it("accepts null event and session fields", () => {
    const parsed = StEventsResponse.parse(sample);
    const event = parsed.data[1];
    expect(event.description).toBeNull();
    expect(event.event_page_url).toBeNull();
    expect(event.event_page_id).toBeNull();

    const session = event.event_sessions[0];
    expect(session.location_address).toBeNull();
    expect(session.max_capacity).toBeNull();
    expect(session.city_state_label).toBeNull();
  });

  it("parses automation_status", () => {
    const parsed = StEventsResponse.parse(sample);
    expect(parsed.data[0].automation_status).toEqual({
      rsvp_confirmation_email: true,
      rsvp_confirmation_text: false,
      day_before_email_reminder: true,
      day_before_text_reminder: false,
      day_of_email_reminder: false,
      day_of_text_reminder: true,
    });
  });
});

describe("createEvent", () => {
  it("POSTs the body to /events and returns the raw 201 body", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ data: { id: 42 } }), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const body = {
      title: "Canvass launch",
      event_type: "in_person" as const,
      start_time: 1_700_000_000,
      end_time: 1_700_003_600,
      scope_id: 7,
      scope_type: "Chapter" as const,
      allow_long_title: true,
      automated_communications: { day_before_reminder_text: true },
    };
    const result = await createEvent(
      { apiKey: "test", fetch: fetchImpl },
      body,
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.solidarity.tech/v1/events");
    expect(calls[0].init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual(body);
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ data: { id: 42 } });
  });
});
