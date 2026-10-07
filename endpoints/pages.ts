import { z } from "zod";
import { apiPatch, apiPost } from "../client";
import type { ApiResult, ClientConfig } from "../client";
import type { ScopeType } from "../schemas";
import { StScopeType } from "./team_members";

/* ------------------------------------------------------------------ *
 * Schemas
 *
 * Shapes here are from the live reference
 * (https://www.solidarity.tech/reference/post_pages,
 * https://www.solidarity.tech/reference/patch_pages-id); the vendored document
 * declares neither operation, and no live sample has been captured, so key
 * presence and nullability follow the reference rather than a response.
 * ------------------------------------------------------------------ */

/**
 * A value the API keeps per language: one string, in the page's language, or
 * `{ language_code: text }`. Responses always use the second form.
 */
export type StLocalizedText = string | Record<string, string>;

/** One choice of a `select`, `radios`, or `checkboxes` field. */
export const StPageFieldOption = z.object({
  label: z.record(z.string(), z.string()),
  value: z.string(),
});

/**
 * One field of a generic form page, as the API returns it. A question or
 * contact field carries `type` and `name`; a custom property field carries
 * `property` instead.
 */
export const StPageField = z.object({
  // Not narrowed to `StPageFieldTypes` because the reference declares a bare
  // string here, unlike the request body.
  type: z.string().optional(),
  /** Key the answer takes in submissions (`POST /user_actions` data). */
  name: z.string().optional(),
  /** `internal_name` of the custom property the answer saves onto. */
  property: z.string().optional(),
  label: z.record(z.string(), z.string()).optional(),
  required: z.boolean().optional(),
  placeholder: z.record(z.string(), z.string()).optional(),
  options: z.array(StPageFieldOption).optional(),
  /** Set when the options follow a custom property; change them there. */
  options_from_property: z.boolean().optional(),
});

export const StPage = z.object({
  id: z.number().int(),
  /** e.g. `ActionPage::GenericForm`, `ActionPage::Petition`. */
  type: z.string().nullable(),
  url_slug: z.string(),
  /** Internal page name, unique per website, case insensitive. */
  name: z.string(),
  /** Headline, in the organization's default language. */
  title: z.string().nullable(),
  website_id: z.number().int().nullable(),
  is_published: z.boolean(),
  /** Public URL of the page. */
  full_url: z.string().nullable(),
  scope_id: z.number().int().nullable(),
  scope_type: StScopeType.nullable(),
  supported_languages: z.array(z.string()).nullable(),
  // Three post-submission settings the reference describes only as objects.
  follow_up: z.record(z.string(), z.unknown()).nullable(),
  confirmations: z.record(z.string(), z.unknown()).nullable(),
  admin_notifications: z.record(z.string(), z.unknown()).nullable(),
  requires_user: z.boolean().nullable(),
  always_hide_primary_nav: z.boolean().nullable(),
  always_hide_footer: z.boolean().nullable(),
  allow_multiple_responses: z.boolean().nullable(),
  /** The raw form builder components behind {@link StPage.fields}. */
  form: z.array(z.record(z.string(), z.unknown())).nullable(),
  /**
   * Generic form pages only, and null for a form holding parts the API cannot
   * describe (HTML blocks, subforms, conditional fields, builder-only field
   * types). Each entry can go back into `PATCH` unchanged to keep the field.
   */
  fields: z.array(StPageField).nullable(),
  /** HTML above the form, in the organization's default language. */
  description: z.string().nullable(),
  campaign_tags: z.array(z.string()).nullable(),
  created_at: z.string(),
  /** The page in the dashboard. */
  admin_url: z.string().nullable(),
  // Both only with `include_action_counts=true`, which no write takes.
  /** Total submissions. */
  action_count: z.number().int().optional(),
  /** Next milestone the public progress bar shows. */
  action_goal: z.number().int().optional(),
});

