import * as wmill from 'windmill-client'

interface LocationData {
  components: string
  coordinates: string
  address_city: string
  full_address: string
  address_state: string
  address_line_1: string
  address_country: string
  address_postal_code: string
}

interface EventSession {
  id: number
  primary_session_id?: number | null
  mobilize_event_id: number
  start_time: string
  end_time: string
  title: string
  created_at: string
  updated_at: string
  location_name: string
  location_data: LocationData
  lonlat: string | null
  location_address: string
  show_rsvp_bar: boolean
  show_title_in_form: boolean | null
  max_capacity: number
  note: string
  tags: Array<string>
  automation_status?: unknown
  zoom_account_id: number | null
  zoom_meeting_id: number | null
  zoom_meeting_data: any | null
  zoom_join_before_host: boolean
  zoom_attendance_synced_at: string | null
  rsvp_count: number
  attendance_count: number
  host_tools_url: string
}

interface Event {
  id: number
  title: string
  scope_id: number
  scope_type: string
  event_type: string
  location_name: string | null
  location_data: LocationData | null
  event_sessions: Array<EventSession>
  event_page_url: string
  event_page_id: number
  created_at: string
  tags: Array<string>
  automation_status?: unknown
}

// EventSession with the parent event's URL, page id, id and event-level tags attached
interface EventSessionWithUrl extends EventSession {
  event_title: string
  event_page_url: string
  event_page_id?: number
  // The parent event's id (shared across its sessions), used for the series id.
  parent_event_id: number
  event_tags: Array<string>
  event_type: string
  event_automation_status?: unknown
}

