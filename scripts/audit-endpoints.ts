/**
 * Live list read-coverage audit for the Solidarity Tech SDK.
 *
 * For every GET-list endpoint, reports whether its list read is list-verified —
 * backed by a Zod schema the live response parses green — or not, and why. The
 * list response exercises the element schema in one shot, so a green list is the
 * signal; show (GET-by-id) paths are not separately checked here (verified
 * recipe, rule B). This is the worklist for expanding type-safe coverage
 * (nycdsa/st-migration-scripts#2).
 *
 * Read-only: GET only, small page size, no mutations. Reports only pass/fail and
 * a short reason — never field values — so it exposes no personal data and writes
 * nothing to disk. Requires API_KEY (Bun loads it from .env).
 *
 *   bun run scripts/audit-endpoints.ts
 */
import { createClient } from "../index";
import type { ApiResult } from "../client";

const apiKey = process.env.API_KEY;
if (!apiKey) {
  console.error("Missing API_KEY environment variable (set it in .env).");
  process.exit(1);
}

const client = createClient({ apiKey });
const listParams = { _limit: 3 };

/** A deferred call to a list endpoint on the live API. */
type ListRequest = () => Promise<ApiResult<unknown>>;

interface ListEndpoint {
  resource: string;
  /** Whether the endpoint hands a Zod schema to `apiGet`, so a 2xx is validated. */
  hasSchema: boolean;
  fetchList: ListRequest;
}

const endpoints: ListEndpoint[] = [
  {
    resource: "events",
    hasSchema: true,
    fetchList: () => client.listEvents(listParams),
  },
  {
    resource: "users",
    hasSchema: true,
    fetchList: () => client.listUsers(listParams),
  },
  {
    resource: "activities",
    hasSchema: true,
    fetchList: () => client.listActivities(listParams),
  },
  {
    resource: "calls",
    hasSchema: true,
    fetchList: () => client.listCalls(listParams),
  },
  {
    resource: "texts",
    hasSchema: true,
    fetchList: () => client.listTexts(listParams),
  },
  {
    resource: "chapters",
    hasSchema: true,
    fetchList: () => client.listChapters(listParams),
  },
  {
    resource: "custom_user_properties",
    hasSchema: true,
    fetchList: () => client.listCustomUserProperties(listParams),
  },
  {
    resource: "event_sessions",
    hasSchema: false,
    fetchList: () => client.listEventSessions(listParams),
  },
  {
    resource: "event_attendances",
    hasSchema: false,
    fetchList: () => client.listEventAttendances(listParams),
  },
  {
    resource: "agent_assignments",
    hasSchema: false,
    fetchList: () => client.listAgentAssignments(listParams),
  },
  {
    resource: "organizations",
    hasSchema: false,
    fetchList: () => client.listOrganizations(listParams),
  },
  {
    resource: "team_members",
    hasSchema: false,
    fetchList: () => client.listTeamMembers(listParams),
  },
  {
    resource: "user_lists",
    hasSchema: false,
    fetchList: () => client.listUserLists(listParams),
  },
  {
    resource: "pages",
    hasSchema: false,
    fetchList: () => client.listPages(listParams),
  },
  {
    resource: "phonebanks",
    hasSchema: false,
    fetchList: () => client.listPhonebanks(listParams),
  },
  {
    resource: "textbanks",
    hasSchema: false,
    fetchList: () => client.listTextbanks(listParams),
  },
  {
    resource: "scheduled_calls",
    hasSchema: false,
    fetchList: () => client.listScheduledCalls(listParams),
  },
  {
    resource: "scheduled_tasks",
    hasSchema: false,
    fetchList: () => client.listScheduledTasks(listParams),
  },
  {
    resource: "text_blasts",
    hasSchema: false,
    fetchList: () => client.listTextBlasts(listParams),
  },
  {
    resource: "email_blasts",
    hasSchema: false,
    fetchList: () => client.listEmailBlasts(listParams),
  },
  {
    resource: "text_templates",
    hasSchema: false,
    fetchList: () => client.listTextTemplates(listParams),
  },
  {
    resource: "task_agents",
    hasSchema: false,
    fetchList: () => client.listTaskAgents(listParams),
  },
  {
    resource: "task_assignments",
    hasSchema: false,
    fetchList: () => client.listTaskAssignments(listParams),
  },
  {
    resource: "chapter_phone_numbers",
    hasSchema: false,
    fetchList: () => client.listChapterPhoneNumbers(listParams),
  },
];

interface EndpointCoverage {
  resource: string;
  verified: boolean;
  reason: string;
}

async function checkCoverage(
  endpoint: ListEndpoint,
): Promise<EndpointCoverage> {
  const { resource } = endpoint;
  if (!endpoint.hasSchema)
    return { resource, verified: false, reason: "no schema yet" };

  let response: ApiResult<unknown>;
  try {
    response = await endpoint.fetchList();
  } catch (cause) {
    return {
      resource,
      verified: false,
      reason: cause instanceof Error ? cause.message : String(cause),
    };
  }

  if (response.ok) return { resource, verified: true, reason: "" };
  if (response.error.type === "validation") {
    return {
      resource,
      verified: false,
      reason: "list schema no longer matches the live response",
    };
  }
  return { resource, verified: false, reason: response.error.message };
}

async function runAudit(): Promise<void> {
  const results = await Promise.all(endpoints.map(checkCoverage));
  const verified = results.filter((result) => result.verified);
  const unverified = results.filter((result) => !result.verified);

  console.log(`\nList-verified (${verified.length}/${results.length})`);
  for (const { resource } of verified) console.log(`  ✓ ${resource}`);

  console.log(`\nNot list-verified (${unverified.length}/${results.length})`);
  for (const { resource, reason } of unverified)
    console.log(`  ✗ ${resource} — ${reason}`);
  console.log("");
}

await runAudit();
