import { describe, it, expect } from "vitest";
import { z } from "zod";
import { apiGet, apiPost, retryAfterMs } from "../client";

/** A `fetch` that answers every call with the given response. */
function fetchReturning(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): typeof fetch {
  const impl = async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json", ...headers },
    });
  return impl as unknown as typeof fetch;
}

const config = { apiKey: "test" };

describe("ApiResult.headers", () => {
  it("carries the response headers on success", async () => {
    const result = await apiGet(
      { ...config, fetch: fetchReturning(200, { id: 1 }, { "x-foo": "bar" }) },
      "/users",
      { schema: z.object({ id: z.number() }) },
    );
    expect(result.ok).toBe(true);
    expect(result.headers.get("x-foo")).toBe("bar");
  });

  it("carries the response headers on an HTTP failure", async () => {
    const result = await apiPost(
      {
        ...config,
        fetch: fetchReturning(
          429,
          { error: "slow down" },
          { "retry-after": "7" },
        ),
      },
      "/users",
      { body: {} },
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe(429);
    expect(result.headers.get("retry-after")).toBe("7");
    expect(retryAfterMs(result)).toBe(7000);
  });

  it("carries the response headers on a validation failure", async () => {
    const result = await apiGet(
      {
        ...config,
        fetch: fetchReturning(200, { id: "no" }, { "x-foo": "bar" }),
      },
      "/users",
      { schema: z.object({ id: z.number() }) },
    );
    expect(result.ok).toBe(false);
    expect(result.error?.type).toBe("validation");
    expect(result.headers.get("x-foo")).toBe("bar");
  });

  it("is empty on a network failure", async () => {
    const failing = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    const result = await apiGet({ ...config, fetch: failing }, "/users");
    expect(result.ok).toBe(false);
    expect(result.error?.type).toBe("network");
    expect(result.headers).toBeInstanceOf(Headers);
    expect([...result.headers.keys()]).toEqual([]);
    expect(retryAfterMs(result)).toBeUndefined();
  });
});

describe("retryAfterMs", () => {
  const withRetryAfter = (value: string) =>
    new Headers({ "retry-after": value });

  it("reads a delay in seconds", () => {
    expect(retryAfterMs(withRetryAfter("30"))).toBe(30_000);
    expect(retryAfterMs(withRetryAfter("0"))).toBe(0);
  });

  it("reads an HTTP date relative to `now`", () => {
    const now = Date.parse("Mon, 01 Jan 2024 00:00:00 GMT");
    const later = "Mon, 01 Jan 2024 00:00:45 GMT";
    expect(retryAfterMs(withRetryAfter(later), now)).toBe(45_000);
  });

  it("clamps a date in the past to zero", () => {
    const now = Date.parse("Mon, 01 Jan 2024 00:01:00 GMT");
    const earlier = "Mon, 01 Jan 2024 00:00:00 GMT";
    expect(retryAfterMs(withRetryAfter(earlier), now)).toBe(0);
  });

  it("is undefined when the header is missing or unparseable", () => {
    expect(retryAfterMs(new Headers())).toBeUndefined();
    expect(retryAfterMs(withRetryAfter(""))).toBeUndefined();
    expect(retryAfterMs(withRetryAfter("soon"))).toBeUndefined();
  });
});
