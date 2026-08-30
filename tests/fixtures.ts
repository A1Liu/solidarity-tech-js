import { readFileSync, existsSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { listEndpoints } from "../scripts/resource-schemas";
import { fixturePath, itemFixturePath } from "../scripts/resources";
import { UNCOVERED } from "../scripts/schema-coverage";

/**
 * Every fixture `scripts/capture.ts` writes for a modeled resource must parse
 * against that resource's schema, so a schema that drifts from the shape the API
 * actually returns fails here rather than in a caller.
 */
const modeled = listEndpoints.filter(
  (endpoint) =>
    endpoint.expected !== UNCOVERED &&
    existsSync(fixturePath(endpoint.resource)),
);

const modeledItems = listEndpoints.flatMap(({ resource, item }) =>
  item && existsSync(itemFixturePath(resource))
    ? [{ resource, expected: item }]
    : [],
);

describe("committed fixtures", () => {
  it("cover at least one modeled resource", () => {
    expect(modeled.length).toBeGreaterThan(0);
  });

  for (const { resource, expected } of modeled) {
    it(`${resource}.json parses against its response schema`, () => {
      const fixture: unknown = JSON.parse(
        readFileSync(fixturePath(resource), "utf8"),
      );
      expect(expected.safeParse(fixture).error?.issues ?? []).toEqual([]);
    });
  }

  for (const { resource, expected } of modeledItems) {
    it(`${resource}.item.json parses against its item schema`, () => {
      const fixture: unknown = JSON.parse(
        readFileSync(itemFixturePath(resource), "utf8"),
      );
      expect(expected.safeParse(fixture).error?.issues ?? []).toEqual([]);
    });
  }
});
