import { describe, it, expect } from "vitest";
import { findRetainedStrings, scrubResponse } from "../scripts/scrub";

describe("scrubResponse", () => {
  it("replaces a string under a key nobody anticipated", () => {
    const scrubbed = scrubResponse({ unexpected_field: "Ada Lovelace" });
    expect(scrubbed).not.toEqual({ unexpected_field: "Ada Lovelace" });
  });

  it("keeps a declared enum member verbatim", () => {
    expect(scrubResponse({ scope_type: "Chapter" })).toEqual({
      scope_type: "Chapter",
    });
  });

  it("scrubs a declared enum key holding a value outside the set", () => {
    const scrubbed = scrubResponse({ scope_type: "Ada Lovelace" });
    expect(scrubbed).not.toEqual({ scope_type: "Ada Lovelace" });
  });

  it("preserves null and the empty string", () => {
    expect(scrubResponse({ note: null, components: "" })).toEqual({
      note: null,
      components: "",
    });
  });

  it("preserves numbers that carry structure", () => {
    expect(scrubResponse({ id: 20524, meta: { total_count: 2 } })).toEqual({
      id: 20524,
      meta: { total_count: 2 },
    });
  });

  it("replaces an email with an email-shaped stand-in", () => {
    const scrubbed = scrubResponse({ email: "member@example.org" });
    const { email } = scrubbed as { email: string };
    expect(email).not.toBe("member@example.org");
    expect(email).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
  });

  it("keeps a timestamp's precision and zone offset", () => {
    const scrubbed = scrubResponse({
      created_at: "2026-06-06T00:12:25.412-04:00",
    });
    const { created_at: createdAt } = scrubbed as { created_at: string };
    expect(createdAt).not.toBe("2026-06-06T00:12:25.412-04:00");
    expect(createdAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}-04:00$/,
    );
  });

  it("scrubs inside a JSON document encoded in a string", () => {
    const components = JSON.stringify([
      { long_name: "Dekalb Avenue", short_name: "Dekalb", types: ["route"] },
    ]);
    const scrubbed = scrubResponse({ location_data: { components } });
    const { location_data: locationData } = scrubbed as {
      location_data: { components: string };
    };
    expect(locationData.components).not.toBe(components);

    const decoded: unknown = JSON.parse(locationData.components);
    expect(decoded).toHaveLength(1);
    expect(Object.keys((decoded as Record<string, unknown>[])[0])).toEqual([
      "long_name",
      "short_name",
      "types",
    ]);
  });

  it("is deterministic across runs", () => {
    const body = { first_name: "Ada", email: "ada@example.org" };
    expect(scrubResponse(body)).toEqual(scrubResponse(body));
  });
});

describe("findRetainedStrings", () => {
  it("reports nothing when every string was replaced", () => {
    const raw = { first_name: "Ada", address: { city: "Brooklyn" } };
    expect(findRetainedStrings(raw, scrubResponse(raw))).toEqual([]);
  });

  it("reports the path of a string that survived", () => {
    const raw = { address: { city: "Brooklyn" } };
    expect(findRetainedStrings(raw, raw)).toEqual(["address.city"]);
  });

  it("ignores declared enum members, empty strings, and numbers", () => {
    const raw = { scope_type: "Chapter", note: "", id: 1 };
    expect(findRetainedStrings(raw, raw)).toEqual([]);
  });
});
