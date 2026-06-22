// there are multiple modes to add as header: //nobundling //native //npm //nodejs
// https://www.windmill.dev/docs/getting_started/scripts_quickstart/typescript#modes

import { createClient } from '@a1liu/solidarity-tech-api'
import * as wmill from 'windmill-client'
import type {
  SolidarityClient,
  StEventSession,
} from '@a1liu/solidarity-tech-api'

// fill the type, or use the +Resource type to get a type-safe reference to a resource
// type Postgresql = object

type Postgresql = {
  host: string
  port: number
  user: string
  dbname: string
  region: string
  sslmode: string
  password: string
  use_iam_auth: boolean
  root_certificate_pem: string
}

// EventSession with the parent event's URL, page id, id and event-level tags attached
interface EventSessionWithUrl extends StEventSession {
  event_title: string
  event_page_url?: string
  event_page_id?: number
  // The parent event's id (shared across its sessions), used for the series id.
  parent_event_id: number
  event_tags: Array<string>
  event_type: string
  combined_tags: Set<string>
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
  location_name: string | null
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

// Merge any number of tag lists into a single deduplicated array, dropping
// empty/falsy entries.
const dedupeTags = (
  ...lists: Array<Array<string> | undefined | null>
): Array<string> => [
  ...new Set(lists.flatMap((list) => list ?? []).filter(Boolean)),
]

// Parse borough from location_data.components JSON
const parseBorough = (session: EventSessionWithUrl): string => {
  const boroughComponent = session.location_data?.components?.find(
    (c) =>
      c.types.includes('sublocality') ||
      c.types.includes('sublocality_level_1'),
  )

  // Find the component with sublocality type (borough)
  return boroughComponent?.long_name || ''
}

// Parse neighborhood from location_data.components JSON
const parseNeighborhood = (session: EventSessionWithUrl): string | null => {
  const neighborhoodComponent = session.location_data?.components?.find((c) =>
    c.types.includes('neighborhood'),
  )

  // Find the component tagged as a neighborhood (e.g. "Bedford-Stuyvesant")
  return neighborhoodComponent?.long_name ?? null
}

// Parse coordinates from lonlat WKT string or location_data.coordinates JSON
const parseCoordinates = (
  session: EventSessionWithUrl,
): { lon: number; lat: number } | null => {
  const coords = session.location_data?.coordinates
  if (coords) {
    return { lon: coords.lng, lat: coords.lat }
  }

  // Try lonlat WKT POINT string first (format: "POINT (lon lat)")
  if (session.lonlat) {
    const match = session.lonlat.match(
      /POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/,
    )
    if (match) {
      const [lon, lat] = [parseFloat(match[1]!), parseFloat(match[2]!)]
      if (!isNaN(lon) && !isNaN(lat)) {
        return { lon, lat }
      }
    }
  }

  return null
}

async function* paginateQuery<T>({
  pageSize,
  queryFn,
}: {
  pageSize: number
  queryFn: (page: {
    offset: number
    limit: number
  }) => Promise<{ values: Array<T> }>
}): AsyncGenerator<T> {
  const limit = pageSize
  let offset = 0
  while (true) {
    const { values } = await queryFn({ offset, limit })

    yield* values

    if (values.length < limit) {
      break
    }

    offset += limit
  }
}

async function* sessionsGen(
  client: SolidarityClient,
): AsyncGenerator<EventSessionWithUrl> {
  const _since = new Date().getTime() / 1000 - 60 * 60
  const minDelayMs = 500 // 500ms = 2 requests per second

  const prevStart = 0

  const queryGen = paginateQuery({
    pageSize: 100,
    queryFn: async ({ offset: _offset, limit: _limit }) => {
      const startTime = Date.now()
      // Rate limiting: ensure at least 500ms between requests (2 requests per second)
      const elapsedTime = startTime - prevStart
      if (elapsedTime < minDelayMs) {
        await wmill.sleep((minDelayMs - elapsedTime) / 1000)
      }

      const response = await client.listEvents({ _limit, _offset, _since })
      if (!response.ok) {
        throw new Error(
          `Failed to fetch events: ${response.status} ${JSON.stringify(response.error)}`,
        )
      }

      // Extract the events array from the response
      const events = response.data.data
      return { values: events }
    },
  })

  for await (const event of queryGen) {
    console.log(
      `Processing event ${event.id} (${event.title}) - ${event.event_sessions?.length} sessions`,
    )

    yield* event.event_sessions.map((s) => ({
      ...s,
      event_title: event.title,
      event_page_url: event.event_page_url ?? undefined,
      event_page_id: event.event_page_id ?? undefined,
      parent_event_id: event.id,
      event_tags: event.tags,
      combined_tags: new Set(s.tags.concat(event.tags)),
      event_type: event.event_type,
      event_automation_status: event.automation_status,
    }))
  }
}

const buildDatabaseEvent = (
  session: EventSessionWithUrl,
  campaignName: string,
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
    stAutomationStatus: session.event_automation_status ?? null,
    stEventPageUrl: session.event_page_url || null,
  }
}

