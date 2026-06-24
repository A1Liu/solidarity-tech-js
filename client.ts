import { z } from "zod";
import type { ZodType } from "zod";

/** Default base URL, taken from the OpenAPI `servers` entry. */
export const DEFAULT_BASE_URL = "https://api.solidarity.tech/v1";

/** Configuration shared by every endpoint call. */
export interface ClientConfig {
  /** Bearer token used for the `Authorization` header. */
  apiKey: string;
  /** Override the API base URL. Defaults to {@link DEFAULT_BASE_URL}. */
  baseUrl?: string;
  /**
   * Override the `fetch` implementation. Defaults to the global `fetch`,
   * which is available in browsers, Node 18+, Bun, Deno and other runtimes.
   */
  fetch?: typeof fetch;
}

type QueryValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Array<string | number>;
/** Query string parameters. `undefined` and `null` values are omitted. */
export type QueryParams = Record<string, QueryValue>;

/** Result of a successful request whose body passed validation. */
export interface ApiSuccess<T> {
  ok: true;
  status: number;
  data: T;
  error?: undefined;
}

/** A non-2xx response, a network failure, or a body that failed validation. */
export interface ApiFailure {
  ok: false;
  status: number;
  error: ApiError;
  /** The raw parsed body, when one was received. */
  data: unknown;
}

/**
 * Every endpoint resolves to one of these instead of throwing, mirroring how
 * `fetch` surfaces HTTP errors as ordinary return values.
 */
export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export type ApiError =
  /** The server replied with a non-2xx status. */
  | { type: "http"; status: number; message: string; body: unknown }
  /** `fetch` rejected (DNS, connection, abort, etc.). */
  | { type: "network"; message: string; cause: unknown }
  /** The 2xx body did not match the expected zod schema. */
  | {
      type: "validation";
      message: string;
      issues: z.core.$ZodIssue[];
      received: unknown;
    };

function buildUrl(baseUrl: string, path: string, query?: QueryParams): string {
  const url = new URL(baseUrl.replace(/\/$/, "") + path);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        for (const item of value) url.searchParams.append(key, String(item));
      } else {
        url.searchParams.append(key, String(value));
      }
    }
  }
  return url.toString();
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

interface RequestOptions<T> {
  query?: QueryParams;
  body?: unknown;
  schema: ZodType<T>;
}

async function request<T>(
  config: ClientConfig,
  method: string,
  path: string,
  options: RequestOptions<T>,
): Promise<ApiResult<T>> {
  const fetchImpl = config.fetch ?? fetch;
  const url = buildUrl(config.baseUrl ?? DEFAULT_BASE_URL, path, options.query);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
    Accept: "application/json",
  };
  const hasBody = options.body !== undefined;
  if (hasBody) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetchImpl(url, {
      method,
      headers,
      body: hasBody ? JSON.stringify(options.body) : undefined,
    });
  } catch (cause) {
    return {
      ok: false,
      status: 0,
      data: undefined,
      error: {
        type: "network",
        message:
          cause instanceof Error ? cause.message : "Network request failed",
        cause,
      },
    };
  }

  const raw = await parseBody(res);

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      data: raw,
      error: {
        type: "http",
        status: res.status,
        message: res.statusText || `Request failed with status ${res.status}`,
        body: raw,
      },
    };
  }

  const parsed = options.schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      status: res.status,
      data: raw,
      error: {
        type: "validation",
        message: "Response body did not match the expected schema",
        issues: parsed.error.issues,
        received: raw,
      },
    };
  }

  return { ok: true, status: res.status, data: parsed.data };
}

interface GetOptions<T> {
  query?: QueryParams;
  schema?: ZodType<T>;
}
interface WriteOptions<T> {
  query?: QueryParams;
  body?: unknown;
  schema?: ZodType<T>;
}

/** Shared GET helper. Omit `schema` to receive the raw body as `unknown`. */
export function apiGet<T = unknown>(
  config: ClientConfig,
  path: string,
  options: GetOptions<T> = {},
): Promise<ApiResult<T>> {
  return request<T>(config, "GET", path, {
    query: options.query,
    schema: options.schema ?? (z.unknown() as ZodType<T>),
  });
}

/** Shared POST helper. Omit `schema` to receive the raw body as `unknown`. */
export function apiPost<T = unknown>(
  config: ClientConfig,
  path: string,
  options: WriteOptions<T> = {},
): Promise<ApiResult<T>> {
  return request<T>(config, "POST", path, {
    query: options.query,
    body: options.body,
    schema: options.schema ?? (z.unknown() as ZodType<T>),
  });
}

/** Shared PUT helper. Omit `schema` to receive the raw body as `unknown`. */
export function apiPut<T = unknown>(
  config: ClientConfig,
  path: string,
  options: WriteOptions<T> = {},
): Promise<ApiResult<T>> {
  return request<T>(config, "PUT", path, {
    query: options.query,
    body: options.body,
    schema: options.schema ?? (z.unknown() as ZodType<T>),
  });
}

/** Shared DELETE helper. Omit `schema` to receive the raw body as `unknown`. */
export function apiDelete<T = unknown>(
  config: ClientConfig,
  path: string,
  options: WriteOptions<T> = {},
): Promise<ApiResult<T>> {
  return request<T>(config, "DELETE", path, {
    query: options.query,
    body: options.body,
    schema: options.schema ?? (z.unknown() as ZodType<T>),
  });
}
