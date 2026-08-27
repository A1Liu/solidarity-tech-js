/**
 * Establish the resource inventory by asking the live API.
 *
 * Writes `tests/data/inventory.json`: one entry per candidate resource holding
 * the HTTP status the live API answered for its collection GET and, when a row
 * was available to address, its item GET. `scripts/resources.ts` reads that file
 * and nothing else, so what the SDK believes exists is what a real request
 * returned rather than what a document claims.
 *
 * The manifest records failures as well as successes. A resource that answers
 * 404 stays in the file with its 404, because "asked and it is not there" is a
 * finding worth keeping — deleting the entry would leave it looking like a
 * resource nobody has gotten to yet, and the next person would re-derive it from
 * the same wrong document.
 *
 * With no arguments it re-probes every resource already in the manifest, which
 * is how a status is refreshed. Naming resources probes those as well and adds
 * them, which is how a new one enters the inventory:
 *
 *   bun run probe
 *   bun run probe pledges petitions
 *
 * Candidate names have to come from somewhere, and no request can enumerate
 * them: the API has no index endpoint. They come from a human reading
 * https://solidarity.tech/reference (or the vendored document, which is a hint
 * list and often wrong) and naming what they see. The probe is what decides
 * whether the name was real.
 *
 * Read-only: two GETs per resource, no mutation. Value-free — it records status
 * codes, never a field from any body. Requires API_KEY (Bun loads it from .env).
 */
import { writeFile } from "node:fs/promises";
import { z } from "zod";
import { apiGet } from "../client";
import type { ClientConfig } from "../client";
import { inventoryPath, probedResources } from "./resources";
import type { ResourceProbe } from "./resources";

const apiKey = process.env.API_KEY;
if (!apiKey) {
  console.error("Missing API_KEY environment variable (set it in .env).");
  process.exit(1);
}

const config: ClientConfig = { apiKey };
// One row is all the item probe needs, and a probe should cost the account as
// little as the question allows.
const probeQuery = { _limit: 1 };

const listEnvelope = z.object({
  data: z.array(z.object({ id: z.number().int() }).loose()),
});

/**
 * The id of a row the collection just returned, so the item GET addresses
 * something that exists. Without one, a 404 from `/{resource}/{id}` cannot be
 * told apart from a missing row, so the item status stays unprobed.
 */
function firstId(body: unknown): number | undefined {
  const envelope = listEnvelope.safeParse(body);
  return envelope.success ? envelope.data.data[0]?.id : undefined;
}

async function probe(resource: string): Promise<ResourceProbe> {
  const list = await apiGet(config, `/${resource}`, { query: probeQuery });
  if (!list.ok) return { list: list.status, item: null };

  const id = firstId(list.data);
  if (id === undefined) return { list: list.status, item: null };

  const item = await apiGet(config, `/${resource}/${id}`);
  return { list: list.status, item: item.status };
}

/** `200` / `404` / `network` for the status a request never got to have. */
function describe(status: number | null): string {
  if (status === null) return "not probed";
  return status === 0 ? "network" : String(status);
}

function line(resource: string, result: ResourceProbe): string {
  const mark = result.list === 200 ? "✓" : "✗";
  const item = result.item === null ? "" : `, item ${describe(result.item)}`;
  return `  ${mark} ${resource} — list ${describe(result.list)}${item}`;
}

async function runProbe(): Promise<void> {
  const named = process.argv.slice(2);
  const resources = [...new Set([...probedResources, ...named])].sort();
  if (resources.length === 0) {
    console.error("Nothing to probe — name at least one resource.");
    process.exit(1);
  }

  const results = await Promise.all(resources.map(probe));
  const inventory = Object.fromEntries(
    resources.map((resource, index) => [resource, results[index]]),
  );
  await writeFile(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);

  console.log(`\nResource inventory (${inventoryPath})`);
  for (const [index, resource] of resources.entries())
    console.log(line(resource, results[index] as ResourceProbe));

  const serving = results.filter((result) => result.list === 200).length;
  console.log(
    `\n${serving} of ${resources.length} answered a collection GET ✓\n`,
  );
}

await runProbe();
