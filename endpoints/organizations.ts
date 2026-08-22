import { z } from "zod";
import { apiGet } from "../client";
import type { ApiResult, ClientConfig } from "../client";
import { itemResponse, listResponse } from "../schemas";
import type { ListParams } from "../schemas";

/* ------------------------------------------------------------------ *
 * Schemas
 * ------------------------------------------------------------------ */

/** One entry in an organization's configurable assessment vocabulary. */
export const StAssessmentStatus = z.object({
  // `key` and `description` are empty strings in part of the captured sample,
  // so they are present-but-blank rather than nullable.
  key: z.string(),
  color: z.string(),
  label: z.string(),
  description: z.string(),
});

/**
 * NOTE: the API key is scoped to a single organization, so the sample is one
 * row. Nullability of `image_url` and `parent_organization_id` comes from the
 * document's entity schema; the nested `parent` confirmed a null
 * `parent_organization_id` live.
 */
export const StOrganization = z.object({
  // Absent from the document's entity schema, present in every captured row.
  id: z.number().int(),
  name: z.string(),
  image_url: z.string().nullable(),
  parent_organization_id: z.number().int().nullable(),
  default_language: z.string(),
  supported_languages: z.array(z.string()),
  // Absent from the document's entity schema; the list and item responses both
  // carry it.
  assessment_statuses: z.array(StAssessmentStatus),
});

/**
 * The item GET returns everything the list element has plus its immediate
 * relatives, which the collection GET omits entirely. `parent` is null for a
 * root organization — inferred, since the key cannot read the account's root.
 */
export const StOrganizationDetail = StOrganization.extend({
  parent: StOrganization.nullable(),
  children: z.array(StOrganization),
});

export const StOrganizationsResponse = listResponse(StOrganization);
export const StOrganizationResponse = itemResponse(StOrganizationDetail);

export type StAssessmentStatus = z.infer<typeof StAssessmentStatus>;
export type StOrganization = z.infer<typeof StOrganization>;
export type StOrganizationDetail = z.infer<typeof StOrganizationDetail>;
export type StOrganizationsResponse = z.infer<typeof StOrganizationsResponse>;
export type StOrganizationResponse = z.infer<typeof StOrganizationResponse>;

/* ------------------------------------------------------------------ *
 * Endpoints
 * ------------------------------------------------------------------ */

/** GET /organizations — Lists organizations. */
export function listOrganizations(
  config: ClientConfig,
  params: ListParams = {},
): Promise<ApiResult<StOrganizationsResponse>> {
  return apiGet(config, "/organizations", {
    query: { ...params },
    schema: StOrganizationsResponse,
  });
}

/** GET /organizations/{id} — Shows a single organization with its relatives. */
export function getOrganization(
  config: ClientConfig,
  id: number,
): Promise<ApiResult<StOrganizationResponse>> {
  return apiGet(config, `/organizations/${id}`, {
    schema: StOrganizationResponse,
  });
}
