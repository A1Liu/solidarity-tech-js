import { apiPost } from "../client";
import type { ApiResult, ClientConfig } from "../client";
import { z } from "zod";
import type { Address } from "../schemas";

/**
 * Body for POST /users. The API requires at least one of `phone_number` or
 * `email` to identify the user.
 */
export interface UserCreate {
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
}

const PostUserResultSchema = z.object({ id: z.number(), message: z.string() });

export type StUserCreateResponse = z.infer<typeof PostUserResultSchema>;

/** POST /users — Creates or updates a user. */
export function createUser(
  config: ClientConfig,
  body: UserCreate,
): Promise<ApiResult<unknown>> {
  return apiPost(config, "/users", { body, schema: PostUserResultSchema });
}
