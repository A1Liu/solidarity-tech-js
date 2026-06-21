import { apiGet, apiPost, apiPut, apiDelete } from "./client";
import type { ApiResult, ClientConfig } from "./client";
import {
  activitiesResponse,
  callsResponse,
  chaptersResponse,
  customUserPropertiesResponse,
  textsResponse,
  usersResponse,
} from "./schemas";
import type {
  ActivitiesResponse,
  CallsResponse,
  ChaptersResponse,
  CustomUserPropertiesResponse,
  TextsResponse,
  UsersResponse,
  ListParams,
  ScopeType,
  Address,
  EventLocationData,
} from "./schemas";

/* ------------------------------------------------------------------ *
 * Activities
 * ------------------------------------------------------------------ */

export interface ListActivitiesParams extends ListParams {
  user_id?: number;
}

/** GET /activities — Retrieves all activities. */
export function listActivities(
  config: ClientConfig,
  params: ListActivitiesParams = {},
): Promise<ApiResult<ActivitiesResponse>> {
  return apiGet(config, "/activities", { query: { ...params }, schema: activitiesResponse });
}

/* ------------------------------------------------------------------ *
 * Agent Assignments
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

/** GET /agent_assignments — Lists agent assignments. */
export function listAgentAssignments(
  config: ClientConfig,
  params: ListAgentAssignmentsParams = {},
): Promise<ApiResult<unknown>> {
  return apiGet(config, "/agent_assignments", { query: { ...params } });
}

/** POST /agent_assignments — Creates an agent assignment. */
export function createAgentAssignment(
  config: ClientConfig,
  body: AgentAssignmentCreate,
): Promise<ApiResult<unknown>> {
  return apiPost(config, "/agent_assignments", { body });
}

/** GET /agent_assignments/{id} — Shows a single agent assignment. */
export function getAgentAssignment(config: ClientConfig, id: number): Promise<ApiResult<unknown>> {
  return apiGet(config, `/agent_assignments/${id}`);
}

/** PUT /agent_assignments/{id} — Updates an agent assignment. */
export function updateAgentAssignment(
  config: ClientConfig,
  id: number,
  body: AgentAssignmentUpdate,
): Promise<ApiResult<unknown>> {
  return apiPut(config, `/agent_assignments/${id}`, { body });
}

/** DELETE /agent_assignments/{id} — Deletes an agent assignment. */
export function deleteAgentAssignment(config: ClientConfig, id: number): Promise<ApiResult<unknown>> {
  return apiDelete(config, `/agent_assignments/${id}`);
}

/* ------------------------------------------------------------------ *
 * Calls
 * ------------------------------------------------------------------ */

export interface ListCallsParams extends ListParams {
  user_id?: number;
}

/** GET /calls — Retrieves all calls. */
export function listCalls(
  config: ClientConfig,
  params: ListCallsParams = {},
): Promise<ApiResult<CallsResponse>> {
  return apiGet(config, "/calls", { query: { ...params }, schema: callsResponse });
}

/* ------------------------------------------------------------------ *
 * Chapter Phone Numbers
 * ------------------------------------------------------------------ */

export interface ListChapterPhoneNumbersParams extends ListParams {
  chapter_id?: number;
}

/** GET /chapter_phone_numbers — Lists chapter phone numbers. */
export function listChapterPhoneNumbers(
  config: ClientConfig,
  params: ListChapterPhoneNumbersParams = {},
): Promise<ApiResult<unknown>> {
  return apiGet(config, "/chapter_phone_numbers", { query: { ...params } });
}

/* ------------------------------------------------------------------ *
 * Chapters
 * ------------------------------------------------------------------ */

/** GET /chapters — Retrieves all chapters. */
export function listChapters(
  config: ClientConfig,
  params: ListParams = {},
): Promise<ApiResult<ChaptersResponse>> {
  return apiGet(config, "/chapters", { query: { ...params }, schema: chaptersResponse });
}

/* ------------------------------------------------------------------ *
 * Custom User Properties
 * ------------------------------------------------------------------ */

