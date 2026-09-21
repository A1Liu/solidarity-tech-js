import { apiDelete, apiPost } from "../client";
import type { ApiResult, ClientConfig } from "../client";
import { z } from "zod";
import type { Address } from "../schemas";

/**
 * Body for POST /users. The API requires at least one of `phone_number` or
 * `email` to identify the user.
 */
export interface StUserCreate {
  phone_number?: string | null;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  preferred_language?: string;
  second_language?: string | null;
  chapter_id?: number | null;
  custom_user_properties?: Record<string, string> | null;
  address?: Address | null;
  sms_permission?: boolean | null;
  call_permission?: boolean | null;
  email_permission?: boolean | null;
  /**
   * When true, the API validates that `phone_number` can receive SMS and
   * rejects the request if it cannot.
   */
  phone_number_textable_validation?: boolean | null;
  /** External identifier used to match the request to an existing user. */
  lookup_key?: string | null;
}

export const StPostUserResultSchema = z.object({
  id: z.number(),
  message: z.string(),
});

export type StUserCreateResponse = z.infer<typeof StPostUserResultSchema>;

/** POST /users — Creates or updates a user. */
export function createUser(
  config: ClientConfig,
  body: StUserCreate,
): Promise<ApiResult<StUserCreateResponse>> {
  return apiPost(config, "/users", { body, schema: StPostUserResultSchema });
}

/**
 * The 200 body of DELETE /users/{id}, from the live reference
 * (https://www.solidarity.tech/reference/delete_users-id); the vendored
 * document does not declare the operation at all. Not yet checked against a
 * live response.
 *
 * `id` is only present when the user was kept: a sub-organization API key
 * removes the user's in-scope chapter memberships instead of deleting them,
 * and answers with the id of the user it left in place.
 */
export const StDeleteUserResultSchema = z.object({
  message: z.string(),
  id: z.number().int().nullish(),
});

export type StDeleteUserResult = z.infer<typeof StDeleteUserResultSchema>;

/** DELETE /users/{id} — Deletes a user. Answers 404 when there is none. */
export function deleteUser(
  config: ClientConfig,
  id: number,
): Promise<ApiResult<StDeleteUserResult>> {
  return apiDelete(config, `/users/${id}`, {
    schema: StDeleteUserResultSchema,
  });
}

/** Every user endpoint function, for spreading into `Endpoints`. */
export const userEndpoints = {
  createUser,
  deleteUser,
} as const;

/** Every user zod schema, for spreading into `Schemas`. */
export const userSchemas = {
  StPostUserResultSchema,
  StDeleteUserResultSchema,
} as const;
