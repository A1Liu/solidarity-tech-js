import type { ClientConfig } from "./client";
import * as coreEndpoints from "./endpoints-unverified-stub";
import * as eventEndpoints from "./endpoints/events";

export * from "./client";
export * from "./schemas";

export const Endpoints = {
  ...coreEndpoints,
  ...eventEndpoints,
} as const;

type EndpointFn = (config: ClientConfig, ...args: never[]) => unknown;

type Bound<F> = F extends (config: ClientConfig, ...args: infer A) => infer R
  ? (...args: A) => R
  : never;

/** All endpoint functions with their leading `ClientConfig` argument bound. */
export type SolidarityClient = {
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
export function createClient(config: ClientConfig): SolidarityClient {
  const bound: Record<string, unknown> = {};
  for (const [name, fn] of Object.entries(Endpoints)) {
    bound[name] = (...args: unknown[]) =>
      (fn as EndpointFn)(config, ...(args as never[]));
  }
  return bound as SolidarityClient;
}

export default createClient;