/** GET /custom_user_properties — Retrieves all custom user properties. */
export function listCustomUserProperties(
  config: ClientConfig,
  params: ListParams = {},
): Promise<ApiResult<CustomUserPropertiesResponse>> {
  return apiGet(config, "/custom_user_properties", {
    query: { ...params },
    schema: customUserPropertiesResponse,
  });
}

/* ------------------------------------------------------------------ *
 * Email Blasts
 * ------------------------------------------------------------------ */

/** GET /email_blasts — Lists email blasts. */
export function listEmailBlasts(
  config: ClientConfig,
  params: ListParams = {},
): Promise<ApiResult<unknown>> {
  return apiGet(config, "/email_blasts", { query: { ...params } });
}

/** GET /email_blasts/{id} — Shows a single email blast. */
export function getEmailBlast(config: ClientConfig, id: number): Promise<ApiResult<unknown>> {
  return apiGet(config, `/email_blasts/${id}`);
}

/* ------------------------------------------------------------------ *
 * Event Attendances
 * ------------------------------------------------------------------ */

export interface ListEventAttendancesParams extends ListParams {
  event_id?: number;
}

export interface EventAttendanceCreate {
  event_id: number;
  event_session_id: number;
  user_id: number;
  attended: boolean;
}

/** GET /event_attendances — Lists event attendances. */
export function listEventAttendances(
  config: ClientConfig,
  params: ListEventAttendancesParams = {},
): Promise<ApiResult<unknown>> {
  return apiGet(config, "/event_attendances", { query: { ...params } });
}

/** POST /event_attendances — Creates an event attendance. */
export function createEventAttendance(
  config: ClientConfig,
  body: EventAttendanceCreate,
): Promise<ApiResult<unknown>> {
  return apiPost(config, "/event_attendances", { body });
}

/* ------------------------------------------------------------------ *
 * Event RSVPs
 * ------------------------------------------------------------------ */

export interface ListEventRsvpsParams extends ListParams {
  event_id?: number;
}

export interface EventRsvpCreate {
  event_id: number;
  event_session_id: number;
  user_id?: number;
  is_attending: "yes" | "no" | "maybe";
  is_confirmed?: boolean;
  agent_user_id: number | null;
  source?: string | null;
  source_system?: string | null;
}

export interface EventRsvpUpdate {
  is_attending?: "yes" | "no" | "maybe";
  is_confirmed?: boolean;
  agent_user_id?: number | null;
  source?: string | null;
  source_system?: string | null;
}

/** GET /event_rsvps — Lists event rsvps. */
export function listEventRsvps(
  config: ClientConfig,
  params: ListEventRsvpsParams = {},
): Promise<ApiResult<unknown>> {
  return apiGet(config, "/event_rsvps", { query: { ...params } });
}

/** POST /event_rsvps — Creates an event rsvp. */
export function createEventRsvp(
  config: ClientConfig,
  body: EventRsvpCreate,
): Promise<ApiResult<unknown>> {
  return apiPost(config, "/event_rsvps", { body });
}

/** GET /event_rsvps/{id} — Shows a single event rsvp. */
export function getEventRsvp(config: ClientConfig, id: number): Promise<ApiResult<unknown>> {
  return apiGet(config, `/event_rsvps/${id}`);
}

/** PUT /event_rsvps/{id} — Updates an event rsvp. */
export function updateEventRsvp(
  config: ClientConfig,
  id: number,
  body: EventRsvpUpdate,
): Promise<ApiResult<unknown>> {
  return apiPut(config, `/event_rsvps/${id}`, { body });
}

/** DELETE /event_rsvps/{id} — Deletes an event rsvp. */
export function deleteEventRsvp(config: ClientConfig, id: number): Promise<ApiResult<unknown>> {
  return apiDelete(config, `/event_rsvps/${id}`);
}

/* ------------------------------------------------------------------ *
 * Event Sessions
 * ------------------------------------------------------------------ */

export interface ListEventSessionsParams extends ListParams {
  event_id?: number;
}

