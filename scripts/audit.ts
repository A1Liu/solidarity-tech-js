/**
 * Live schema-coverage audit for the Solidarity Tech SDK — one runner for both
 * reads and mutations.
 *
 * Each check compares a live response against the schema it is expected to
 * satisfy (a real schema, or the `UNCOVERED` placeholder for one not modeled
 * yet) and reports it the same way: covered when the schema models every key, or
 * "no schema yet" / a drift diff with the key/type shape to author or repair.
 *
 *   - Reads: one GET per list endpoint, plus a `/{id}` GET wherever an item
 *     schema is modeled. Read-only, small page size.
 *   - Mutations: a create → update → delete lifecycle per resource. THIS MUTATES
 *     DATA — point API_KEY at a throwaway account, never production. Every created
 *     row is deleted in a `finally`, so a failed check still cleans up.
 *
 * Value-free — key names and inferred type names only, never field values — with
 * two deliberate exceptions the mutation cleanup needs: it prints a created row's
 * id (required to delete it) and, ONLY if deletion fails, the raw response so an
 * orphan can be removed by hand. Requires API_KEY (Bun loads it from .env).
 *
 *   bun run scripts/audit.ts
 */
import type { ZodType } from "zod";
import { createClient } from "../index";
import { apiGet } from "../client";
import type { ApiResult, ClientConfig } from "../client";
import { UNCOVERED, shapeDiff, pickElement } from "./schema-coverage";
import { listEndpoints } from "./resource-schemas";
import type { ListEndpoint } from "./resource-schemas";
import { lifecycleResources } from "./resources";
import {
  StEventSessionResponse,
  StEventSessionMutationResponse,
} from "../endpoints/event_sessions";

const apiKey = process.env.API_KEY;
if (!apiKey) {
  console.error("Missing API_KEY environment variable (set it in .env).");
  process.exit(1);
}

const config: ClientConfig = { apiKey };
const client = createClient(config);
const listQuery = { _limit: 3 };

/** One coverage line, from a read or a mutation step. */
interface CoverageResult {
  label: string;
  covered: boolean;
  reason: string;
  /** `key: type` lines — the captured shape, or keys the schema omits. */
  keys?: string[];
  /** `path: code — expected T` lines where schema and body disagree. */
  mismatches?: string[];
}

/* ------------------------------------------------------------------ *
 * Reads — one GET per list endpoint
 * ------------------------------------------------------------------ */

async function checkList({
  resource,
  expected,
  item,
}: ListEndpoint): Promise<CoverageResult[]> {
  const res = await apiGet(config, `/${resource}`, { query: listQuery });
  if (!res.ok) return [evaluate(resource, res, expected)];

  const rows = (res.data as { data?: unknown })?.data;
  if (!Array.isArray(rows) || rows.length === 0)
    return [{ label: resource, covered: false, reason: "no rows to sample" }];

  const results = [evaluate(resource, res, expected)];

  // The item GET is a second contract, checked against a row the list just
  // returned so no row has to be created to reach it.
  const id = (rows[0] as { id?: unknown })?.id;
  if (item && typeof id === "number")
    results.push(
      evaluate(
        `${resource} GET/{id}`,
        await apiGet(config, `/${resource}/${id}`),
        item,
      ),
    );

  return results;
}

/* ------------------------------------------------------------------ *
 * Mutations — a create → update → delete lifecycle per resource
 * ------------------------------------------------------------------ */

interface MutationCase {
  resource: string;
  create: () => Promise<ApiResult<unknown>>;
  show?: (id: number) => Promise<ApiResult<unknown>>;
  update?: (id: number) => Promise<ApiResult<unknown>>;
  remove: (id: number) => Promise<ApiResult<unknown>>;
  expectedCreate?: ZodType;
  expectedShow?: ZodType;
  expectedUpdate?: ZodType;
}

/** The new row's numeric id, needed to update and delete it. */
function readId(body: unknown): number | undefined {
  const element = pickElement(body) as { id?: unknown } | undefined;
  return typeof element?.id === "number" ? element.id : undefined;
}

function evaluate(
  label: string,
  result: ApiResult<unknown>,
  expected: ZodType = UNCOVERED,
): CoverageResult {
  if (!result.ok)
    return {
      label,
      covered: false,
      reason: `request failed — ${result.error.type}: ${result.error.message}`,
    };

  const diff = shapeDiff(expected, result.data);
  if (diff.covered) return { label, covered: true, reason: "" };
  const reason =
    expected === UNCOVERED
      ? "no schema yet"
      : diff.mismatches.length
        ? "schema no longer matches the live response"
        : "live response has keys the schema omits";
  return {
    label,
    covered: false,
    reason,
    keys: diff.missingFromSchema,
    mismatches: diff.mismatches,
  };
}