/** 201 body of POST /pages. */
export const StPageCreateResponse = z.object({
  data: StPage,
  warnings: z.array(z.string()).optional(),
});

/**
 * 200 body of PATCH /pages/{id}. `migrated` reports the submissions a
 * `renames` entry moved, keyed by old field name; its inner shape is from the
 * reference's description, which is all it gives.
 */
export const StPageUpdateResponse = z.object({
  data: StPage,
  warnings: z.array(z.string()).optional(),
  migrated: z
    .record(z.string(), z.object({ to: z.string(), count: z.number().int() }))
    .optional(),
});

/**
 * 409 body of either write: a duplicate page name, a page that is not a
 * generic form, a form the API cannot describe, or -- for PATCH -- a change
 * that drops answered fields or options and so needs `confirm_removals`.
 * Parse `result.data` with this when a write answers 409.
 */
export const StPageConflict = z.object({
  error: z.string(),
  admin_url: z.string().optional(),
  /** Duplicate name only. */
  existing_page_id: z.number().int().optional(),
  /** Forms with parts the API cannot describe only. */
  unsupported_components: z.array(z.string()).optional(),
  /** Set when re-sending with `confirm_removals: true` would save the change. */
  requires_confirmation: z.boolean().optional(),
  /** One entry per removed field, removed option, or options-following sync. */
  impacts: z
    .array(
      z.object({
        kind: z.enum(["field", "option", "sync"]),
        /** `field` kind: the removed field. */
        name: z.string().optional(),
        /** `field` kind: its label. `option` kind: the removed option's. */
        label: z.string().optional(),
        /** `option` and `sync` kinds: the field the change is on. */
        field: z.string().optional(),
        field_label: z.string().optional(),
        /** Submissions holding an answer for it. */
        count: z.number().int().optional(),
      }),
    )
    .optional(),
});

export type StPageFieldOption = z.infer<typeof StPageFieldOption>;
export type StPageField = z.infer<typeof StPageField>;
export type StPage = z.infer<typeof StPage>;
export type StPageCreateResponse = z.infer<typeof StPageCreateResponse>;
export type StPageUpdateResponse = z.infer<typeof StPageUpdateResponse>;
export type StPageConflict = z.infer<typeof StPageConflict>;

/* ------------------------------------------------------------------ *
 * Request shapes
 * ------------------------------------------------------------------ */

/**
 * The field types a write accepts. `email`, `phone_number`, `full_name`,
 * `zip_code`, and `full_address` are contact fields: their name is always the
 * type and answers update the person. The rest are questions.
 */
export type StPageFieldType =
  | "email"
  | "phone_number"
  | "full_name"
  | "zip_code"
  | "full_address"
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "select"
  | "radios"
  | "checkboxes";

/** One field of a generic form page, as a write accepts it. */
export interface StPageFieldInput {
  /**
   * Omitted on a custom property field, which takes its type from the
   * property. The open `string` arm is what lets a {@link StPageField} read
   * back from the API be sent again unchanged.
   */
  type?: StPageFieldType | (string & {});
  /**
   * `internal_name` of a custom property (`GET /custom_user_properties`); the
   * answer saves onto the person, and the field's type and options follow the
   * property. A property that does not exist is refused -- create it first
   * with `POST /custom_user_properties`. Datetime properties cannot go on a
   * form.
   */
  property?: string;
  /**
   * Key the answer takes in submissions. Required for a question: lowercase
   * letters, digits, `-` and `_`. A person field name or a custom property
   * name is refused.
   */
  name?: string;
  /** Required for a new question. No `<` or `>`. */
  label?: StLocalizedText;
  /** Defaults to true for a new field, as in the form builder. */
  required?: boolean;
  /** `text`, `textarea`, `number`, `email`, and `zip_code` only. */
  placeholder?: StLocalizedText;
  /**
   * `select`, `radios`, and `checkboxes` only. A bare string keeps the value
   * of the existing option with the same label. On a property field, the
   * options are accepted only when they repeat the property's own.
   */
  options?: Array<string | { label: StLocalizedText; value?: string }>;
  /** Response-only; a field read from the API carries it back untouched. */
  options_from_property?: boolean;
}

