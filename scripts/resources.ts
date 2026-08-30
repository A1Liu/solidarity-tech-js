/**
 * What the live API actually serves.
 *
 * The inventory is a record of requests that were made: `tests/data/inventory.json`
 * holds, per resource, the HTTP status the live API answered for its collection
 * GET and its item GET. `scripts/probe.ts` writes it; nothing here consults a
 * document. An endpoint exists here because a real request came back 200, and a
 * 404 is equally a finding — but a finding about that one request. `user_notes`
 * answers 404 on its collection GET and is real all the same, because it only
 * takes POST. Nothing in this manifest has asked about writes.
 *
 * This is deliberately not derived from the vendored OpenAPI document, which is
 * stale and wrong in both directions — it declares operations the API answers
 * 404 for (`DELETE /agent_assignments/{id}`) and omits ones it serves. The
 * document is a source of candidate names to probe, never a statement about what
 * is there.
 *
 * The manifest is imported rather than read, so a missing or malformed file is a
 * type error at build time instead of a runtime surprise, and no path is
 * resolved against the current working directory to load it.
 *
 * This module deliberately imports no Zod schema, which is what keeps the
 * inventory independent of the schemas the fixtures it names go on to author.
 */
import { join } from "node:path";
import probed from "../tests/data/inventory.json";

/** The status the live API answered, per operation. */
export interface ResourceProbe {
  /** `GET /{resource}`. */
  list: number;
  /**
   * `GET /{resource}/{id}`, or null when there was no row to address — an item
   * GET cannot be probed against a collection that answered nothing.
   */
  item: number | null;
}

const inventory: Record<string, ResourceProbe> = probed;

export const fixtureDirectory = "tests/data";
export const draftDirectory = join(fixtureDirectory, "drafts");
export const inventoryPath = join(fixtureDirectory, "inventory.json");

export function fixturePath(resource: string): string {
  return join(fixtureDirectory, `${resource}.json`);
}

/**
 * The item GET's fixture, kept beside the list's rather than inside it. An item
 * response is a different shape, not a subset: `GET /organizations/{id}` carries
 * `parent` and `children` that the collection omits entirely.
 */
export function itemFixturePath(resource: string): string {
  return join(fixtureDirectory, `${resource}.item.json`);
}

const probes = Object.entries(inventory);

/**
 * Every name that has been probed, whatever the answer — the candidate list a
 * re-probe walks. Includes resources that answered 404, so a name is asked about
 * again rather than quietly dropped.
 */
export const probedResources: string[] = probes.map(([resource]) => resource);

/**
 * Resources whose collection GET answered 200 — what there is to read and
 * sample. Not "the resources that exist": a write-only resource is absent from
 * this list, so anything reasoning about writes wants `probedResources`.
 */
export const listResources: string[] = probes
  .filter(([, result]) => result.list === 200)
  .map(([resource]) => resource)
  .sort();

/**
 * Resources whose `/{id}` GET answered 200 for a row the collection returned.
 * Sampling these is what keeps a schema authored from a list fixture alone from
 * being mistaken for the item endpoint's contract.
 */
export const itemResources: string[] = probes
  .filter(([, result]) => result.item === 200)
  .map(([resource]) => resource)
  .sort();
