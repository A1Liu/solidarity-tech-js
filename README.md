# solidarity-tech-api

AI-slop generated JS/TS SDK for Solidarity Tech API. Use at your own risk.

## Typescript Usage

```typescript
import { createClient } from 'solidarity-tech-js';

const client = createClient({ apiKey: "<YOUR API KEY>" })
await client.listEvents({ _limit: 100, _offset: 0 })

// All examples from docs
```