export async function main(
  _pg: Postgresql,
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
  const apiKeyValue = await wmill.getVariable(apiKey)

  const client = createClient({ apiKey: apiKeyValue })

  const allEventSessions: Array<EventSessionWithUrl> = []
  const excludedSessions: Array<{
    session: EventSessionWithUrl
    reason: string
  }> = []

  const phonebankStrings = ['phone bank', 'phonebank']

  for await (const session of sessionsGen(client)) {
    const sessionTags = session.combined_tags

    function debugPrint(text: string) {
      if (debugTitleSubstring && session.title.includes(debugTitleSubstring)) {
        console.log(text)
      }
    }

    if (excludeTags.length > 0) {
      const hasExcludedTag = excludeTags.some((tag) => sessionTags.has(tag))
      if (hasExcludedTag) {
        debugPrint(
          `Excluding session ${session.id} (${session.title}): session tags [${[
            ...sessionTags,
          ].join(', ')}] match excluded tags [${excludeTags.join(', ')}]`,
        )

        excludedSessions.push({
          session,
          reason: `Excluded tags present: [${excludeTags.join(', ')}]`,
        })
        continue
      }
    }

    // Check for required tags or title substring match across the event
    if (requireTags.length > 0 || includeTitleSubstrings.length > 0) {
      const eventHasRequiredTag =
        requireTags.length > 0 &&
        requireTags.some((tag) => sessionTags.has(tag))

      const titleLower = session.event_title.toLowerCase()
      const titleMatchesSubstring =
        includeTitleSubstrings.length > 0 &&
        includeTitleSubstrings.some((sub) =>
          titleLower.includes(sub.toLowerCase()),
        )

      const isPhonebank = phonebankStrings.some((sub) =>
        titleLower.includes(sub.toLowerCase()),
      )

      if (!eventHasRequiredTag && !titleMatchesSubstring && !isPhonebank) {
        debugPrint(
          `Excluding event ${session.parent_event_id} (${
            session.event_title
          }): session tags [${[...sessionTags].join(
            ', ',
          )}] do not match required tags [${requireTags.join(', ')}] and title does not match substrings [${includeTitleSubstrings.join(', ')}]`,
        )

        excludedSessions.push({
          session,
          reason: `Missing required tags: [${requireTags.join(', ')}] and title does not match substrings: [${includeTitleSubstrings.join(', ')}]`,
        })
        continue
      }
    }

    if (
      phonebankStrings.some((s) =>
        session.event_title.toLocaleLowerCase().includes(s),
      ) ||
      phonebankStrings.some((s) =>
        session.title.toLocaleLowerCase().includes(s),
      )
    ) {
      session.lonlat ||= `POINT (-73.997725 40.730871)`
      session.tags ||= []
      session.tags.push('phonebank')
    }

    // Check for coordinates (either lonlat or location_data.coordinates)
    if (!session.lonlat && !session.location_data?.coordinates) {
      debugPrint(
        `Excluding session ${session.id} (${session.title}): no coordinates (lonlat or location_data.coordinates)`,
      )
      excludedSessions.push({ session, reason: 'Missing coordinates' })
      continue
    }

    if (!session.event_page_url) {
      excludedSessions.push({ session, reason: 'Missing event page URL' })
      continue
    }

    allEventSessions.push(session)
  }

  const included = allEventSessions.map((s) =>
    buildDatabaseEvent(s, campaignName, parseCoordinates(s)),
  )
  const excluded: Array<{ event: DatabaseEvent; reason: string }> =
    excludedSessions.map((s) => ({
      event: buildDatabaseEvent(
        s.session,
        campaignName,
        parseCoordinates(s.session),
      ),
      reason: s.reason,
    }))

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