export interface EventSessionCreate {
  event_id: number;
  start_time: number | null;
  end_time: number | null;
  title?: string | null;
  location_name?: string | null;
  location_data?: EventLocationData;
  location_address?: string | null;
  show_rsvp_bar?: boolean | null;
  show_title_in_form?: boolean | null;
}

export interface EventSessionUpdate {
  start_time?: number | null;
  end_time?: number | null;
  title?: string | null;
  location_name?: string | null;
  location_address?: string | null;
  show_rsvp_bar?: boolean | null;
  show_title_in_form?: boolean | null;
}

/** GET /event_sessions — Lists event sessions. */
export function listEventSessions(
  config: ClientConfig,
  params: ListEventSessionsParams = {},
): Promise<ApiResult<unknown>> {
  return apiGet(config, "/event_sessions", { query: { ...params } });
}

/** POST /event_sessions — Creates an event session. */
export function createEventSession(
  config: ClientConfig,
  body: EventSessionCreate,
): Promise<ApiResult<unknown>> {
  return apiPost(config, "/event_sessions", { body });
}

/** GET /event_sessions/{id} — Shows a single event session. */
export function getEventSession(config: ClientConfig, id: number): Promise<ApiResult<unknown>> {
  return apiGet(config, `/event_sessions/${id}`);
}

/** PUT /event_sessions/{id} — Updates an event session. */
export function updateEventSession(
  config: ClientConfig,
  id: number,
  body: EventSessionUpdate,
): Promise<ApiResult<unknown>> {
  return apiPut(config, `/event_sessions/${id}`, { body });
}

/** DELETE /event_sessions/{id} — Deletes an event session. */
export function deleteEventSession(config: ClientConfig, id: number): Promise<ApiResult<unknown>> {
  return apiDelete(config, `/event_sessions/${id}`);
}

/* ------------------------------------------------------------------ *
 * Organizations
 * ------------------------------------------------------------------ */

/** GET /organizations — Lists organizations. */
export function listOrganizations(
  config: ClientConfig,
  params: ListParams = {},
): Promise<ApiResult<unknown>> {
  return apiGet(config, "/organizations", { query: { ...params } });
}

/** GET /organizations/{id} — Shows a single organization. */
export function getOrganization(config: ClientConfig, id: number): Promise<ApiResult<unknown>> {
  return apiGet(config, `/organizations/${id}`);
}

/* ------------------------------------------------------------------ *
 * Pages
 * ------------------------------------------------------------------ */

/** GET /pages — Lists pages. */
export function listPages(
  config: ClientConfig,
  params: ListParams = {},
): Promise<ApiResult<unknown>> {
  return apiGet(config, "/pages", { query: { ...params } });
}

/** GET /pages/{id} — Shows a single page. */
export function getPage(config: ClientConfig, id: number): Promise<ApiResult<unknown>> {
  return apiGet(config, `/pages/${id}`);
}

/* ------------------------------------------------------------------ *
 * Phonebanks
 * ------------------------------------------------------------------ */

export interface ListPhonebanksParams extends ListParams {
  event_id?: number;
}

/** GET /phonebanks — Lists phonebanks. */
export function listPhonebanks(
  config: ClientConfig,
  params: ListPhonebanksParams = {},
): Promise<ApiResult<unknown>> {
  return apiGet(config, "/phonebanks", { query: { ...params } });
}

/** GET /phonebanks/{id} — Shows a single phonebank. */
export function getPhonebank(config: ClientConfig, id: number): Promise<ApiResult<unknown>> {
  return apiGet(config, `/phonebanks/${id}`);
}

/* ------------------------------------------------------------------ *
 * Scheduled Calls
 * ------------------------------------------------------------------ */

export interface ListScheduledCallsParams extends ListParams {
  user_id?: number;
  agent_user_id?: number;
}

/** GET /scheduled_calls — Lists scheduled calls. */
export function listScheduledCalls(
  config: ClientConfig,
  params: ListScheduledCallsParams = {},
): Promise<ApiResult<unknown>> {
  return apiGet(config, "/scheduled_calls", { query: { ...params } });
}

