# solidarity-tech-api

A typed JS/TS client for the [Solidarity Tech](https://solidarity.tech) API
(`https://api.solidarity.tech/v1`).

Much of this SDK was generated from Solidarity Tech's OpenAPI document, which is
stale and incomplete in places. Endpoints are therefore split into **verified**
and **provisional** (see [Endpoint status](#endpoint-status)). Use provisional
endpoints at your own risk.

## Usage

```typescript
import { createClient } from "@a1liu/solidarity-tech-api";

const client = createClient({ apiKey: "<YOUR API KEY>" });

const res = await client.listEvents({ _limit: 100, _offset: 0 });
if (res.ok) {
  for (const event of res.data.data) console.log(event.title);
} else {
  console.error(res.error.type, res.error.message);
}
```

Calls never throw for HTTP, network, or validation failures — every endpoint
resolves to an `ApiResult<T>`, which is `{ ok: true, data }` or
`{ ok: false, error }`. Successful bodies are validated with Zod before they are
returned, so a `data` you receive matches its declared type.

`createClient` binds your configuration into every endpoint. The underlying
functions are also exported directly, each taking `ClientConfig` first:

```typescript
import { listEvents } from "@a1liu/solidarity-tech-api";

await listEvents({ apiKey: "<YOUR API KEY>" }, { _limit: 100 });
```

## Endpoint status

|               | Verified                       | Provisional                    |
| ------------- | ------------------------------ | ------------------------------ |
| Lives in      | `endpoints/*.ts`               | `endpoints-unverified-stub.ts` |
| Response type | a real Zod schema              | `unknown`                      |
| Backed by     | a live sample + a passing test | the OpenAPI document only      |

Both are exported the same way; the difference is how much the types are worth.
A provisional endpoint's path and parameters come from the document, and the
document is known to be wrong in places — `DELETE /agent_assignments/{id}` is
declared but answers 404, for example. Verified endpoints have been checked
against live responses.

Today: **8 verified resource modules / 21 endpoint functions**, and **47
provisional functions** still in the stub.

## Development

```
bun install
cp .env.example .env      # add API_KEY for the live scripts
```

| Command                       | What it does                              | Network     |
| ----------------------------- | ----------------------------------------- | ----------- |
| `bun run vitest`              | Unit tests and fixture validation         | no          |
| `bun run compile`             | Build `dist/`                             | no          |
| `bun run format`              | Prettier                                  | no          |
| `bun run draft`               | Regenerate Zod drafts from committed data | no          |
| `bun run capture [resource…]` | Sample live list responses into fixtures  | read-only   |
| `bun run scripts/audit.ts`    | Live schema-coverage check                | **mutates** |
| `bun run update`              | Refresh the vendored OpenAPI document     | read-only   |

The audit creates and deletes rows. Point `API_KEY` at a throwaway account,
never production.

## Graduating a resource from provisional to verified

This is the core contribution loop: it turns one resource's `unknown` responses
into checked types.

The whole process is about **authority** — four sources describe a resource, and
each one decides exactly one thing. Nearly every mistake is a source used
outside its authority.

| Source               | Decides                             | Never decides                         |
| -------------------- | ----------------------------------- | ------------------------------------- |
| Live response        | shape, key presence, string formats | which fields can be null              |
| Committed fixture    | what the shape _was_ — regression   | anything a small account cannot show  |
| OpenAPI document     | nullability, closed sets (enums)    | whether the operation exists or works |
| The audit's live run | mutation and item envelopes         | —                                     |

### 1. Sample the resource

```
bun run capture team_members
```

This writes `tests/data/<resource>.json`, and `<resource>.item.json` as well
when the resource has a `/{id}` GET — an item response is a different shape, not
a subset, and `GET /organizations/{id}` returns `parent` and `children` that the
collection omits entirely.

**Personal data is removed in memory before anything touches disk**, so the
guarantee does not depend on a `.gitignore` entry being right. The scrubber
replaces every string with a generated stand-in of the same shape, so an ISO
date stays an ISO date and an email stays email-shaped, but no real value
survives. A string is kept verbatim only when the document declares its key as a
closed set and the value is one of that set's members.

Because formats survive scrubbing, **the fixture is authority on format**. This
is how we learned that `team_members.last_app_activity_at` is a plain
`YYYY-MM-DD` date, not the offset datetime the document declares.

With no arguments, `capture` samples every resource that has no fixture yet;
naming resources refreshes those instead — which overwrites them. Some fixtures
back hand-written value assertions (`tests/data/events.json` backs
`tests/events.ts`), so refresh those only when you mean to update the assertions
too.

Some resources return no rows on a small account and can never be captured. For
those the document is the only material you will get, and the resulting schema
stays genuinely unverified — say so in a comment.

### 2. Read what the sample leaves open

```
bun run draft
```

Each `tests/data/drafts/<resource>.ts` holds two schemas, deliberately not
merged:

- `fixtureResponse` — inferred from your sample. Live truth, but a thin one: a
  column that is null in every row infers `z.null()`, and an always-empty array
  infers `z.array(z.any())`.
- `specElement` — from the document's entity schema. Stale and often missing
  fields, but it declares the nullability and enums no sample can show.

Every draft opens with a **What this sample does NOT decide** block — row count,
always-null fields, always-empty arrays, fields with a single distinct value.
Those are the fields the document has to settle. Sample thinness is a property
of the account rather than of the page size: several resources hold one row that
no `_limit` will widen.

Drafts are committed, value-free, and generated offline, so a live shape change
shows up as a diff in code review.

### 3. Write the endpoint module by hand

Create `endpoints/<resource>.ts`. **Do not paste a draft in unedited** — the
reconciliation is the work, and it is why this step is not automated. An
auto-merge would have taken the document's `.datetime()` for
`last_app_activity_at` and shipped a schema that rejects live data.

Build the element schema from the fixture, settle each undecided field from
`specElement`, then compose the envelope with the helpers in `schemas.ts`:

```typescript
export const StThingsResponse = listResponse(StThing); // GET /things
export const StThingResponse = itemResponse(StThing); // GET /things/{id}
export const StThingMutationResponse = mutationResponse(StThing); // POST, PUT
```

Those three are the only envelopes the API uses; note that a mutation carries no
pagination `meta`.

Conventions: schemas are `St`-prefixed consts with a same-named inferred type,
request bodies are plain interfaces, and every function takes `ClientConfig`
first and returns `ApiResult<T>`.

Comment what you could not verify. Where nullability came from the document
rather than the sample, say so — the next person needs to know which parts of
the schema are evidence and which are inference.

### 4. Register the schemas

Add the list schema to `modeled` in `scripts/resource-schemas.ts`, and the item
schema to `modeledItems`. One line each arms both guards at once:
`tests/fixtures.ts` now fails the build if the schema drifts from the committed
fixture, and `scripts/audit.ts` now diffs it against a live response instead of
reporting "no schema yet".

### 5. Move the functions out of the stub

Delete the resource's section from `endpoints-unverified-stub.ts`, add the
functions to your module with real response schemas, and register the module in
`index.ts` (both the `Endpoints` spread and the `export type *` list).

### 6. Settle the mutation responses

The document describes **no mutation response bodies at all**. The only way to
learn them is to run one, which is what the audit's mutation cases do — a
create → show → update → delete lifecycle, with the delete in a `finally`.

Add a case to `buildCases` in `scripts/audit.ts`, leaving `expectedCreate` and
`expectedUpdate` unset on the first run. The run reports the live shape as "no
schema yet", and you author the schema from that report.

**A case may only exist if it can delete what it creates.** `lifecycleResources`
lists what the _document_ says supports create-and-delete, and the document
lies: adding an `agent_assignments` case orphaned a row, because its documented
`DELETE` answers 404. Treat a new case's first run as the probe — run it by
itself, on a throwaway account, and read the cleanup line. When the delete
fails, remove the case, record the resource in `undrivable` in
`scripts/audit.ts` with the evidence, and remove the row by hand.

### 7. Verify

```
bunx tsc --noEmit
bun run vitest
bun run scripts/audit.ts   # mutates
```

The audit should list your resource under covered list endpoints, plus
`<resource> GET/{id}` when an item schema is modeled, with no cleanup warning.

## Architecture

- `client.ts` — auth, URL and query building, transport, Zod validation, and
  `ApiResult` semantics.
- `endpoints/*.ts` — verified endpoints, grouped by resource.
- `endpoints-unverified-stub.ts` — provisional endpoints.
- `schemas.ts` — shared schemas (`paginationMeta`, `ListParams`, …), the
  `listResponse` / `itemResponse` / `mutationResponse` envelope helpers, and
  public types.
- `index.ts` — public exports and `createClient`.
- `scripts/resources.ts` — everything derived from the OpenAPI document: the
  resource inventory, entity schemas, declared enums, lifecycle candidates.
  Nothing here is hand-maintained.
- `tests/data/` — scrubbed fixtures and generated drafts.
