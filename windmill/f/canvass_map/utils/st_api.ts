/**
 * Solidarity Tech API client helpers shared across canvass_map scripts.
 *
 * Endpoints (https://www.solidarity.tech/reference):
 *   - GET  /v1/events          (list events + their sessions/tags)
 *   - POST /v1/event_sessions  (create a session on an existing event)
 *
 * Callers pass the resolved API key value (not the Windmill variable path);
 * resolving it via `wmill.getVariable` stays the caller's responsibility.
 */

import { z } from 'zod'

// --- Types (mirror the /v1/events response shape) ---------------------------

export interface StCoordinates {
  lat: number
  lng: number
}

export interface StLocationData {
  components?: string
  // Raw from the API as a JSON-stringified `{lng, lat}`; `fetchAllEvents`
  // parses it into this object (or null when absent/invalid).
  coordinates?: StCoordinates | null
  address_city?: string
  full_address?: string
  address_state?: string
  address_line_1?: string
  address_country?: string
  address_postal_code?: string
}

export interface StEventSession {
  id: number
  mobilize_event_id: number
  primary_session_id: number
  start_time: string
  end_time: string
  title: string
  created_at: string
  updated_at: string
  location_name: string | null
  location_data: StLocationData | null
  // PostGIS WKT `POINT (lon lat)` — note lon first. Null when ungeocoded.
  lonlat: string | null
  // Empty string (not null) when the session has no address.
  location_address: string
  note: string | null
  tags: Array<string>
  event_type: string
  show_rsvp_bar: boolean
  show_title_in_form: boolean
  max_capacity: number
  zoom_account_id: number | null
  zoom_meeting_id: number | null
  zoom_meeting_data: unknown | null
  zoom_join_before_host: boolean
  zoom_attendance_synced_at: string | null
  source_calendar_item_id: number | null
  paired_meci_id: number | null
  recurring_schedule_id: number | null
  mobilize_event_task_id: number | null
  rsvp_count: number
  attendance_count: number
  host_tools_url: string
  city_state_label: string | null
}

export interface StEvent {
  id: number
  title: string
  scope_id: number
  scope_type: string
  event_type: string
  location_name: string | null
  location_data: StLocationData | null
  tags: Array<string>
  campaign_tags: Array<string>
  event_sessions: Array<StEventSession>
  event_page_url: string
  event_page_id: number
  image_url: string | null
  description: string
  hide_address_until_rsvp: boolean
  show_in_web_calendars: boolean
  primary_event_id: number
  is_co_hosted_mirror: boolean
  created_at: string
}

/** The location fields shared across the sessions of one event. */
export interface AnchorLocation {
  location_name?: string
  location_address?: string
  // Shape matches `CreateSessionParams.coordinates`.
  coordinates?: { latitude: number; longitude: number }
}

// --- Throttling -------------------------------------------------------------

export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Pace requests at <=2 req/sec to match the read-path fetcher's throttle.
export const REQUEST_DELAY_MS = 500

// --- API calls --------------------------------------------------------------

const jsonCodec = <T extends z.core.$ZodType>(schema: T) =>
  z.codec(z.string(), schema, {
    decode: (jsonString, ctx) => {
      try {
        return JSON.parse(jsonString)
      } catch (err: any) {
        ctx.issues.push({
          code: 'invalid_format',
          format: 'json',
          input: jsonString,
          message: err.message,
        })
        return z.NEVER
      }
    },
    encode: (value) => JSON.stringify(value),
  })

// The API returns `location_data.coordinates` as a JSON-stringified `{lng, lat}`
// string; this schema parses that string and validates the shape.
const CoordinatesSchema = jsonCodec(
  z.object({ lat: z.number(), lng: z.number() }),
)

// Replace `location_data.coordinates` (a JSON string from the API) with the
// parsed object in place, or null when absent/invalid.
function parseCoordinates(
  locationData: StLocationData | null,
  lonlat: string | null,
): StCoordinates | null {
  const result = CoordinatesSchema.safeParse(locationData?.coordinates)
  if (result.success) {
    return result.data
  }

  if (lonlat) {
    const match = lonlat.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/)
    if (match) {
      const lng = parseFloat(match[1]!)
      const lat = parseFloat(match[2]!)
      if (!isNaN(lng) && !isNaN(lat)) {
        return { lng, lat }
      }
    }
  }

  return null
}