/** GET /scheduled_calls/{id} — Shows a single scheduled call. */
export function getScheduledCall(config: ClientConfig, id: number): Promise<ApiResult<unknown>> {
  return apiGet(config, `/scheduled_calls/${id}`);
}

/* ------------------------------------------------------------------ *
 * Scheduled Tasks
 * ------------------------------------------------------------------ */

export interface ListScheduledTasksParams extends ListParams {
  user_id?: number;
  agent_user_id?: number;
}

export interface ScheduledTaskCreate {
  due_at: string;
  remind_at?: string | null;
  agent_user_id?: number | null;
  user_id: number;
  notes?: string | null;
  marked_as_completed?: boolean | null;
}

export interface ScheduledTaskUpdate {
  due_at?: string;
  remind_at?: string | null;
  agent_user_id?: number | null;
  user_id?: number;
  notes?: string | null;
  marked_as_completed?: boolean | null;
}

/** GET /scheduled_tasks — Lists scheduled tasks. */
export function listScheduledTasks(
  config: ClientConfig,
  params: ListScheduledTasksParams = {},
): Promise<ApiResult<unknown>> {
  return apiGet(config, "/scheduled_tasks", { query: { ...params } });
}

/** POST /scheduled_tasks — Creates a scheduled task. */
export function createScheduledTask(
  config: ClientConfig,
  body: ScheduledTaskCreate,
): Promise<ApiResult<unknown>> {
  return apiPost(config, "/scheduled_tasks", { body });
}

/** GET /scheduled_tasks/{id} — Shows a single scheduled task. */
export function getScheduledTask(config: ClientConfig, id: number): Promise<ApiResult<unknown>> {
  return apiGet(config, `/scheduled_tasks/${id}`);
}

/** PUT /scheduled_tasks/{id} — Updates a scheduled task. */
export function updateScheduledTask(
  config: ClientConfig,
  id: number,
  body: ScheduledTaskUpdate,
): Promise<ApiResult<unknown>> {
  return apiPut(config, `/scheduled_tasks/${id}`, { body });
}

/** DELETE /scheduled_tasks/{id} — Deletes a scheduled task. */
export function deleteScheduledTask(config: ClientConfig, id: number): Promise<ApiResult<unknown>> {
  return apiDelete(config, `/scheduled_tasks/${id}`);
}

/* ------------------------------------------------------------------ *
 * Task Agents
 * ------------------------------------------------------------------ */

export interface ListTaskAgentsParams extends ListParams {
  task_id?: number;
}

export interface TaskAgentCreate {
  user_id: number;
  task_id: number;
}

/** GET /task_agents — Lists task agents. */
export function listTaskAgents(
  config: ClientConfig,
  params: ListTaskAgentsParams = {},
): Promise<ApiResult<unknown>> {
  return apiGet(config, "/task_agents", { query: { ...params } });
}

/** POST /task_agents — Creates a task agent. */
export function createTaskAgent(
  config: ClientConfig,
  body: TaskAgentCreate,
): Promise<ApiResult<unknown>> {
  return apiPost(config, "/task_agents", { body });
}

/** GET /task_agents/{id} — Shows a single task agent. */
export function getTaskAgent(config: ClientConfig, id: number): Promise<ApiResult<unknown>> {
  return apiGet(config, `/task_agents/${id}`);
}

/** DELETE /task_agents/{id} — Deletes a task agent. */
export function deleteTaskAgent(config: ClientConfig, id: number): Promise<ApiResult<unknown>> {
  return apiDelete(config, `/task_agents/${id}`);
}

/* ------------------------------------------------------------------ *
 * Task Assignments
 * ------------------------------------------------------------------ */

export interface ListTaskAssignmentsParams extends ListParams {
  task_id?: number;
  agent_user_id?: number;
}

export interface TaskAssignmentCreate {
  user_id: number;
  task_id: number;
  agent_user_id?: number | null;
}

export interface TaskAssignmentUpdate {
  agent_user_id?: number | null;
}

/** GET /task_assignments — Lists task assignments. */
export function listTaskAssignments(
  config: ClientConfig,
  params: ListTaskAssignmentsParams = {},
): Promise<ApiResult<unknown>> {
  return apiGet(config, "/task_assignments", { query: { ...params } });
}