async function runCase(mutation: MutationCase): Promise<CoverageResult[]> {
  const steps: CoverageResult[] = [];

  const created = await mutation.create();
  steps.push(
    evaluate(`${mutation.resource} POST`, created, mutation.expectedCreate),
  );
  if (!created.ok) return steps; // nothing was created, nothing to clean up

  const id = readId(created.data);
  if (id === undefined) {
    console.error(
      `  raw ${mutation.resource} create response for manual cleanup:`,
      JSON.stringify(created.data),
    );
    return [
      ...steps,
      {
        label: `${mutation.resource} cleanup`,
        covered: false,
        reason:
          "could not read new id from create response — MANUAL CLEANUP REQUIRED",
      },
    ];
  }

  try {
    if (mutation.show) {
      const shown = await mutation.show(id);
      steps.push(
        evaluate(`${mutation.resource} GET/{id}`, shown, mutation.expectedShow),
      );
    }
    if (mutation.update) {
      const updated = await mutation.update(id);
      steps.push(
        evaluate(`${mutation.resource} PUT`, updated, mutation.expectedUpdate),
      );
    }
  } finally {
    const removed = await mutation.remove(id);
    steps.push({
      label: `${mutation.resource} DELETE (id ${id})`,
      covered: removed.ok,
      reason: removed.ok
        ? "cleaned up"
        : `CLEANUP FAILED — ${removed.error.type}: ${removed.error.message}`,
    });
  }
  return steps;
}

async function buildCases(): Promise<MutationCase[]> {
  // A session must attach to a real event; borrow the first one we can list.
  const events = await client.listEvents({ _limit: 1 });
  if (!events.ok) {
    console.error(
      `Cannot list events to seed mutation cases: ${events.error.message}`,
    );
    return [];
  }
  const eventId = events.data.data[0]?.id;
  if (eventId === undefined) {
    console.error("No events available to attach a test session to.");
    return [];
  }

  const now = Math.floor(Date.now() / 1000);
  return [
    {
      resource: "event_sessions",
      create: () =>
        client.createEventSession({
          event_id: eventId,
          start_time: now,
          end_time: now + 3600,
          title: "[audit] schema probe",
        }),
      show: (id) => client.getEventSession(id),
      update: (id) =>
        client.updateEventSession(id, {
          title: "[audit] schema probe (updated)",
        }),
      remove: (id) => client.deleteEventSession(id),
      expectedCreate: StEventSessionMutationResponse,
      expectedShow: StEventSessionResponse,
      expectedUpdate: StEventSessionMutationResponse,
    },
  ];
}

/**
 * Lifecycle candidates the document claims but the live API cannot actually
 * drive, with what a run proved. A case here would create a row it cannot
 * delete, so it is not written — and naming it keeps the gap from reading as
 * work nobody has gotten to yet.
 */
const undrivable: Record<string, string> = {
  agent_assignments:
    "DELETE /{id} is documented but answers 404 for a row GET returns; " +
    "a run orphaned one assignment before this was known",
};

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */

function report(title: string, results: CoverageResult[]): void {
  const covered = results.filter((r) => r.covered).length;
  console.log(`\n${title} (${covered}/${results.length} covered)`);
  for (const result of [...results].sort(
    (a, b) => Number(b.covered) - Number(a.covered),
  )) {
    if (result.covered) {
      console.log(`  ✓ ${result.label}`);
      continue;
    }
    console.log(`  ✗ ${result.label} — ${result.reason}`);
    if (result.keys?.length) {
      console.log(`      keys in response, missing from schema:`);
      for (const line of result.keys) console.log(`          ${line}`);
    }
    if (result.mismatches?.length) {
      console.log(`      schema mismatch (path: code — expected):`);
      for (const line of result.mismatches) console.log(`          ${line}`);
    }
  }
}

async function runAudit(): Promise<void> {
  const reads = (await Promise.all(listEndpoints.map(checkList))).flat();
  const cases = await buildCases();
  const mutations = (await Promise.all(cases.map(runCase))).flat();

  report("List endpoints", reads);
  report("Mutations", mutations);

  // The document says these support create and delete-by-id, so each is a
  // lifecycle this runner could drive. Naming the gap keeps the hand-written
  // case list from being the only record of what is missing.
  const cased = new Set(cases.map((mutation) => mutation.resource));
  const uncovered = lifecycleResources.filter(
    (resource) => !cased.has(resource) && !(resource in undrivable),
  );
  if (uncovered.length)
    console.log(
      `\nNo mutation case yet (create + delete documented): ${uncovered.join(", ")}`,
    );
  for (const [resource, reason] of Object.entries(undrivable))
    console.log(`\nNo mutation case possible — ${resource}: ${reason}.`);

  const all = [...reads, ...mutations];
  const notCovered = all.filter((result) => !result.covered);
  const cleanupFailed = mutations.filter((r) => r.reason.includes("CLEANUP"));
  if (cleanupFailed.length)
    console.log(
      `\n⚠ ${cleanupFailed.length} row(s) may not have been deleted — check the account.`,
    );

  console.log(
    notCovered.length
      ? `\n${notCovered.length} of ${all.length} not covered — see diffs above.\n`
      : `\nAll ${all.length} checks covered ✓\n`,
  );
  process.exit(notCovered.length === 0 ? 0 : 1);
}

await runAudit();