/** Body for POST /pages. */
export interface StPageCreate {
  /** Also the default title and slug. */
  name: string;
  title?: StLocalizedText;
  /** HTML shown above the form. Script is refused. */
  description?: StLocalizedText;
  /** Required when the scope can use more than one website. */
  website_id?: number;
  /** Lowercase letters, digits, `-`, `_`, and `/`. Defaults from `name`. */
  url_slug?: string;
  /** Default `full_page`. */
  layout?: "full_page" | "sidebar";
  /** Default true. */
  published?: boolean;
  /**
   * The form, in order. Must hold an `email` or `phone_number` field with
   * `required: true` -- that is how a submission is matched to a person.
   */
  fields: StPageFieldInput[];
}

/** Owner of the new page. Defaults to the API key's organization. */
export interface StCreatePageParams {
  scope_type?: ScopeType;
  scope_id?: number;
}

/** Body for PATCH /pages/{id}. Only the keys sent change. */
export interface StPageUpdate {
  name?: string;
  title?: StLocalizedText;
  description?: StLocalizedText;
  /** False hides the page. The website home page cannot be unpublished. */
  published?: boolean;
  /**
   * The whole ordered form: a field left out is removed, and a field sent
   * keeps every builder setting the API does not name. A field cannot change
   * type.
   */
  fields?: StPageFieldInput[];
  /**
   * `{ old_name: new_name }`, to rename a field and keep its submissions.
   * Each new name must also appear in `fields`.
   */
  renames?: Record<string, string>;
  /** Saves a change that drops answered fields or options. Default false. */
  confirm_removals?: boolean;
}

/* ------------------------------------------------------------------ *
 * Endpoints
 * ------------------------------------------------------------------ */

/**
 * POST /pages — Creates a generic form page from an ordered list of fields.
 *
 * Each field becomes the component the form builder makes for its type, so the
 * page edits normally in the dashboard afterwards. Submissions can then be
 * imported with `POST /user_actions` using the page id, keyed by field name.
 *
 * Answers 403 when the scope is out of the key's reach or the admin who
 * created the key lacks `pages.manage` there, 409 for a name already on the
 * website ({@link StPageConflict} carries `existing_page_id`), and 422 on
 * validation. The Zapier key cannot create pages.
 */
export function createPage(
  config: ClientConfig,
  body: StPageCreate,
  params: StCreatePageParams = {},
): Promise<ApiResult<StPageCreateResponse>> {
  return apiPost(config, "/pages", {
    query: { ...params },
    body,
    schema: StPageCreateResponse,
  });
}

/**
 * PATCH /pages/{id} — Updates a generic form page.
 *
 * A change that removes a field or an option with submissions already on it
 * answers 409 with `requires_confirmation` and one `impacts` entry per
 * removal; re-send with `confirm_removals: true` to save it. A page that is
 * not a generic form, and a `fields` change to a form holding parts the API
 * cannot describe, answer 409 as well -- `name`, `title`, `description`, and
 * `published` still change on the latter.
 */
export function updatePage(
  config: ClientConfig,
  id: number,
  body: StPageUpdate,
): Promise<ApiResult<StPageUpdateResponse>> {
  return apiPatch(config, `/pages/${id}`, {
    body,
    schema: StPageUpdateResponse,
  });
}

/** Every page endpoint function, for spreading into `Endpoints`. */
export const pageEndpoints = {
  createPage,
  updatePage,
} as const;

/** Every page zod schema, for spreading into `Schemas`. */
export const pageSchemas = {
  StPageFieldOption,
  StPageField,
  StPage,
  StPageCreateResponse,
  StPageUpdateResponse,
  StPageConflict,
} as const;