/** List every ST event (with its sessions and tags), following pagination. */
export async function fetchAllEvents(apiKey: string): Promise<Array<StEvent>> {
  const baseUrl = 'https://api.solidarity.tech/v1/events'
  const limit = 100
  let offset = 0
  const all: Array<StEvent> = []

  while (true) {
    const start = Date.now()
    const res = await fetch(
      `${baseUrl}?_limit=${limit}&_offset=${offset}&_since=0`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      },
    )
    if (!res.ok) {
      throw new Error(`Failed to fetch events: ${res.status} ${res.statusText}`)
    }
    const data = await res.json()
    const events: Array<StEvent> = Array.isArray(data)
      ? data
      : data.data || data.results || []
    if (events.length === 0) break

    for (const event of events) {
      // Events have no `lonlat` (it's session-level only).
      const coords = parseCoordinates(event.location_data, null)
      if (coords) {
        event.location_data ||= {}
        event.location_data.coordinates = coords
      }
      for (const session of event.event_sessions ?? []) {
        const sessionCoords = parseCoordinates(
          session.location_data,
          session.lonlat,
        )
        if (sessionCoords) {
          session.location_data ||= {}
          session.location_data.coordinates = sessionCoords
        }
      }
    }
    all.push(...events)
    offset += limit

    const elapsed = Date.now() - start
    if (elapsed < REQUEST_DELAY_MS) await sleep(REQUEST_DELAY_MS - elapsed)
  }
  return all
}

export interface CreateSessionParams {
  /** Parent ST event id to attach the session to. */
  eventId: number
  start: Date
  end: Date
  title: string
  locationName?: string
  locationAddress?: string
  // When provided, sent as `location_data: { lat, lng }`.
  coordinates?: { latitude: number; longitude: number }
  note?: string
  // Usually the parent event's tags, so the read-path fetcher classifies the
  // new session the same way.
  tags?: Array<string>
}

/** Create a session on an existing event. Returns the new session id. */
export async function createSession(
  apiKey: string,
  {
    eventId,
    start,
    end,
    title,
    locationName,
    locationAddress,
    coordinates,
    note,
    tags,
  }: CreateSessionParams,
): Promise<number> {
  const res = await fetch('https://api.solidarity.tech/v1/event_sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      event_id: eventId,
      event_type: 'in_person',
      title,
      // ST expects Unix seconds, not ISO strings.
      start_time: Math.floor(start.getTime() / 1000),
      end_time: Math.floor(end.getTime() / 1000),
      location_name: locationName,
      location_address: locationAddress,
      location_data: coordinates
        ? { lat: coordinates.latitude, lng: coordinates.longitude }
        : undefined,
      note: note || undefined,
      tags: tags ?? [],
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(
      `Failed to create session on event ${eventId}: ${res.status} ${res.statusText} ${body}`,
    )
  }

  const created = await res.json()
  const id = created?.data?.id
  if (!id) {
    throw new Error(`Session create on event ${eventId} returned no id`)
  }
  return id
}

/** Fetch a single event (with its sessions and parsed coordinates). */
export async function fetchEvent(
  apiKey: string,
  eventId: number,
): Promise<StEvent> {
  const res = await fetch(`https://api.solidarity.tech/v1/events/${eventId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) {
    throw new Error(
      `Failed to fetch event ${eventId}: ${res.status} ${res.statusText}`,
    )
  }
  const data = await res.json()
  const event: StEvent = data?.data ?? data
  for (const session of event.event_sessions ?? []) {
    const coords = parseCoordinates(session.location_data, session.lonlat)
    if (coords) {
      session.location_data ||= {}
      session.location_data.coordinates = coords
    }
  }
  return event
}

/** Delete an event session by id. */
export async function deleteSession(
  apiKey: string,
  sessionId: number,
): Promise<void> {
  const res = await fetch(
    `https://api.solidarity.tech/v1/event_sessions/${sessionId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    },
  )
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(
      `Failed to delete session ${sessionId}: ${res.status} ${res.statusText} ${body}`,
    )
  }
}
