/**
 * The schema each list and item response is expected to satisfy.
 *
 * Shared by the coverage audit and the committed-fixture test so both agree on
 * what is modeled. The inventory itself comes from `./resources`; a resource
 * absent from `modeled` has no schema yet and reads as `UNCOVERED` — still worth
 * capturing, because the fixture is the material a schema gets authored from.
 *
 * This map is deliberately explicit. Matching schema exports to resources by
 * name needs two naming conventions and fails silently, reporting a wiring typo
 * as "no schema yet"; one line per authored schema does not.
 */
import type { ZodType } from "zod";
import { UNCOVERED } from "./schema-coverage";
import { listResources } from "./resources";
import {
  activitiesResponse,
  callsResponse,
  chaptersResponse,
  customUserPropertiesResponse,
  textsResponse,
  usersResponse,
} from "../schemas";
import { StEventsResponse } from "../endpoints/events";
import {
  StEventSessionsResponse,
  StEventSessionResponse,
} from "../endpoints/event_sessions";
import { StListEventRsvpsResponseSchema } from "../endpoints/rsvps";
import {
  StAgentAssignmentsResponse,
  StAgentAssignmentResponse,
} from "../endpoints/agent_assignments";
import {
  StOrganizationsResponse,
  StOrganizationResponse,
} from "../endpoints/organizations";
import { StTeamMembersResponse } from "../endpoints/team_members";

export interface ListEndpoint {
  resource: string;
  expected: ZodType;
  /** The `/{id}` schema, when the resource has an item GET that is modeled. */
  item?: ZodType;
}

const modeled: Record<string, ZodType> = {
  activities: activitiesResponse,
  agent_assignments: StAgentAssignmentsResponse,
  calls: callsResponse,
  chapters: chaptersResponse,
  custom_user_properties: customUserPropertiesResponse,
  event_rsvps: StListEventRsvpsResponseSchema,
  event_sessions: StEventSessionsResponse,
  events: StEventsResponse,
  organizations: StOrganizationsResponse,
  team_members: StTeamMembersResponse,
  texts: textsResponse,
  users: usersResponse,
};

/**
 * The schema each item GET is expected to satisfy. Separate from `modeled`
 * because an item response is a different shape, not a subset: it may carry
 * relations the collection omits.
 */
const modeledItems: Record<string, ZodType> = {
  agent_assignments: StAgentAssignmentResponse,
  event_sessions: StEventSessionResponse,
  organizations: StOrganizationResponse,
};

export const listEndpoints: ListEndpoint[] = listResources.map((resource) => ({
  resource,
  expected: modeled[resource] ?? UNCOVERED,
  item: modeledItems[resource],
}));
