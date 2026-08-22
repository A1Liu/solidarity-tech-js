import { z } from "zod";
import { apiGet } from "../client";
import type { ApiResult, ClientConfig } from "../client";
import { listResponse } from "../schemas";
import type { ListParams } from "../schemas";

/* ------------------------------------------------------------------ *
 * Schemas
 * ------------------------------------------------------------------ */

/** `scope_type` is one of the five closed sets the document declares. */
export const StScopeType = z.enum(["Organization", "Chapter"]);

/** One role a team member holds, within one scope. */
export const StTeamMemberAssignment = z.object({
  id: z.number().int(),
  scope_id: z.number().int(),
  scope_type: StScopeType,
  role_id: z.number().int(),
  role_name: z.string(),
});

/**
 * NOTE: the test account holds one team member, so nullability of
 * `logged_in_as_id` and `logged_in_as_type` comes from the document's entity
 * schema rather than from the sample.
 */
export const StTeamMember = z.object({
  id: z.number().int(),
  user_id: z.number().int(),
  scope_id: z.number().int(),
  scope_type: StScopeType,
  // Absent from the document's entity schema, present in every captured row.
  role_id: z.number().int(),
  logged_in_as_id: z.number().int().nullable(),
  logged_in_as_type: z.string().nullable(),
  // A plain `YYYY-MM-DD` date, not the offset datetime the document declares.
  // The scrubber preserves date and timestamp formats, so the fixture is the
  // authority here and the document is wrong.
  last_app_activity_at: z.string().nullable(),
  created_at: z.string(),
  // Absent from the document's entity schema, present in every captured row.
  assignments: z.array(StTeamMemberAssignment),
});

export const StTeamMembersResponse = listResponse(StTeamMember);

export type StScopeType = z.infer<typeof StScopeType>;
export type StTeamMemberAssignment = z.infer<typeof StTeamMemberAssignment>;
export type StTeamMember = z.infer<typeof StTeamMember>;
export type StTeamMembersResponse = z.infer<typeof StTeamMembersResponse>;

/* ------------------------------------------------------------------ *
 * Endpoints
 * ------------------------------------------------------------------ */

/** GET /team_members — Lists team members. */
export function listTeamMembers(
  config: ClientConfig,
  params: ListParams = {},
): Promise<ApiResult<StTeamMembersResponse>> {
  return apiGet(config, "/team_members", {
    query: { ...params },
    schema: StTeamMembersResponse,
  });
}
