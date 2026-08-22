import { z } from "zod";
import { apiGet, apiPost, apiPut, apiDelete } from "../client";
import type { ApiResult, ClientConfig } from "../client";
import { itemResponse, listResponse, mutationResponse } from "../schemas";
import type { ListParams } from "../schemas";

/* ------------------------------------------------------------------ *
 * Schemas
 * ------------------------------------------------------------------ */

/**
 * NOTE: the test account holds three assignments, all pointing at the same
 * user, so nullability here comes from the document's entity schema rather than
 * from the sample — it declares `agent_user_id` and `is_active` nullable where
 * every captured row carries a value.
 */
export const StAgentAssignment = z.object({
  // Absent from the document's entity schema, present in every captured row.
  id: z.number().int(),
  user_id: z.number().int(),
  agent_user_id: z.number().int().nullable(),
  is_active: z.boolean().nullable(),
  // Absent from the document's entity schema, present in every captured row.
  created_at: z.string(),
});

export const StAgentAssignmentsResponse = listResponse(StAgentAssignment);
export const StAgentAssignmentResponse = itemResponse(StAgentAssignment);
export const StAgentAssignmentMutationResponse =
  mutationResponse(StAgentAssignment);

export type StAgentAssignment = z.infer<typeof StAgentAssignment>;
export type StAgentAssignmentsResponse = z.infer<
  typeof StAgentAssignmentsResponse
>;
export type StAgentAssignmentResponse = z.infer<
  typeof StAgentAssignmentResponse
>;
export type StAgentAssignmentMutationResponse = z.infer<
  typeof StAgentAssignmentMutationResponse
>;

/* ------------------------------------------------------------------ *
 * Requests
 * ------------------------------------------------------------------ */

export interface ListAgentAssignmentsParams extends ListParams {
  user_id?: number;
  agent_user_id?: number;
}

export interface AgentAssignmentCreate {
  user_id: number;
  agent_user_id: number | null;
  is_active?: boolean | null;
}

export interface AgentAssignmentUpdate {
  user_id?: number;
  agent_user_id?: number | null;
  is_active?: boolean | null;
}

/* ------------------------------------------------------------------ *
 * Endpoints
 * ------------------------------------------------------------------ */

/** GET /agent_assignments — Lists agent assignments. */
export function listAgentAssignments(
  config: ClientConfig,
  params: ListAgentAssignmentsParams = {},
): Promise<ApiResult<StAgentAssignmentsResponse>> {
  return apiGet(config, "/agent_assignments", {
    query: { ...params },
    schema: StAgentAssignmentsResponse,
  });
}

/** GET /agent_assignments/{id} — Shows a single agent assignment. */
export function getAgentAssignment(
  config: ClientConfig,
  id: number,
): Promise<ApiResult<StAgentAssignmentResponse>> {
  return apiGet(config, `/agent_assignments/${id}`, {
    schema: StAgentAssignmentResponse,
  });
}

/** POST /agent_assignments — Creates an agent assignment. */
export function createAgentAssignment(
  config: ClientConfig,
  body: AgentAssignmentCreate,
): Promise<ApiResult<StAgentAssignmentMutationResponse>> {
  return apiPost(config, "/agent_assignments", {
    body,
    schema: StAgentAssignmentMutationResponse,
  });
}

/** PUT /agent_assignments/{id} — Updates an agent assignment. */
export function updateAgentAssignment(
  config: ClientConfig,
  id: number,
  body: AgentAssignmentUpdate,
): Promise<ApiResult<StAgentAssignmentMutationResponse>> {
  return apiPut(config, `/agent_assignments/${id}`, {
    body,
    schema: StAgentAssignmentMutationResponse,
  });
}

/**
 * DELETE /agent_assignments/{id} — documented, but NOT IMPLEMENTED upstream.
 *
 * The document declares this operation; the live API answers 404 for a row that
 * `GET /agent_assignments/{id}` returns. It is kept so the surface matches the
 * document and so the failure is a returned `ApiResult`, not a missing function
 * — but it cannot currently remove a row, and an assignment is retired by
 * setting `is_active: false` instead. Because of this, `scripts/audit.ts` runs
 * no lifecycle case here: it could create a row it cannot delete.
 */
export function deleteAgentAssignment(
  config: ClientConfig,
  id: number,
): Promise<ApiResult<unknown>> {
  return apiDelete(config, `/agent_assignments/${id}`);
}
