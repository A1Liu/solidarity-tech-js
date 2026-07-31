/**
 * Shared, value-free shape-diff for the coverage audit.
 *
 * "Value-free" is the contract: every string this module produces is a key name
 * or an inferred type name (string/number/…), never a field value, so a report
 * built from it exposes no personal data.
 */
import type { ZodType } from "zod";
import { z } from "zod";

/**
 * Universal placeholder for a resource with no schema yet. It models no keys, so
 * on parse Zod strips every key — and the whole live shape then surfaces in the
 * diff as "missing from schema", i.e. the capture list to author a schema from.
 */
export const UNCOVERED = z.object({});

/** The value's JSON type name — never its value, so no field data leaks. */
export function typeName(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value))
    return value.length ? `${typeName(value[0])}[]` : "unknown[]";
  return typeof value;
}

/** The record inside a response: `{ data: obj }`, a list's first row, or the body. */
export function pickElement(body: unknown): unknown {
  const data = (body as { data?: unknown })?.data;
  if (data && typeof data === "object" && !Array.isArray(data)) return data;
  if (Array.isArray(data)) return data[0];
  return body;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function formatIssue(issue: z.core.$ZodIssue): string {
  const path = issue.path.length ? issue.path.join(".") : "(root)";
  const expected = "expected" in issue ? ` — expected ${issue.expected}` : "";
  return `${path}: ${issue.code}${expected}`;
}

export interface ShapeDiff {
  /** True when the body parsed green AND the schema models every element key. */
  covered: boolean;
  /** `key: type` lines for element keys the schema does not model. */
  missingFromSchema: string[];
  /** `path: code — expected T` lines where the schema and body disagree. */
  mismatches: string[];
}

/**
 * Compare a live `body` against its `expected` schema. Additive keys are found
 * without introspecting the schema: Zod strips unknown keys on a green parse, so
 * any key in the raw element but absent from the parsed element is one the schema
 * does not model.
 */
export function shapeDiff(expected: ZodType, body: unknown): ShapeDiff {
  const parsed = expected.safeParse(body);
  if (!parsed.success)
    return {
      covered: false,
      missingFromSchema: [],
      mismatches: parsed.error.issues.map(formatIssue),
    };

  const rawElement = asRecord(pickElement(body));
  const modeled = asRecord(pickElement(parsed.data));
  const missingFromSchema = Object.keys(rawElement)
    .filter((key) => !(key in modeled))
    .map((key) => `${key}: ${typeName(rawElement[key])}`);
  return {
    covered: missingFromSchema.length === 0,
    missingFromSchema,
    mismatches: [],
  };
}
