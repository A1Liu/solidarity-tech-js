# solidarity-tech-api

This is simply the solidarity.tech [API generator](https://docs.solidarity.tech/reference/solidarity-tech-api) compiled to be published as an npm package
for use in environments that don't support folders well (or importing JSON),
such as [Windmill scripts](https://windmill.dev/).

It was last generated on 2026-06-11.

## Typescript Usage

```typescript
import sdk from 'solidarity-tech-js';

sdk.auth(apiKey) // not defined here

// All examples from docs
```

## Regeneration

This is just a note for myself on how to update this library when needed.
```bash
$ mv index.ts temp.ts
$ npx api install "@solidarity-tech/v1.0#<latest hash from https://docs.solidarity.tech/reference" --lang ts --yes
$ mv temp.ts index.ts
```

Then increment the version in package.json, and run:
```bash
$ bun run compile && npm publish
```

