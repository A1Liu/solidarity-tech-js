import { apiPost } from "../client";
import type { ApiResult, ClientConfig } from "../client";
import { z } from "zod";
import type { Address } from "../schemas";

/**
 * Body for POST /users. The API requires at least one of `phone_number` or
 * `email` to identify the user.
 *
 * Fields past the vendored document's dozen are from the live reference
 * (https://www.solidarity.tech/reference/post_users). `donation_charge` is
 * declared there too and left out here: its shape is not described.
 */
export interface StUserCreate {
  phone_number?: string | null;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  /** Nickname, community name, or alternate romanization. Searchable. */
  alternate_name?: string | null;
  preferred_language?: string;
  second_language?: string | null;
  /** Primary chapter. Required for a new user unless `chapter_ids` is given. */
  chapter_id?: number | null;
  /** Every chapter the user belongs to. Requires the multi-chapter feature. */
  chapter_ids?: number[] | null;
  /** Chapters to add. Requires the multi-chapter feature. */
  add_chapter_ids?: number[] | null;
  /** Chapters to remove; the primary chapter cannot be. */
  remove_chapter_ids?: number[] | null;
  referred_by_user_id?: number | null;
  custom_user_properties?: Record<string, string> | null;
  /**
   * How Multiple Checkboxes properties in `custom_user_properties` are
   * written: appended to what the user has (true, the default) or replacing
   * it (false).
   */
  append_custom_user_properties?: boolean | null;
  add_tags?: string[] | null;
  remove_tags?: string[] | null;
  address?: Address | null;
  /** Assessment status key to set on the user (maps to classification). */
  assessment?: string | null;
  sms_permission?: boolean | null;
  call_permission?: boolean | null;
  email_permission?: boolean | null;
  /** IANA identifier, e.g. `America/New_York`. */
  timezone?: string | null;
  /** Whether a `phone_number` or `email` is required to create the user. */
  require_contact_info?: boolean | null;
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

/** Every user endpoint function, for spreading into `Endpoints`. */
export const userEndpoints = {
  createUser,
} as const;

/** Every user zod schema, for spreading into `Schemas`. */
export const userSchemas = {
  StPostUserResultSchema,
} as const;
