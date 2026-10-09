import { describe, it, expect, expectTypeOf } from "vitest";
import {
  StPageConflict,
  createPage,
  updatePage,
  type StPageField,
  type StPageFieldInput,
} from "../endpoints/pages";

/** A `fetch` that records each call and answers with the given body. */
function fetchAnswering(status: number, body: unknown) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

/** A page as the reference describes one, with every declared key. */
const page = {
  id: 7,
  type: "ActionPage::GenericForm",
  url_slug: "tenant-union-signup",
  name: "Tenant union signup",
  title: "Tenant union signup",
  website_id: 7,
  is_published: true,
  full_url: "https://example.org/tenant-union-signup",
  scope_id: 3,
  scope_type: "Chapter",
  supported_languages: ["en"],
  follow_up: { kind: "message" },
  confirmations: {},
  admin_notifications: {},
  requires_user: false,
  always_hide_primary_nav: false,
  always_hide_footer: false,
  allow_multiple_responses: false,
  form: [{ type: "email_field" }],
  fields: [
    { type: "email", name: "email", label: { en: "Email" }, required: true },
    {
      property: "union-member",
      label: { en: "Are you in a union?" },
      required: false,
      options: [{ label: { en: "Yes" }, value: "yes" }],
      options_from_property: true,
    },
  ],
  description: "<p>Sign up</p>",
  campaign_tags: [],
  created_at: "2026-10-07T00:00:00Z",
  admin_url: "https://dashboard.example.org/pages/7",
};

describe("createPage", () => {
  it("POSTs /pages with the scope as query parameters", async () => {
    const { calls, fetchImpl } = fetchAnswering(201, { data: page });

    const result = await createPage(
      { apiKey: "test", fetch: fetchImpl },
      {
        name: "Tenant union signup",
        website_id: 7,
        fields: [
          { type: "email", required: true },
          { property: "union-member", required: false },
        ],
      },
      { scope_type: "Chapter", scope_id: 3 },
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      "https://api.solidarity.tech/v1/pages?scope_type=Chapter&scope_id=3",
    );
    expect(calls[0].init?.method).toBe("POST");
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ data: page });
  });

  it("sends no query string when the scope is left to the API key", async () => {
    const { calls, fetchImpl } = fetchAnswering(201, {
      data: page,
      warnings: ["Slug was taken; used tenant-union-signup-2"],
    });

    const result = await createPage(
      { apiKey: "test", fetch: fetchImpl },
      {
        name: "Tenant union signup",
        fields: [{ type: "email", required: true }],
      },
    );

    expect(calls[0].url).toBe("https://api.solidarity.tech/v1/pages");
    expect(result.ok && result.data.warnings).toEqual([
      "Slug was taken; used tenant-union-signup-2",
    ]);
  });
});

describe("updatePage", () => {
  it("PATCHes /pages/{id} and parses the renames it migrated", async () => {
    const { calls, fetchImpl } = fetchAnswering(200, {
      data: page,
      migrated: { why: { to: "reason", count: 12 } },
    });

    const result = await updatePage({ apiKey: "test", fetch: fetchImpl }, 7, {
      fields: [
        { type: "email", required: true },
        { type: "textarea", name: "reason", label: "Why are you joining?" },
      ],
      renames: { why: "reason" },
      confirm_removals: true,
    });

    expect(calls[0].url).toBe("https://api.solidarity.tech/v1/pages/7");
    expect(calls[0].init?.method).toBe("PATCH");
    expect(JSON.parse(String(calls[0].init?.body))).toMatchObject({
      renames: { why: "reason" },
      confirm_removals: true,
    });
    expect(result.ok && result.data.migrated).toEqual({
      why: { to: "reason", count: 12 },
    });
  });

  it("leaves a 409 body on `data` for StPageConflict to read", async () => {
    const body = {
      error: "Removing these would drop answers",
      requires_confirmation: true,
      impacts: [
        { kind: "field", name: "why", label: "Why?", count: 12 },
        {
          kind: "option",
          field: "building_role",
          label: "Organizer",
          count: 3,
        },
      ],
    };
    const { fetchImpl } = fetchAnswering(409, body);

    const result = await updatePage({ apiKey: "test", fetch: fetchImpl }, 7, {
      fields: [{ type: "email", required: true }],
    });

    expect(result.ok).toBe(false);
    const conflict = StPageConflict.parse(result.data);
    expect(conflict.requires_confirmation).toBe(true);
    expect(conflict.impacts?.map((impact) => impact.kind)).toEqual([
      "field",
      "option",
    ]);
  });
});

describe("page fields", () => {
  // The reference promises a field read back from the API can go into the next
  // write unchanged, which only holds if the two types line up.
  it("accepts a field read back from the API as write input", () => {
    expectTypeOf<StPageField>().toExtend<StPageFieldInput>();
  });
});
