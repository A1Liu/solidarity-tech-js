# solidarity-tech-api

A typed JS/TS client for the [Solidarity Tech](https://solidarity.tech) API
(`https://api.solidarity.tech/v1`).

Much of this SDK started life generated from Solidarity Tech's OpenAPI document,
which is stale and wrong in both directions — it declares operations the API
answers 404 for, and omits ones it serves. **Live responses are the source of
truth here**; the document is a source of leads to go check. Endpoints are
therefore split into **verified** and **provisional** (see
[Endpoint status](#endpoint-status)). Use provisional endpoints at your own risk.

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

| Command                       | What it does                                 | Network     |
| ----------------------------- | -------------------------------------------- | ----------- |
| `bun run vitest`              | Unit tests and fixture validation            | no          |
| `bun run compile`             | Build `dist/`                                | no          |
| `bun run format`              | Prettier                                     | no          |
| `bun run draft`               | Regenerate Zod drafts from committed data    | no          |
| `bun run probe [resource…]`   | Ask the API which resources exist            | read-only   |
| `bun run capture [resource…]` | Sample live list responses into fixtures     | read-only   |
| `bun run scripts/audit.ts`    | Live schema-coverage check                   | **mutates** |
| `bun run update`              | Refresh the vendored OpenAPI document (lead) | read-only   |

The audit creates and deletes rows. Point `API_KEY` at a throwaway account,
never production.

## Graduating a resource from provisional to verified

This is the core contribution loop: it turns one resource's `unknown` responses
into checked types.

The whole process is about **authority** — every source here is a real response,
and each decides exactly one thing. Nearly every mistake is a source used outside
its authority.

| Source                    | Decides                             | Never decides                        |
| ------------------------- | ----------------------------------- | ------------------------------------ |
| A probe (`probe`)         | whether the operation exists at all | anything about the shape             |
| A live sample (`capture`) | shape, key presence, string formats | which fields can be null             |
| Committed fixture         | what the shape _was_ — regression   | anything a small account cannot show |
| The audit's live run      | mutation and item envelopes         | —                                    |

The OpenAPI document is not on this list. It decides nothing, and no code reads
it — it is where candidate names come from, and nothing more.

**Nullability has no authority.** No source settles it: a sample can prove a
field _is_ sometimes null, but never that it cannot be. Where the sample is
silent, model defensively and say in a comment that you did.

### 1. Confirm the resource is real

```
bun run probe team_members
```

This asks the live API for `GET /team_members` and, if a row comes back, for
`GET /team_members/{id}`, then records both statuses in
`tests/data/inventory.json`. That file is the SDK's inventory: `capture`, `draft`
and the audit all walk it, so a resource that answers 404 never becomes work.

Run it with no arguments to re-check everything already in the manifest. Failures
stay in the file with their status — "asked, and it is not there" is worth
keeping, or the next person re-derives the same wrong endpoint from the same
document.

### 2. Sample the resource

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
survives. A string is kept verbatim only when **one of this SDK's own schemas**
declares its key as a closed set (`z.enum`, or a union of `z.literal`) and the
value is one of that set's members.

That ordering matters: a resource with no schema yet gets no exemptions, so its
first capture scrubs everything. If you later add a `z.enum` to its schema, the
committed fixture stops parsing in `tests/fixtures.ts` — its values were replaced
with stand-ins — and the fix is to re-capture. The failure is what tells you to.

Because formats survive scrubbing, **the fixture is authority on format**. This
is how we learned that `team_members.last_app_activity_at` is a plain
`YYYY-MM-DD` date, not the offset datetime the document declares.

**A missing fixture is the request to fetch it**, decided per file — so a
resource whose list fixture is already committed still gets its item fixture
captured. To replace a fixture that exists, delete it and re-run, or name the
resource: `bun run capture users` overwrites both of its fixtures.

Some fixtures back hand-written value assertions (`tests/data/events.json` backs
`tests/events.ts`), so overwrite those only when you mean to update the
assertions too.

Some resources return no rows on a small account and can never be captured. There
is no substitute material — leave the resource provisional rather than typing it
from a document, which is how a schema that rejects live data gets shipped.

### 3. Read what the sample leaves open

```
bun run draft
```

Each `tests/data/drafts/<resource>.ts` holds what the committed fixtures infer:

- `fixtureResponse` — from the list sample. Live truth, but a thin one: a column
  that is null in every row infers `z.null()`, and an always-empty array infers
  `z.array(z.any())`.
- `itemResponse` — from the `/{id}` sample, when there is one. A second contract,
  not a subset.

Every draft opens with a **What this sample does NOT decide** block — row count,
always-null fields, always-empty arrays, fields with a single distinct value.
Sample thinness is a property of the account rather than of the page size:
several resources hold one row that no `_limit` will widen. Nothing settles those
fields for you; close them with more evidence, or model them defensively and say
so in a comment.

Drafts are committed, value-free, and generated offline, so a live shape change
shows up as a diff in code review. A draft whose fixture is deleted is deleted
too — a draft that outlives its sample describes a shape nothing verified.

### 4. Write the endpoint module by hand

Create `endpoints/<resource>.ts`. **Do not paste a draft in unedited** — the
reconciliation is the work, and it is why this step is not automated. An
auto-merge would have taken the document's `.datetime()` for
`last_app_activity_at` and shipped a schema that rejects live data.

Build the element schema from the fixture, decide each undecided field
deliberately, then compose the envelope with the helpers in `schemas.ts`:

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

Comment what you could not verify. Where nullability was assumed rather than
observed, say so — the next person needs to know which parts of the schema are
evidence and which are inference.

If the resource has a genuinely closed set of string values, declare it as
`z.enum` here. That is also what tells the scrubber to keep those values in the
fixture, so re-capture after adding one.

### 5. Register the schemas

Add the list schema to `modeled` in `scripts/resource-schemas.ts`, and the item
schema to `modeledItems`. One line each arms both guards at once:
`tests/fixtures.ts` now fails the build if the schema drifts from the committed
fixture, and `scripts/audit.ts` now diffs it against a live response instead of
reporting "no schema yet".

### 6. Move the functions out of the stub

Delete the resource's section from `endpoints-unverified-stub.ts`, add the
functions to your module with real response schemas, and register the module in
`index.ts` (both the `Endpoints` spread and the `export type *` list).

### 7. Settle the mutation responses

Mutation response bodies are learned the only way they can be: by running one.
That is what the audit's mutation cases do — a create → show → update → delete
lifecycle, with the delete in a `finally`.

Add a case to `buildCases` in `scripts/audit.ts`, leaving `expectedCreate` and
`expectedUpdate` unset on the first run. The run reports the live shape as "no
schema yet", and you author the schema from that report.

**A case may only exist if it can delete what it creates.** Unlike reads, this
cannot be established by asking first: probing a `POST` risks leaving a row
behind, and a `DELETE` that works has destroyed the thing it was asking about.
So the case's own first run is the experiment — run it by itself, on a throwaway
account, and read the cleanup line. When the delete fails, remove the case,
record the resource in `undrivable` in `scripts/audit.ts` with the evidence, and
remove the row by hand. `agent_assignments` is there because a run orphaned a
row: its `DELETE /{id}` is documented, and answers 404.

### 8. Verify

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
- `scripts/resources.ts` — the resource inventory, read from
  `tests/data/inventory.json`. Nothing here is hand-maintained, and nothing here
  reads the OpenAPI document.
- `scripts/declared-enums.ts` — the closed sets this SDK's own schemas declare,
  which is what the scrubber lets survive a capture.
- `tests/data/` — `inventory.json` (what the live API answered when last asked),
  scrubbed fixtures, and generated drafts.
