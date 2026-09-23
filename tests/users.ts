import { describe, it, expect } from "vitest";
import { deleteUser } from "../endpoints/users";

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

describe("deleteUser", () => {
  it("DELETEs /users/{id} and parses the declared 200 body", async () => {
    const { calls, fetchImpl } = fetchAnswering(200, {
      message: "User deleted",
    });

    const result = await deleteUser({ apiKey: "test", fetch: fetchImpl }, 42);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.solidarity.tech/v1/users/42");
    expect(calls[0].init?.method).toBe("DELETE");
    expect(calls[0].init?.body).toBeUndefined();
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ message: "User deleted" });
  });

  it("carries the id of a user a sub-org key kept", async () => {
    const { fetchImpl } = fetchAnswering(200, {
      message: "Removed chapter memberships",
      id: 42,
    });

    const result = await deleteUser({ apiKey: "test", fetch: fetchImpl }, 42);

    if (!result.ok) throw new Error(result.error.message);
    expect(result.data.id).toBe(42);
  });

  it("reports a 404 as an http failure", async () => {
    const { fetchImpl } = fetchAnswering(404, { error: "not found" });

    const result = await deleteUser({ apiKey: "test", fetch: fetchImpl }, 42);

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.error?.type).toBe("http");
  });
});
