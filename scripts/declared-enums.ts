/**
 * Every property this SDK's own schemas declare as a closed set of strings.
 *
 * `scripts/scrub.ts` is the consumer: a captured string survives verbatim only
 * when its key appears here and its value is one of these members. That makes
 * the exemption list a consequence of what has already been modeled, rather than
 * something added by memory.
 *
 * The declarations come from the response schemas in `endpoints/` and
 * `schemas.ts` — schemas written against live samples and reviewed by a human —
 * and not from the vendored OpenAPI document, which declares closed sets for
 * fields it describes wrongly and is missing the ones it never described. The
 * document's word is not evidence that a value is a fixed literal; a schema that
 * has been reconciled against live responses is.
 *
 * The ordering this creates is deliberate. A resource with no schema yet gets no
 * exemptions, so its first capture scrubs everything — the fail-closed default.
 * Adding a `z.enum` to a schema afterwards makes the old fixture stop parsing in
 * `tests/fixtures.ts`, because its values were replaced with stand-ins; the fix
 * is to re-capture the fixture, and the failure is what tells you to.
 *
 * Members are read out of the JSON Schema each Zod schema converts to, so both
 * spellings of a closed set are found: `z.enum([...])` becomes an `enum` list,
 * and a union of `z.literal(...)` becomes an `anyOf` of `const`s.
 */
import { z } from "zod";
import type { ZodType } from "zod";
import { registeredSchemas } from "./resource-schemas";

/** Contains the `any` the `Object.entries` overload produces for a bare object. */
function entriesOf(value: object): [string, unknown][] {
  return Object.entries(value);
}

function record(node: object): Record<string, unknown> {
  return Object.fromEntries(entriesOf(node));
}

function addMembers(
  found: Map<string, Set<string>>,
  key: string,
  members: unknown[],
): void {
  const literals = members.filter(
    (member): member is string => typeof member === "string",
  );
  if (literals.length === 0) return;
  const existing = found.get(key) ?? new Set<string>();
  for (const literal of literals) existing.add(literal);
  found.set(key, existing);
}

/**
 * Collect closed sets by the property name they are declared under. Members
 * accumulate rather than replace: a union of `const`s arrives one branch at a
 * time, and the same property modeled by two resources contributes to one set.
 */
function walk(
  node: unknown,
  key: string,
  found: Map<string, Set<string>>,
): void {
  if (node === null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) walk(item, key, found);
    return;
  }
  const schema = record(node);
  // A closed set declared on a bare schema carries no property name, so there is
  // no captured key it could ever exempt.
  if (key) {
    if (Array.isArray(schema.enum)) addMembers(found, key, schema.enum);
    if ("const" in schema) addMembers(found, key, [schema.const]);
  }
  const properties = schema.properties;
  if (properties !== null && typeof properties === "object")
    for (const [name, value] of entriesOf(properties)) walk(value, name, found);
  for (const [name, value] of entriesOf(schema))
    if (name !== "properties") walk(value, key, found);
}

/**
 * A Zod schema as JSON Schema. `unrepresentable: "any"` keeps the event schemas'
 * transforms from aborting the conversion, and `io: "output"` reads the parsed
 * shape — the one a fixture is compared against.
 */
function asJsonSchema(schema: ZodType): unknown {
  return z.toJSONSchema(schema, { unrepresentable: "any", io: "output" });
}

function collect(): Map<string, Set<string>> {
  const found = new Map<string, Set<string>>();
  for (const schema of registeredSchemas) walk(asJsonSchema(schema), "", found);
  return found;
}

export const declaredEnums: ReadonlyMap<
  string,
  ReadonlySet<string>
> = collect();
