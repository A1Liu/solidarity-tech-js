import z from "zod";
import { apiPost } from "../client";
import type { ApiResult, ClientConfig } from "../client";
import type { Address } from "../schemas";

export interface StUserActionData {
  phone_number?: string | null;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  preferred_language?: string | null;
  second_language?: string | null;
  chapter_id?: number | null;
  address?: Address | null;
  sms_permission?: boolean | null;
  call_permission?: boolean | null;
  email_permission?: boolean | null;
  custom_user_properties?: Record<string, string> | null;
}

/**
 * Body for POST /user_actions. `page_id` is required; supply either an existing
 * `user_id` or a `data` object that identifies the user by phone number/email.
 */
export interface StUserActionCreate {
  page_id: number;
  user_id?: number | null;
  created_at?: number | null;
  data?: StUserActionData;
}

const StCreateUserActionSchema = z.object({
  id: z.number(),
  message: z.string(),
});

export type StCreateUserAction = z.infer<typeof StCreateUserActionSchema>;

/** POST /user_actions — Creates a user action. */
export function createUserAction(
  config: ClientConfig,
  body: StUserActionCreate,
): Promise<ApiResult<unknown>> {
  return apiPost(config, "/user_actions", {
    body,
    schema: StCreateUserActionSchema,
  });
}