/** POST /task_assignments — Creates a task assignment. */
export function createTaskAssignment(
  config: ClientConfig,
  body: TaskAssignmentCreate,
): Promise<ApiResult<unknown>> {
  return apiPost(config, "/task_assignments", { body });
}

/** GET /task_assignments/{id} — Shows a single task assignment. */
export function getTaskAssignment(config: ClientConfig, id: number): Promise<ApiResult<unknown>> {
  return apiGet(config, `/task_assignments/${id}`);
}

/** PUT /task_assignments/{id} — Updates a task assignment. */
export function updateTaskAssignment(
  config: ClientConfig,
  id: number,
  body: TaskAssignmentUpdate,
): Promise<ApiResult<unknown>> {
  return apiPut(config, `/task_assignments/${id}`, { body });
}

/** DELETE /task_assignments/{id} — Deletes a task assignment. */
export function deleteTaskAssignment(config: ClientConfig, id: number): Promise<ApiResult<unknown>> {
  return apiDelete(config, `/task_assignments/${id}`);
}

/* ------------------------------------------------------------------ *
 * Team Members
 * ------------------------------------------------------------------ */

/** GET /team_members — Lists team members. */
export function listTeamMembers(
  config: ClientConfig,
  params: ListParams = {},
): Promise<ApiResult<unknown>> {
  return apiGet(config, "/team_members", { query: { ...params } });
}

/* ------------------------------------------------------------------ *
 * Text Blasts
 * ------------------------------------------------------------------ */

/** GET /text_blasts — Lists text blasts. */
export function listTextBlasts(
  config: ClientConfig,
  params: ListParams = {},
): Promise<ApiResult<unknown>> {
  return apiGet(config, "/text_blasts", { query: { ...params } });
}

/** GET /text_blasts/{id} — Shows a single text blast. */
export function getTextBlast(config: ClientConfig, id: number): Promise<ApiResult<unknown>> {
  return apiGet(config, `/text_blasts/${id}`);
}

/* ------------------------------------------------------------------ *
 * Text Templates
 * ------------------------------------------------------------------ */

export interface ListTextTemplatesParams extends ListParams {
  event_id?: number;
}

export interface TextTemplateCreate {
  name: string;
  scope_id: number;
  scope_type: ScopeType;
  /** Localized template bodies keyed by 2-character language code. */
  template?: Record<string, string>;
  event_id?: number | null;
}

export interface TextTemplateUpdate {
  name?: string;
  scope_id?: number;
  scope_type?: string;
  template?: Record<string, string>;
  event_id?: number | null;
}

/** GET /text_templates — Lists text templates. */
export function listTextTemplates(
  config: ClientConfig,
  params: ListTextTemplatesParams = {},
): Promise<ApiResult<unknown>> {
  return apiGet(config, "/text_templates", { query: { ...params } });
}

/** POST /text_templates — Creates a text template. */
export function createTextTemplate(
  config: ClientConfig,
  body: TextTemplateCreate,
): Promise<ApiResult<unknown>> {
  return apiPost(config, "/text_templates", { body });
}

/** GET /text_templates/{id} — Shows a single text template. */
export function getTextTemplate(config: ClientConfig, id: number): Promise<ApiResult<unknown>> {
  return apiGet(config, `/text_templates/${id}`);
}

/** PUT /text_templates/{id} — Updates a text template. */
export function updateTextTemplate(
  config: ClientConfig,
  id: number,
  body: TextTemplateUpdate,
): Promise<ApiResult<unknown>> {
  return apiPut(config, `/text_templates/${id}`, { body });
}

/** DELETE /text_templates/{id} — Deletes a text template. */
export function deleteTextTemplate(config: ClientConfig, id: number): Promise<ApiResult<unknown>> {
  return apiDelete(config, `/text_templates/${id}`);
}

/* ------------------------------------------------------------------ *
 * Textbanks
 * ------------------------------------------------------------------ */

export interface ListTextbanksParams extends ListParams {
  event_id?: number;
}

