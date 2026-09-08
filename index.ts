import type { ClientConfig } from "./client";

// Each module groups its own exports into an `*Endpoints` object (endpoint
// functions) and a `*Schemas` object (zod schemas). Keep these three lists --
// the imports, `Endpoints`, and `Schemas` -- in sync with each other and with
// `types.ts`. See .claude/CLAUDE.md.
import { coreSchemas } from "./schemas";
import { coreEndpoints } from "./endpoints-unverified-stub";

import { eventEndpoints, eventSchemas } from "./endpoints/events";
import {
  eventSessionEndpoints,
  eventSessionSchemas,
} from "./endpoints/event_sessions";
import { userEndpoints, userSchemas } from "./endpoints/users";
import {
  userActionEndpoints,
  userActionSchemas,
} from "./endpoints/user_actions";
import { rsvpEndpoints, rsvpSchemas } from "./endpoints/rsvps";
import {
  agentAssignmentEndpoints,
  agentAssignmentSchemas,
} from "./endpoints/agent_assignments";
import {
  organizationEndpoints,
  organizationSchemas,
} from "./endpoints/organizations";
import {
  teamMemberEndpoints,
  teamMemberSchemas,
} from "./endpoints/team_members";

export * from "./client";
export * from "./schemas";

/**
 * Every endpoint function, keyed by name. Each takes a {@link ClientConfig} as
 * its first argument; {@link createClient} binds that away. Zod schemas are
 * kept out of this object -- they live in {@link Schemas}.
 */
export const Endpoints = {
  ...coreEndpoints,

  ...eventEndpoints,
  ...eventSessionEndpoints,
  ...userEndpoints,
  ...userActionEndpoints,
  ...rsvpEndpoints,
  ...agentAssignmentEndpoints,
  ...organizationEndpoints,
  ...teamMemberEndpoints,
} as const;

/** Every zod schema, keyed by name, for parsing and composing API payloads. */
export const Schemas = {
  ...coreSchemas,

  ...eventSchemas,
  ...eventSessionSchemas,
  ...userSchemas,
  ...userActionSchemas,
  ...rsvpSchemas,
  ...agentAssignmentSchemas,
  ...organizationSchemas,
  ...teamMemberSchemas,
} as const;

type EndpointFn = (config: ClientConfig, ...args: never[]) => unknown;

type Bound<F> = F extends (config: ClientConfig, ...args: infer A) => infer R
  ? (...args: A) => R
  : never;

/** All endpoint functions with their leading `ClientConfig` argument bound. */
export type StClient = {
  [K in keyof typeof Endpoints]: Bound<(typeof Endpoints)[K]>;
};

/**
 * Binds a {@link ClientConfig} to every endpoint so they can be called without
 * passing the config each time:
 *
 * ```ts
 * const client = createClient({ apiKey: "..." });
 * const res = await client.listUsers({ _limit: 50 });
 * ```
 */
export function createClient(config: ClientConfig): StClient {
  const bound: Record<string, unknown> = {};
  for (const [name, fn] of Object.entries(Endpoints)) {
    bound[name] = (...args: unknown[]) =>
      (fn as EndpointFn)(config, ...(args as never[]));
  }
  return bound as StClient;
}

export default createClient;

// Re-export every endpoint module wholesale: zod schemas, the types inferred
// from them, and the unbound endpoint functions. Keep this list in sync with
// the imports above and with `types.ts` -- see .claude/CLAUDE.md.
export * from "./endpoints-unverified-stub";
export * from "./endpoints/events";
export * from "./endpoints/event_sessions";
export * from "./endpoints/users";
export * from "./endpoints/user_actions";
export * from "./endpoints/rsvps";
export * from "./endpoints/agent_assignments";
export * from "./endpoints/organizations";
export * from "./endpoints/team_members";
