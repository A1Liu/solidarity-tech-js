# CLAUDE.md

Notes for Claude instances working in this repo.

## Public API surface: `index.ts` and `types.ts`

The package ships two entry points, both built from source at the repo root into
`dist/` by `bun run compile`:

| Entry point                        | Source     | Contains                                                                                          |
| ---------------------------------- | ---------- | ------------------------------------------------------------------------------------------------- |
| `@a1liu/solidarity-tech-api`       | `index.ts` | Everything: `createClient`, `Endpoints`, `Schemas`, every schema and endpoint by name, and all types |
| `@a1liu/solidarity-tech-api/types` | `types.ts` | Types only (`export type *`) — a zero-runtime-cost import for consumers that just need the shapes |

### Adding or changing a module

Every endpoint module groups its own exports into two objects at the bottom of
the file — an `*Endpoints` object of endpoint functions and a `*Schemas` object
of zod schemas — and `index.ts` spreads those into the package-level
`Endpoints` and `Schemas`. Schemas must stay out of `Endpoints`: `createClient`
binds every value in `Endpoints` as if it were a function, so a schema in there
becomes a property that throws `TypeError: fn is not a function` when called.

When you add, rename, or delete a module, update **all five** places:

1. The module's own `*Endpoints` / `*Schemas` grouping objects.
2. `index.ts` — the `import { ... }` line at the top.
3. `index.ts` — the spreads in `Endpoints` **and** `Schemas`.
4. `index.ts` — the `export * from` line at the bottom.
5. `types.ts` — the matching `export type * from` line.

When you add a single endpoint or schema to an existing module, only step 1
applies — the spreads pick it up automatically.

`tests/exports.ts` guards all of this: it asserts every exported function and
schema in each module appears in that module's group, that both groups reach
the package-level objects, that `Endpoints` holds only functions, that
`Schemas` holds only zod schemas, and that the two are disjoint. If you add a
module, add it to the `MODULES` list in that file too.

These lists have silently drifted before: `users`, `user_actions`, and `rsvps`
were spread into `Endpoints` but never re-exported, so `StUserCreate`,
`StCreateUserAction`, and `StEventRsvp` were unreachable from the package root
even though they were exported from their own modules. That is what
`tests/exports.ts` now exists to catch. The one thing it cannot see is
`types.ts`, which is types-only and has no runtime surface — check that list by
eye.

`index.ts` uses `export *` (values _and_ types); `types.ts` uses
`export type *`. Do not make `index.ts` re-export `./types` to dedupe the two
lists — `index.ts` already star-exports `./client` and `./schemas`, so the
names would be exported twice, and TypeScript silently drops ambiguous star
exports rather than erroring.

## Export every schema

**Every zod schema that represents an API entity or response must be
`export const`, not a bare `const`.** Exporting only the inferred type is not
enough: consumers need the schema itself to parse, validate, `.extend()`, or
compose responses.

Concretely, never write this:

```ts
const StFooSchema = z.object({ ... });      // WRONG: schema is trapped in the module
export type StFoo = z.infer<typeof StFooSchema>;
```

Write this:

```ts
export const StFooSchema = z.object({ ... });
export type StFoo = z.infer<typeof StFooSchema>;
```

Because `index.ts` star-exports each endpoint module, an `export const` schema
reaches the package root by name automatically. Add it to the module's
`*Schemas` object as well so it also shows up in the `Schemas` registry;
`tests/exports.ts` fails if you forget.

The one exception is genuinely internal field-level helpers that exist only to
normalize a single property of a larger schema and have no exported type of
their own. `coordinatesField`, `componentsArray`, and `componentsField` in
`endpoints/events.ts` are the current examples; they stay private and are
named in lowerCamelCase to mark them as internal. Anything named `St*` is
public and must be exported.

## `package.json` exports map

Subpath keys must start with `./` (`"./types"`, not `"types"`). Node rejects
an `exports` object that mixes `.`-prefixed subpath keys with bare condition
names — `ERR_INVALID_PACKAGE_CONFIG` — and that error breaks _every_ entry
point, including the main one, not just the malformed subpath.

`typesVersions` mirrors the `/types` subpath for consumers still on
`moduleResolution: node10`, which ignores `exports` entirely. Keep the two in
sync when adding a subpath.

Since `"files": ["dist"]`, only `dist/` is published. `compile` runs
`rm -rf dist` first because `tsc` never removes orphaned output — a stale
`dist/endpoints.js` from a previous layout was shipping in the tarball.

To verify a packaging change for real, pack and install the tarball rather than
testing against the source tree — a symlinked repo lets `node10` resolution
fall back to root `.ts` files that are never published:

```sh
npm pack && tar xzf a1liu-solidarity-tech-api-*.tgz
# type-check a consumer against package/ under bundler, node16, and node10
```
