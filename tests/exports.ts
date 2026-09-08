import { describe, it, expect } from "vitest";

import { Endpoints, Schemas } from "../index";
import * as coreSchemasMod from "../schemas";
import * as stub from "../endpoints-unverified-stub";
import * as events from "../endpoints/events";
import * as eventSessions from "../endpoints/event_sessions";
import * as users from "../endpoints/users";
import * as userActions from "../endpoints/user_actions";
import * as rsvps from "../endpoints/rsvps";
import * as agentAssignments from "../endpoints/agent_assignments";
import * as organizations from "../endpoints/organizations";
import * as teamMembers from "../endpoints/team_members";

const isZodSchema = (value: unknown): boolean =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { safeParse?: unknown }).safeParse === "function";

/**
 * Every endpoint module and the names of the two objects it groups its exports
 * into. `endpointGroup`/`schemaGroup` are `null` when the module has none of
 * that kind.
 */
const MODULES: Array<{
  name: string;
  mod: Record<string, unknown>;
  endpointGroup: string | null;
  schemaGroup: string | null;
}> = [
  {
    name: "schemas",
    mod: coreSchemasMod,
    endpointGroup: null,
    schemaGroup: "coreSchemas",
  },
  {
    name: "endpoints-unverified-stub",
    mod: stub,
    endpointGroup: "coreEndpoints",
    schemaGroup: null,
  },
  {
    name: "events",
    mod: events,
    endpointGroup: "eventEndpoints",
    schemaGroup: "eventSchemas",
  },
  {
    name: "event_sessions",
    mod: eventSessions,
    endpointGroup: "eventSessionEndpoints",
    schemaGroup: "eventSessionSchemas",
  },
  {
    name: "users",
    mod: users,
    endpointGroup: "userEndpoints",
    schemaGroup: "userSchemas",
  },
  {
    name: "user_actions",
    mod: userActions,
    endpointGroup: "userActionEndpoints",
    schemaGroup: "userActionSchemas",
  },
  {
    name: "rsvps",
    mod: rsvps,
    endpointGroup: "rsvpEndpoints",
    schemaGroup: "rsvpSchemas",
  },
  {
    name: "agent_assignments",
    mod: agentAssignments,
    endpointGroup: "agentAssignmentEndpoints",
    schemaGroup: "agentAssignmentSchemas",
  },
  {
    name: "organizations",
    mod: organizations,
    endpointGroup: "organizationEndpoints",
    schemaGroup: "organizationSchemas",
  },
  {
    name: "team_members",
    mod: teamMembers,
    endpointGroup: "teamMemberEndpoints",
    schemaGroup: "teamMemberSchemas",
  },
];

// `schemas.ts` exports these response-shape helpers; they are generic factories,
// not endpoints, so they belong to neither group.
const HELPERS = new Set(["listResponse", "itemResponse", "mutationResponse"]);

describe("module export groups", () => {
  for (const { name, mod, endpointGroup, schemaGroup } of MODULES) {
    const groupNames = new Set([endpointGroup, schemaGroup].filter(Boolean));
    const endpoints = (endpointGroup ? mod[endpointGroup] : {}) as Record<
      string,
      unknown
    >;
    const schemas = (schemaGroup ? mod[schemaGroup] : {}) as Record<
      string,
      unknown
    >;

    it(`${name}: every exported schema is in its schema group`, () => {
      const missing = Object.entries(mod)
        .filter(([key, value]) => !groupNames.has(key) && isZodSchema(value))
        .map(([key]) => key)
        .filter((key) => !(key in schemas));
      expect(missing).toEqual([]);
    });

    it(`${name}: every exported endpoint is in its endpoint group`, () => {
      const missing = Object.entries(mod)
        .filter(
          ([key, value]) =>
            !groupNames.has(key) &&
            !HELPERS.has(key) &&
            typeof value === "function",
        )
        .map(([key]) => key)
        .filter((key) => !(key in endpoints));
      expect(missing).toEqual([]);
    });
  }
});

describe("Endpoints and Schemas", () => {
  it("Endpoints holds only functions -- no zod schemas leak in", () => {
    const leaked = Object.entries(Endpoints)
      .filter(([, value]) => typeof value !== "function")
      .map(([key]) => key);
    expect(leaked).toEqual([]);
  });

  it("Schemas holds only zod schemas", () => {
    const leaked = Object.entries(Schemas)
      .filter(([, value]) => !isZodSchema(value))
      .map(([key]) => key);
    expect(leaked).toEqual([]);
  });

  it("the two objects are disjoint", () => {
    const overlap = Object.keys(Endpoints).filter((key) => key in Schemas);
    expect(overlap).toEqual([]);
  });

  it("aggregates every module's group", () => {
    for (const { name, mod, endpointGroup, schemaGroup } of MODULES) {
      if (endpointGroup) {
        for (const key of Object.keys(mod[endpointGroup] as object)) {
          expect(
            Endpoints,
            `${name}.${key} missing from Endpoints`,
          ).toHaveProperty(key);
        }
      }
      if (schemaGroup) {
        for (const key of Object.keys(mod[schemaGroup] as object)) {
          expect(Schemas, `${name}.${key} missing from Schemas`).toHaveProperty(
            key,
          );
        }
      }
    }
  });
});
