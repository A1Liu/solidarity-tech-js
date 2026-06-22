import { describe, it, expect } from "vitest";
import { StEventsResponse } from "../endpoints/events";
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
