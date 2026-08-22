import type { ClientConfig } from "./client";

import * as coreEndpoints from "./endpoints-unverified-stub";

import * as eventEndpoints from "./endpoints/events";
import * as eventSessionEndpoints from "./endpoints/event_sessions";
import * as userEndpoints from "./endpoints/users";
import * as userActionsEndpoints from "./endpoints/user_actions";
import * as rsvpEndpoints from "./endpoints/rsvps";
import * as agentAssignmentEndpoints from "./endpoints/agent_assignments";
import * as organizationEndpoints from "./endpoints/organizations";
import * as teamMemberEndpoints from "./endpoints/team_members";

export * from "./client";
export * from "./schemas";

export const Endpoints = {
  ...coreEndpoints,

  ...eventEndpoints,
  ...eventSessionEndpoints,
  ...userEndpoints,
  ...rsvpEndpoints,
  ...userActionsEndpoints,
  ...agentAssignmentEndpoints,
  ...organizationEndpoints,
  ...teamMemberEndpoints,
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

export type * from "./endpoints-unverified-stub";
export type * from "./endpoints/events";
export type * from "./endpoints/event_sessions";
export type * from "./endpoints/agent_assignments";
export type * from "./endpoints/organizations";
export type * from "./endpoints/team_members";
