import { describe, it, expect } from "vitest";
import { deleteUserAction } from "../endpoints/user_actions";

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

describe("deleteUserAction", () => {
  it("DELETEs /user_actions/{id} and parses the live 200 body", async () => {
    const { calls, fetchImpl } = fetchAnswering(200, {
      message: "User action successfully deleted.",
    });

    const result = await deleteUserAction(
      { apiKey: "test", fetch: fetchImpl },
      42,
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.solidarity.tech/v1/user_actions/42");
    expect(calls[0].init?.method).toBe("DELETE");
    expect(calls[0].init?.body).toBeUndefined();
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({
      message: "User action successfully deleted.",
    });
  });

  it("reports a 404 as an http failure", async () => {
    const { fetchImpl } = fetchAnswering(404, {
      error: "User action not found",
    });

    const result = await deleteUserAction(
      { apiKey: "test", fetch: fetchImpl },
      42,
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.error?.type).toBe("http");
  });
});