/** GET /textbanks — Lists textbanks. */
export function listTextbanks(
  config: ClientConfig,
  params: ListTextbanksParams = {},
): Promise<ApiResult<unknown>> {
  return apiGet(config, "/textbanks", { query: { ...params } });
}

/** GET /textbanks/{id} — Shows a single textbank. */
export function getTextbank(config: ClientConfig, id: number): Promise<ApiResult<unknown>> {
  return apiGet(config, `/textbanks/${id}`);
}

/* ------------------------------------------------------------------ *
 * Texts
 * ------------------------------------------------------------------ */

export interface SendTextParams {
  user_id: number;
  body: string;
  media_urls?: string[];
  attach_contact_card?: boolean;
  shorten_urls?: boolean;
}

export interface ListTextsParams {
  user_id?: number;
  _limit?: number;
  _offset?: number;
  _since?: string;
}

/** POST /texts — Sends a text message. Parameters are passed as query string. */
export function sendText(config: ClientConfig, params: SendTextParams): Promise<ApiResult<unknown>> {
  return apiPost(config, "/texts", { query: { ...params } });
}

/** GET /texts — Retrieves a list of texts. */
export function listTexts(
  config: ClientConfig,
  params: ListTextsParams = {},
): Promise<ApiResult<TextsResponse>> {
  return apiGet(config, "/texts", { query: { ...params }, schema: textsResponse });
}

/* ------------------------------------------------------------------ *
 * User Actions
 * ------------------------------------------------------------------ */

export interface UserActionData {
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
export interface UserActionCreate {
  page_id: number;
  user_id?: number | null;
  created_at?: number | null;
  data?: UserActionData;
}

/** POST /user_actions — Creates a user action. */
export function createUserAction(
  config: ClientConfig,
  body: UserActionCreate,
): Promise<ApiResult<unknown>> {
  return apiPost(config, "/user_actions", { body });
}

/* ------------------------------------------------------------------ *
 * User Lists
 * ------------------------------------------------------------------ */

/** GET /user_lists — Lists user lists. */
export function listUserLists(
  config: ClientConfig,
  params: ListParams = {},
): Promise<ApiResult<unknown>> {
  return apiGet(config, "/user_lists", { query: { ...params } });
}

/** GET /user_lists/{id} — Shows a single user list. */
export function getUserList(config: ClientConfig, id: number): Promise<ApiResult<unknown>> {
  return apiGet(config, `/user_lists/${id}`);
}

/* ------------------------------------------------------------------ *
 * User Notes
 * ------------------------------------------------------------------ */

export interface CreateUserNoteParams {
  user_id: number;
  content: string;
  created_at?: number;
}

/** POST /user_notes — Creates a user note. Parameters are passed as query string. */
export function createUserNote(
  config: ClientConfig,
  params: CreateUserNoteParams,
): Promise<ApiResult<unknown>> {
  return apiPost(config, "/user_notes", { query: { ...params } });
}

/* ------------------------------------------------------------------ *
 * Users
 * ------------------------------------------------------------------ */

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

export interface UserUpdate {
  phone_number?: string | null;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  preferred_language?: string | null;
  second_language?: string | null;
  chapter_id?: number | null;
  custom_user_properties?: Record<string, string> | null;
  address?: Address | null;
  sms_permission?: boolean | null;
  call_permission?: boolean | null;
  email_permission?: boolean | null;
}

/** POST /users — Creates or updates a user. */
export function createUser(config: ClientConfig, body: UserCreate): Promise<ApiResult<unknown>> {
  return apiPost(config, "/users", { body });
}

/** GET /users — Retrieves a list of users. */
export function listUsers(
  config: ClientConfig,
  params: ListParams = {},
): Promise<ApiResult<UsersResponse>> {
  return apiGet(config, "/users", { query: { ...params }, schema: usersResponse });
}

/** PUT /users/{id} — Updates a user. */
export function updateUser(
  config: ClientConfig,
  id: number,
  body: UserUpdate,
): Promise<ApiResult<unknown>> {
  return apiPut(config, `/users/${id}`, { body });
}