interface DatabaseEvent {
  stableEventId: string
  dedupeEventId: string
  eventSeriesId: string | null
  pageId: number | null
  // The campaign whose Solidarity Tech account these events were fetched from.
  // This is the account that owns `stableEventId`'s session, so it's the key the
  // RSVP worker must use to sign people up. Distinct from the `campaigns` display
  // list attached downstream (which can list co-hosting campaigns).
  sourceCampaign: string | null
  title: string
  start_time: string
  end_time: string
  location_name: string
  location_address: string
  rsvps: number
  lon: number
  lat: number
  url: string
  borough: string
  neighborhood: string | null
  // Deduplicated union of the parent event's tags and this session's tags.
  tags: Array<string>
  // Raw Solidarity Tech fields persisted as-is on the `event` table (st_* columns).
  stHostUrl: string | null
  stSessionNote: string | null
  stAttendanceCount: number | null
  stEventTitle: string | null
  stEventTags: Array<string>
  stSessionTags: Array<string>
  stEventType: string | null
  stShowTitleInForm: boolean | null
  stAutomationStatus: unknown
  stEventPageUrl: string | null
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Merge any number of tag lists into a single deduplicated array, dropping
// empty/falsy entries.
const dedupeTags = (
  ...lists: Array<Array<string> | undefined | null>
): Array<string> => [
  ...new Set(lists.flatMap((list) => list ?? []).filter(Boolean)),
]

// Parse borough from location_data.components JSON
const parseBorough = (session: EventSessionWithUrl): string => {
  if (!session.location_data?.components) {
    return ''
  }

  try {
    const components = JSON.parse(session.location_data.components)
    if (!Array.isArray(components)) {
      return ''
    }
    // Find the component with sublocality type (borough)
    const boroughComponent = components.find(
      (c: { types?: Array<string> }) =>
        c.types?.includes('sublocality') ||
        c.types?.includes('sublocality_level_1'),
    )
    return boroughComponent?.long_name || ''
  } catch {
    return ''
  }
}

// Parse neighborhood from location_data.components JSON
const parseNeighborhood = (session: EventSessionWithUrl): string | null => {
  if (!session.location_data?.components) {
    return null
  }
  try {
    const components = JSON.parse(session.location_data.components)
    if (!Array.isArray(components)) {
      return null
    }
    // Find the component tagged as a neighborhood (e.g. "Bedford-Stuyvesant")
    const neighborhoodComponent = components.find(
      (c: { types?: Array<string> }) => c.types?.includes('neighborhood'),
    )
    return neighborhoodComponent?.long_name ?? null
  } catch {
    return null
  }
}

// Parse coordinates from lonlat WKT string or location_data.coordinates JSON
const parseCoordinates = (
  session: EventSessionWithUrl,
): { lon: number; lat: number } | null => {
  // Try lonlat WKT POINT string first (format: "POINT (lon lat)")
  if (session.lonlat) {
    const match = session.lonlat.match(
      /POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/,
    )
    if (match) {
      const lon = parseFloat(match[1]!)
      const lat = parseFloat(match[2]!)
      if (!isNaN(lon) && !isNaN(lat)) {
        return { lon, lat }
      }
    }
  }
  // Try parsing location_data.coordinates as JSON
  if (session.location_data?.coordinates) {
    try {
      const coords = JSON.parse(session.location_data.coordinates)
      if (typeof coords.lng === 'number' && typeof coords.lat === 'number') {
        return { lon: coords.lng, lat: coords.lat }
      }
    } catch {
      // Not valid JSON, ignore
    }
  }
  return null
}

export async function main(
  apiKey: string,
  requireTags: Array<string>,
  excludeTags: Array<string> = [],
  includeTitleSubstrings: Array<string> = [],
  debugTitleSubstring: string = '',
  // Campaign whose API key this run uses; stamped onto every event as
  // `sourceCampaign` so the RSVP worker knows which ST account owns the session.
  campaignName: string = '',
): Promise<{
  included: Array<DatabaseEvent>
  excluded: Array<{ event: DatabaseEvent; reason: string }>
}> {
  const baseUrl = 'https://api.solidarity.tech/v1/events'
  const apiKeyValue = await wmill.getVariable(apiKey)
  const limit = 100
  const minDelayMs = 500 // 500ms = 2 requests per second
  let offset = 0
  const allEventSessions: Array<EventSessionWithUrl> = []
  const excludedSessions: Array<{
    session: EventSessionWithUrl
    reason: string
  }> = []

  const phonebankStrings = ['phone bank', 'phonebank']

  while (true) {
    const startTime = Date.now()

    const url = `${baseUrl}?_limit=${limit}&_offset=${offset}&_since=0`

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKeyValue}`,
        'Content-Type': 'application/json',
      },
    })
    if (!response.ok) {
      throw new Error(
        `Failed to fetch events: ${response.status} ${response.statusText}`,
      )
    }
    const data = await response.json()

    // Extract the events array from the response
    const events: Array<Event> = Array.isArray(data)
      ? data
      : data.data || data.results || []

    console.log(`Found ${events.length} events`)
    if (!events || events.length === 0) {
      break
    }

    // Flatten event_sessions from all events, attaching the parent event's URL
    for (const event of events) {
      console.log(
        `Processing event ${event.id} (${event.title}) - ${event.event_sessions?.length} sessions`,
      )

      // Check for required tags or title substring match across the event
      if (requireTags.length > 0 || includeTitleSubstrings.length > 0) {
        const allSessionTags = [
          ...(event.tags ?? []),
          ...(event.event_sessions || []).flatMap((s) => s.tags || []),
        ]
        const eventHasRequiredTag =
          requireTags.length > 0 &&
          allSessionTags.some((tag) => requireTags.includes(tag))

        const titleLower = event.title.toLowerCase()
        const titleMatchesSubstring =
          includeTitleSubstrings.length > 0 &&
          includeTitleSubstrings.some((sub) =>
            titleLower.includes(sub.toLowerCase()),
          )

        const isPhonebank = phonebankStrings.some((sub) =>
          titleLower.includes(sub.toLowerCase()),
        )

        if (!eventHasRequiredTag && !titleMatchesSubstring && !isPhonebank) {
          if (
            debugTitleSubstring &&
            event.title.includes(debugTitleSubstring)
          ) {
            console.log(
              `Excluding event ${event.id} (${
                event.title
              }): session tags [${allSessionTags.join(
                ', ',
              )}] do not match required tags [${requireTags.join(', ')}] and title does not match substrings [${includeTitleSubstrings.join(', ')}]`,
            )
          }
          for (const session of event.event_sessions || []) {
            excludedSessions.push({
              session: {
                ...session,
                event_title: event.title,
                event_page_url: event.event_page_url,
                event_page_id: event.event_page_id,
                parent_event_id: event.id,
                event_tags: event.tags || [],
                event_type: event.event_type,
                event_automation_status: event.automation_status,
              },
              reason: `Missing required tags: [${requireTags.join(', ')}] and title does not match substrings: [${includeTitleSubstrings.join(', ')}]`,
            })
          }
          continue
        }
      }

      for (const session of event.event_sessions || []) {
        if (
          debugTitleSubstring &&
          session.title.includes(debugTitleSubstring)
        ) {
          console.log(event.event_sessions)
        }

        if (
          phonebankStrings.some((s) =>
            event.title.toLocaleLowerCase().includes(s),
          ) ||
          phonebankStrings.some((s) =>
            session.title.toLocaleLowerCase().includes(s),
          )
        ) {
          session.lonlat ||= `POINT (-73.997725 40.730871)`
          session.tags ||= []
          session.tags.push('phonebank')
        }

        const sessionWithUrl: EventSessionWithUrl = {
          ...session,
          event_title: event.title,
          event_page_url: event.event_page_url,
          event_page_id: event.event_page_id,
          parent_event_id: event.id,
          event_tags: event.tags || [],
          event_type: event.event_type,
          event_automation_status: event.automation_status,
        }

        if (excludeTags.length > 0) {
          const sessionTags = [...(session.tags || []), ...(event.tags || [])]
          const hasExcludedTag = sessionTags.some((tag) =>
            excludeTags.includes(tag),
          )
          if (hasExcludedTag) {
            if (
              debugTitleSubstring &&
              session.title.includes(debugTitleSubstring)
            ) {
              console.log(
                `Excluding session ${session.id} (${session.title}): session tags [${sessionTags.join(
                  ', ',
                )}] match excluded tags [${excludeTags.join(', ')}]`,
              )
            }
            excludedSessions.push({
              session: sessionWithUrl,
              reason: `Excluded tags present: [${excludeTags.join(', ')}]`,
            })
            continue
          }
        }

        // Check for coordinates (either lonlat or location_data.coordinates)
        if (!session.lonlat && !session.location_data?.coordinates) {
          if (
            debugTitleSubstring &&
            session.title.includes(debugTitleSubstring)
          ) {
            console.log(
              `Excluding session ${session.id} (${session.title}): no coordinates (lonlat or location_data.coordinates)`,
            )
          }
          excludedSessions.push({
            session: sessionWithUrl,
            reason: 'Missing coordinates',
          })
          continue
        }

        allEventSessions.push(sessionWithUrl)
      }
    }

    if (events.length < limit) {
      break
    }

    offset += limit

    // Rate limiting: ensure at least 500ms between requests (2 requests per second)
    const elapsedTime = Date.now() - startTime
    if (elapsedTime < minDelayMs) {
      await sleep(minDelayMs - elapsedTime)
    }
  }

  // Filter for future events only
  const now = new Date()
  const futureSessions = allEventSessions.filter((session) => {
    const sessionDate = new Date(session.start_time)
    const isFuture = sessionDate > now
    if (!isFuture) {
      if (debugTitleSubstring && session.title.includes(debugTitleSubstring)) {
        console.log(
          `Excluding session ${session.id} (${session.title}): start_time ${session.start_time} is in the past`,
        )
      }
      excludedSessions.push({
        session,
        reason: `Start time ${session.start_time} is in the past`,
      })
    }
    return isFuture
  })

  const buildDatabaseEvent = (
    session: EventSessionWithUrl,
    coords: { lon: number; lat: number } | null,
  ): DatabaseEvent => {
    return {
      /*
       * From the docs ( https://www.solidarity.tech/reference/get_events ):
       * Each event in the response includes primary_event_id and is_co_hosted_mirror.
       * For co-hosted events that appear across multiple organizations, primary_event_id
       * always resolves to the original event ID, allowing you to identify that two
       * events from different scopes represent the same real world event. Each event
       * session also includes primary_session_id for the same purpose.
       * */
      stableEventId: `st.${session.id}`,
      dedupeEventId: `st.${session.primary_session_id ?? session.id}`,
      eventSeriesId: `st.${session.parent_event_id}`,
      pageId: session.event_page_id ?? null,
      sourceCampaign: campaignName || null,
      title: session.title,
      start_time: session.start_time,
      end_time: session.end_time || session.start_time,
      location_name: session.location_name || '',
      location_address:
        session.location_address || session.location_data?.full_address || '',
      rsvps: session.rsvp_count || 0,
      lon: coords?.lon ?? 0,
      lat: coords?.lat ?? 0,
      url: session.event_page_url ? `${session.event_page_url}/embed` : '',
      borough: parseBorough(session),
      neighborhood: parseNeighborhood(session),
      tags: dedupeTags(session.event_tags, session.tags),
      stHostUrl: session.host_tools_url || null,
      stSessionNote: session.note || null,
      stAttendanceCount: session.attendance_count ?? null,
      stEventTitle: session.event_title || null,
      stEventTags: session.event_tags ?? [],
      stSessionTags: session.tags ?? [],
      stEventType: session.event_type || null,
      stShowTitleInForm: session.show_title_in_form ?? null,
      stAutomationStatus:
        session.automation_status ?? session.event_automation_status ?? null,
      stEventPageUrl: session.event_page_url || null,
    }
  }

  const included: Array<DatabaseEvent> = []
  const excluded: Array<{ event: DatabaseEvent; reason: string }> = []

  for (const session of futureSessions) {
    if (!session.event_page_url) {
      excluded.push({
        event: buildDatabaseEvent(session, parseCoordinates(session)),
        reason: 'Missing event page URL',
      })
      continue
    }

    included.push(buildDatabaseEvent(session, parseCoordinates(session)))
  }

  for (const excludedSession of excludedSessions) {
    excluded.push({
      event: buildDatabaseEvent(
        excludedSession.session,
        parseCoordinates(excludedSession.session),
      ),
      reason: excludedSession.reason,
    })
  }

  if (debugTitleSubstring) {
    return {
      included: included.filter((e) => e.title.includes(debugTitleSubstring)),
      excluded: excluded.filter((e) =>
        e.event.title.includes(debugTitleSubstring),
      ),
    }
  }

  return { included, excluded }
}
