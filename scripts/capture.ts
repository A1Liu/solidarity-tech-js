/**
 * Capture committed response fixtures from the live API (ADR 0001).
 *
 * Samples a list resource raw, scrubs personal data out in memory, proves no
 * live string survived, and writes `tests/data/<resource>.json`. The unscrubbed
 * body never reaches disk, so the guarantee does not depend on a `.gitignore`
 * entry being correct.
 *
 * The scrub is the only gate, and nothing else may be added to the exit code. A
 * fixture is the material a schema gets authored or repaired from, so a wrong
 * schema must never be able to withhold the sample that fixes it. Drift is
 * reported where it belongs — `tests/fixtures.ts` fails the build on it,
 * `scripts/audit.ts` diffs it.
 *
 * A resource with an item GET is sampled twice — the collection, then
 * `/{id}` for the first row it returned — because the item response is a
 * different shape, not a subset of the list's.
 *
 * With no arguments it captures every list resource that has no fixture yet.
 * Naming resources captures those and overwrites them, which is how a stale
 * fixture is refreshed — the default never overwrites, because fixtures carry
 * hand-written value assertions (`tests/events.ts`).
 *
 *   bun run capture
 *   bun run capture users chapters
 *
 * Read-only: it issues one GET per resource and never mutates. Requires API_KEY
 * (Bun loads it from .env).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { z } from "zod";
import { apiGet } from "../client";
import type { ClientConfig } from "../client";
import {
  fixtureDirectory,
  fixturePath,
  itemFixturePath,
  itemResources,
  listResources,
} from "./resources";
import { findRetainedStrings, scrubResponse } from "./scrub";

const apiKey = process.env.API_KEY;
if (!apiKey) {
  console.error("Missing API_KEY environment variable (set it in .env).");
  process.exit(1);
}

const config: ClientConfig = { apiKey };
// More rows than a schema strictly needs: nullability is only as good as what
// varies across them, and every extra row is scrubbed like the rest. The
// document declares a default of 20 and no maximum.
const captureQuery = { _limit: 25 };

const listEnvelope = z.object({
  data: z.array(z.object({ id: z.number().int() }).loose()),
});

type CaptureOutcome =
  | { status: "written"; resource: string; rows: number; item: string }
  | { status: "skipped"; resource: string; reason: string }
  | { status: "failed"; resource: string; reason: string };

/** Scrub a body and write it, or report why no fixture was written. */
async function writeFixture(
  path: string,
  body: unknown,
): Promise<string | undefined> {
  const scrubbed = scrubResponse(body);
  const retained = findRetainedStrings(body, scrubbed);
  if (retained.length)
    return `scrub left live strings at: ${retained.join(", ")}`;
  await writeFile(path, `${JSON.stringify(scrubbed, null, 2)}\n`);
  return undefined;
}

/**
 * Sample `/{resource}/{id}` for a row the collection already returned. Reported
 * beside the list rather than as its own outcome: a resource whose item GET is
 * undocumented or unimplemented still has a perfectly good list fixture.
 */
async function captureItem(resource: string, id: number): Promise<string> {
  const response = await apiGet(config, `/${resource}/${id}`);
  if (!response.ok) return `item ✗ (${response.error.type})`;
  const failure = await writeFixture(itemFixturePath(resource), response.data);
  return failure ? `item ✗ (${failure})` : "item ✓";
}

async function capture(resource: string): Promise<CaptureOutcome> {
  const response = await apiGet(config, `/${resource}`, {
    query: captureQuery,
  });
  if (!response.ok)
    return {
      status: "failed",
      resource,
      reason: `request failed — ${response.error.type}: ${response.error.message}`,
    };

  const envelope = listEnvelope.safeParse(response.data);
  if (!envelope.success)
    return { status: "failed", resource, reason: "not a list envelope" };
  const rows = envelope.data.data;
  if (rows.length === 0)
    return { status: "skipped", resource, reason: "no rows to capture" };

  const failure = await writeFixture(fixturePath(resource), response.data);
  if (failure) return { status: "failed", resource, reason: failure };

  const firstId = rows[0]?.id;
  const item =
    itemResources.includes(resource) && firstId !== undefined
      ? await captureItem(resource, firstId)
      : "";

  return { status: "written", resource, rows: rows.length, item };
}

interface Selection {
  resources: string[];
  unknownResources: string[];
}

function select(requested: string[]): Selection {
  if (requested.length === 0)
    return {
      resources: listResources.filter(
        (resource) => !existsSync(fixturePath(resource)),
      ),
      unknownResources: [],
    };

  const known = new Set(listResources);
  return {
    resources: requested.filter((name) => known.has(name)),
    unknownResources: requested.filter((name) => !known.has(name)),
  };
}

function report(outcomes: CaptureOutcome[]): void {
  for (const outcome of outcomes) {
    switch (outcome.status) {
      case "written":
        console.log(
          `  ✓ ${outcome.resource} — ${outcome.rows} row(s) → ${fixturePath(outcome.resource)}` +
            (outcome.item ? `  ${outcome.item}` : ""),
        );
        break;
      case "skipped":
        console.log(`  · ${outcome.resource} — ${outcome.reason}`);
        break;
      case "failed":
        console.log(`  ✗ ${outcome.resource} — ${outcome.reason}`);
        break;
    }
  }
}

async function runCapture(): Promise<void> {
  const { resources, unknownResources } = select(process.argv.slice(2));
  for (const name of unknownResources)
    console.error(`Unknown resource: ${name}`);

  if (resources.length === 0) {
    console.log(
      unknownResources.length
        ? "Nothing to capture."
        : "Every list resource already has a fixture — name resources to refresh them.",
    );
    process.exit(unknownResources.length === 0 ? 0 : 1);
  }

  await mkdir(fixtureDirectory, { recursive: true });
  const outcomes = await Promise.all(resources.map(capture));

  console.log(`\nCaptured fixtures (${fixtureDirectory})`);
  report(outcomes);

  const failed = outcomes.filter((outcome) => outcome.status === "failed");
  console.log(
    failed.length
      ? `\n${failed.length} of ${outcomes.length} failed — no fixture was written for those.\n`
      : `\n${outcomes.length} resource(s) processed ✓\n`,
  );
  process.exit(failed.length === 0 && unknownResources.length === 0 ? 0 : 1);
}

await runCapture();
