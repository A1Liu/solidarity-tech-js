/**
 * Derive a Zod draft for every list resource from the responses it actually
 * returned.
 *
 * A committed fixture is the only source here. It is live truth but a thin one:
 * a column null in every row infers `z.null()`, an always-empty array infers
 * `z.array(z.any())`. So every draft opens with what its sample could not
 * decide, and that block is the draft's most important output — sample thinness
 * is a property of the account rather than of the page size, and several
 * resources hold one row no `_limit` will widen.
 *
 * Nothing settles those fields automatically, and deliberately so. The vendored
 * OpenAPI document used to fill that role and was wrong often enough to be worse
 * than an admitted gap: it declares `last_app_activity_at` as an offset datetime
 * where the API returns a plain date, and omits fields it does describe
 * (`Organization` has no `id`, `Chapter` no `calendar_feed_url`). An undecided
 * field is closed by evidence — a wider sample, a different account, a second
 * capture later — or it is modeled defensively and the comment says which.
 *
 * A resource with an item GET gets a second inferred schema from its item
 * fixture, because that response is a different shape rather than a subset.
 *
 * Drafting from committed data only means this never touches the network and
 * needs no API key: a fresh clone regenerates every draft offline. Capture does
 * not call it — a pure function of committed data needs no live run, and wiring
 * it in would re-couple two subsystems that were just separated.
 *
 * Drafts are committed and value-free — key names and inferred type names only —
 * so a diff shows the live shape changing, and `tsc --noEmit` verifies them like
 * any other source. A draft is a starting point for a human, never pasted into
 * `schemas.ts` unedited.
 *
 *   bun run draft
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createSchema } from "genson-js";
import { jsonSchemaToZod } from "json-schema-to-zod";
import { format } from "prettier";
import {
  draftDirectory,
  fixturePath,
  itemFixturePath,
  listResources,
} from "./resources";

export interface DraftOutcome {
  resource: string;
  /** Which committed fixtures the draft was built from. */
  sources: string[];
  error?: string;
}

interface Inferred {
  zod: string;
  /** Key names and counts only — never a field value. */
  undecided: string[];
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
 * Each one has to be settled by evidence or modeled defensively and commented.
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
    notes.push("one row only — this sample decides no nullability at all");
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

async function infer(path: string): Promise<Inferred | undefined> {
  if (!existsSync(path)) return undefined;
  const body: unknown = JSON.parse(await readFile(path, "utf8"));
  return {
    zod: jsonSchemaToZod(createSchema(body)),
    undecided: undecidedBy(rowsOf(body)),
  };
}

function section(name: string, path: string, inferred: Inferred): string[] {
  const notes = inferred.undecided.length
    ? [
        " *",
        " * What this sample does NOT decide:",
        ...inferred.undecided.map((note) => ` * - ${note}`),
      ]
    : [];
  return [
    [
      "/**",
      ` * The whole response, inferred from \`${path}\`.`,
      ...notes,
      " */",
    ].join("\n"),
    `export const ${name} = ${inferred.zod};`,
  ];
}

async function draftOne(resource: string): Promise<DraftOutcome> {
  const draftPath = join(draftDirectory, `${resource}.ts`);
  try {
    const list = await infer(fixturePath(resource));
    const item = await infer(itemFixturePath(resource));
    if (!list && !item) {
      // A draft that outlives its fixture describes a shape nothing verified.
      await rm(draftPath, { force: true });
      return { resource, sources: [] };
    }

    const parts = ['import { z } from "zod";'];
    if (list)
      parts.push(...section("fixtureResponse", fixturePath(resource), list));
    if (item)
      parts.push(...section("itemResponse", itemFixturePath(resource), item));

    await writeFile(
      draftPath,
      await format(parts.join("\n\n"), { parser: "typescript" }),
    );
    return {
      resource,
      sources: [...(list ? ["list"] : []), ...(item ? ["item"] : [])],
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
      console.log(`  · ${outcome.resource} — no fixture captured yet`);
    else
      console.log(`  ✓ ${outcome.resource} — ${outcome.sources.join(" + ")}`);
  }
}

if (import.meta.main) reportDrafts(await draftResources());
