/**
 * What the vendored OpenAPI document says exists.
 *
 * The inventory is derived rather than hand-maintained: a list resource is a
 * collection GET, a path supporting `get` with no `{id}` segment. Deriving it
 * means a resource is never missed by memory — the document lists `event_rsvps`,
 * which the hand-written inventory omitted.
 *
 * The document is imported, not read and parsed, so every derivation is
 * type-checked against the real document and no path is resolved against the
 * current working directory. `tsconfig.build.json` excludes `.api`, so none of it
 * reaches `dist/`. `bun run update` refreshes it.
 *
 * It is a description, not an oracle. It is stale in places, so the live API
 * settles every disagreement: a resource it no longer serves reports `failed` in
 * capture and `request failed` in the audit, and its entity schemas are a draft
 * input (`scripts/draft.ts`), never a source of truth. Nothing in the document
 * references those schemas — it contains no `$ref` at all — which is why an
 * operation-walking read of it finds only six described response bodies.
 *
 * This module deliberately imports no Zod schema, which is what lets
 * `scripts/capture.ts` stay independent of the schemas its fixtures author.
 */
import { join } from "node:path";
import spec from "../.api/apis/solidarity-tech/openapi.json";

export const fixtureDirectory = "tests/data";
export const draftDirectory = join(fixtureDirectory, "drafts");

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

/** Contains the `any` the `Object.entries` overload produces for a bare object. */
function entriesOf(value: object): [string, unknown][] {
  return Object.entries(value);
}

const paths = Object.entries(spec.paths);

/** Collection GETs — what there is to sample and to audit as a list. */
export const listResources: string[] = paths
  .filter(([path, operations]) => "get" in operations && !path.includes("{"))
  .map(([path]) => path.slice(1))
  .sort();

/**
 * Item GETs — a path supporting `get` with exactly one `{id}` segment. Sampling
 * these is what keeps a schema authored from a list fixture alone from being
 * mistaken for the item endpoint's contract.
 */
export const itemResources: string[] = paths
  .filter(
    ([path, operations]) =>
      "get" in operations && /^\/[a-z_]+\/\{[^}]+\}$/.test(path),
  )
  .map(([path]) => path.split("/")[1] ?? "")
  .filter((resource) => resource !== "")
  .sort();

/**
 * Resources the document says support create and delete-by-id, so the audit
 * could drive a full lifecycle: a mutation case may only run if it can delete
 * what it creates.
 */
export const lifecycleResources: string[] = listResources.filter(
  (resource) =>
    paths.some(
      ([path, operations]) => path === `/${resource}` && "post" in operations,
    ) &&
    paths.some(
      ([path, operations]) =>
        path.startsWith(`/${resource}/{`) && "delete" in operations,
    ),
);

/** `custom_user_properties` → `CustomUserProperty`. */
function componentName(resource: string): string {
  return resource
    .replace(/ies$/, "y")
    .replace(/s$/, "")
    .replace(/(^|_)(.)/g, (_match, _separator, letter: string) =>
      letter.toUpperCase(),
    );
}

/** The document misspells this one; the resource is `event_attendances`. */
const componentAliases: Record<string, string | undefined> = {
  event_attendances: "EventAttendace",
};

const componentsByName: Record<string, unknown> = spec.components.schemas;

/**
 * The document's entity schema for a resource, or undefined. Matching by name is
 * admissible here only because `scripts/draft.ts` names the source of every
 * draft, so a miss prints against the resource instead of reading as "nothing to
 * draft". It describes one element, never the list envelope.
 */
export function specComponent(resource: string): unknown {
  return componentsByName[
    componentAliases[resource] ?? componentName(resource)
  ];
}

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
  const record = Object.fromEntries(entriesOf(node));
  const members = record.enum;
  // An enum declared on a bare component (`ScopeType`) carries no property name,
  // so there is no captured key it could ever exempt.
  if (key && Array.isArray(members)) {
    const literals = members.filter(
      (member): member is string => typeof member === "string",
    );
    if (literals.length) found.set(key, new Set(literals));
  }
  const properties = record.properties;
  if (properties !== null && typeof properties === "object")
    for (const [name, value] of entriesOf(properties)) walk(value, name, found);
  for (const [name, value] of entriesOf(record))
    if (name !== "properties") walk(value, key, found);
}

function collectEnums(document: unknown): Map<string, Set<string>> {
  const found = new Map<string, Set<string>>();
  walk(document, "", found);
  return found;
}

/**
 * Every property name the document declares as a closed set of strings, with its
 * members. `scripts/scrub.ts` is the consumer: a captured string survives only
 * when its key appears here and its value is one of these members.
 */
export const declaredEnums: ReadonlyMap<
  string,
  ReadonlySet<string>
> = collectEnums(spec);
