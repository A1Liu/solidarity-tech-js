/**
 * Derive a Zod draft for every list resource, from both sources that describe it.
 *
 * Neither source alone is enough. A committed fixture is live truth but a thin
 * sample: a column null in every row infers `z.null()`, an always-empty array
 * infers `z.array(z.any())`. Each draft therefore opens with what its sample
 * could not decide, because sample thinness is a property of the account rather
 * than of the page size — several resources hold one row no `_limit` will
 * widen, and those are exactly the fields the document has to settle. The document's entity schema declares the
 * nullability and closed sets no sample can show, but it is stale and incomplete
 * — its `Organization` omits `id`, its `Chapter` omits `calendar_feed_url`. So a
 * draft carries both, each named for what it describes, and a human reconciles
 * them.
 *
 * Drafting from committed data only means this never touches the network and
 * needs no API key: a fresh clone regenerates every draft offline, including for
 * the resources whose live list is empty and may never have a fixture. Capture
 * does not call it — a pure function of committed data needs no live run, and
 * wiring it in would re-couple two subsystems that were just separated.
 *
 * Drafts are committed and value-free — key names and inferred type names only —
 * so a diff shows the live shape changing, and `tsc --noEmit` verifies them like
 * any other source. A draft is a starting point for a human, never pasted into
 * `schemas.ts` unedited.
 *
 *   bun run draft
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createSchema } from "genson-js";
import { jsonSchemaToZod } from "json-schema-to-zod";
import type { JsonSchema } from "json-schema-to-zod";
import { format } from "prettier";
import {
  draftDirectory,
  fixturePath,
  listResources,
  specComponent,
} from "./resources";

export interface DraftOutcome {
  resource: string;
  /** Which of the two inputs the draft was built from. */
  sources: string[];
  error?: string;
}

interface Fixture {
  zod: string;
  /** Key names and counts only — never a field value. */
  undecided: string[];
}

/** Contains the `any` the `Object.entries` overload produces for a bare object. */
function entriesOf(value: object): [string, unknown][] {
  return Object.entries(value);
}

function rowsOf(body: unknown): Record<string, unknown>[] {
  const data = (body as { data?: unknown })?.data;
  if (!Array.isArray(data)) return [];
  return data.filter(
    (row): row is Record<string, unknown> =>
      row !== null && typeof row === "object" && !Array.isArray(row),
  );
}

/**
 * What this sample leaves open, as key names: the fields whose inferred type is
 * an artifact of how little the account holds rather than of the API's contract.
 * Each one has to be settled from the document's entity schema.
 */
function undecidedBy(rows: Record<string, unknown>[]): string[] {
  if (rows.length === 0) return [];
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))].sort();

  const allRowsHave = (key: string, holds: (value: unknown) => boolean) =>
    rows.every((row) => key in row && holds(row[key]));

  const alwaysNull = keys.filter((key) =>
    allRowsHave(key, (value) => value === null),
  );
  const alwaysEmpty = keys.filter((key) =>
    allRowsHave(key, (value) => Array.isArray(value) && value.length === 0),
  );

  const notes: string[] = [`sampled ${rows.length} row(s)`];
  if (alwaysNull.length)
    notes.push(
      `null in every row, so the non-null type is unverified: ${alwaysNull.join(", ")}`,
    );
  if (alwaysEmpty.length)
    notes.push(
      `empty in every row, so the element type is unverified: ${alwaysEmpty.join(", ")}`,
    );
  if (rows.length === 1)
    notes.push(
      "one row only — this sample decides no nullability at all; take it from `specElement`",
    );
  else {
    const invariant = keys.filter(
      (key) =>
        new Set(rows.map((row) => JSON.stringify(row[key]))).size === 1 &&
        !alwaysNull.includes(key) &&
        !alwaysEmpty.includes(key),
    );
    if (invariant.length)
      notes.push(
        `one distinct value across the sample: ${invariant.join(", ")}`,
      );
  }
  return notes;
}

async function fromFixture(resource: string): Promise<Fixture | undefined> {
  const path = fixturePath(resource);
  if (!existsSync(path)) return undefined;
  const body: unknown = JSON.parse(await readFile(path, "utf8"));
  return {
    zod: jsonSchemaToZod(createSchema(body)),
    undecided: undecidedBy(rowsOf(body)),
  };
}

function fromSpec(resource: string): string | undefined {
  const component = specComponent(resource);
  // `resolveJsonModule` widens the document's literals to `string`, so the
  // narrowing cannot be inferred. The document is JSON Schema by construction.
  return component === undefined
    ? undefined
    : jsonSchemaToZod(component as JsonSchema);
}

async function draftOne(resource: string): Promise<DraftOutcome> {
  try {
    const fixture = await fromFixture(resource);
    const element = fromSpec(resource);
    if (!fixture && !element) return { resource, sources: [] };

    const parts = ['import { z } from "zod";'];
    if (fixture)
      parts.push(
        [
          "/**",
          ` * The whole response, inferred from \`${fixturePath(resource)}\`.`,
          " *",
          " * What this sample does NOT decide:",
          ...fixture.undecided.map((note) => ` * - ${note}`),
          " */",
        ].join("\n"),
        `export const fixtureResponse = ${fixture.zod};`,
      );
    if (element)
      parts.push(
        `/** One element, from the document's entity schema — stale, but it declares nullability and closed sets a sample cannot. */`,
        `export const specElement = ${element};`,
      );

    await writeFile(
      join(draftDirectory, `${resource}.ts`),
      await format(parts.join("\n\n"), { parser: "typescript" }),
    );
    return {
      resource,
      sources: [...(fixture ? ["fixture"] : []), ...(element ? ["spec"] : [])],
    };
  } catch (error) {
    return {
      resource,
      sources: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** One draft per list resource. Failures are reported, never thrown. */
export async function draftResources(): Promise<DraftOutcome[]> {
  await mkdir(draftDirectory, { recursive: true });
  return Promise.all(listResources.map(draftOne));
}

export function reportDrafts(outcomes: DraftOutcome[]): void {
  console.log(`\nSchema drafts (${draftDirectory})`);
  for (const outcome of outcomes) {
    if (outcome.error)
      console.log(`  ✗ ${outcome.resource} — ${outcome.error}`);
    else if (outcome.sources.length === 0)
      console.log(`  · ${outcome.resource} — no fixture and no entity schema`);
    else
      console.log(`  ✓ ${outcome.resource} — ${outcome.sources.join(" + ")}`);
  }
}

if (import.meta.main) reportDrafts(await draftResources());
