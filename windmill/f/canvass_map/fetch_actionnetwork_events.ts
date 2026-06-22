import * as wmill from 'windmill-client'

interface ActionNetworkLocation {
  venue?: string
  address_lines?: Array<string>
  locality?: string
  region?: string
  postal_code?: string
  country?: string
  location?: {
    latitude: number
    longitude: number
    accuracy?: string
  }
}

interface ActionNetworkEvent {
  identifiers: Array<string>
  created_date: string
  modified_date?: string
  title: string
  name?: string
  description?: string
  start_date: string
  end_date?: string
  status?: string
  transparence?: 'opaque' | 'transparent'
  visibility?: 'public' | 'private'
  guests_can_invite_others?: boolean
  capacity?: number
  total_accepted?: number
  origin_system?: string
  browser_url?: string
  instructions?: string
  location?: ActionNetworkLocation
  reminders?: Array<{
    method: string
    minutes: number
  }>
  'action_network:sponsor'?: {
    title: string
    browser_url: string
  }
  'action_network:hidden'?: boolean
  _links?: any

  // only for us to add
  internalTags?: Array<string>

  [key: string]: any
}

interface ActionNetworkResponse {
  total_pages: number
  per_page: number
  page: number
  total_records: number
  _links: any
  _embedded: {
    'osdi:events': Array<ActionNetworkEvent>
  }
}

interface DatabaseEvent {
  stableEventId: string
  dedupeEventId: string
  eventSeriesId: string | null
  pageId: number | null
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
  suffix: string | null
  // Action Network tags aren't fetched yet; emitted empty to keep the merged
  // event shape uniform with the Solidarity Tech source.
  tags: Array<string>
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function main(
  apiKey: string,
  titleFilterRegex?: string,
): Promise<{
  included: Array<DatabaseEvent>
  excluded: Array<{ event: DatabaseEvent; reason: string }>
}> {
  const baseUrl = 'https://actionnetwork.org/api/v2/events'
  const apiKeyValue = await wmill.getVariable(apiKey)
  const perPage = 25
  const minDelayMs = 1000 // 1 second = 1 request per second (conservative rate limit)
  let page = 1
  const allEvents: Array<ActionNetworkEvent> = []
  const excludedEvents: Array<{ event: ActionNetworkEvent; reason: string }> =
    []

  // Compile regex if provided
  const titleRegex = titleFilterRegex ? new RegExp(titleFilterRegex, 'i') : null

  while (true) {
    const startTime = Date.now()

    const url = `${baseUrl}?page=${page}&per_page=${perPage}`

    const response = await fetch(url, {
      headers: {
        'OSDI-API-Token': apiKeyValue,
        'Content-Type': 'application/json',
      },
    })
    if (!response.ok) {
      throw new Error(
        `Failed to fetch events: ${response.status} ${response.statusText}`,
      )
    }
    const data: ActionNetworkResponse = await response.json()

    const events = data._embedded['osdi:events'] || []

    if (!events || events.length === 0) {
      break
    }

    // Filter events that have latitude and longitude defined, and match title regex if provided
    for (const event of events) {
      const isPhonebank = ['phonebank', 'phone bank'].some((s) =>
        event.title.toLocaleLowerCase().includes(s),
      )
      if (isPhonebank) {
        event.location ||= {}
        event.location.location ||= {
          latitude: 40.730871,
          longitude: -73.997725,
        }
        event.internalTags = ['phonebank']
      }

      const latitude = event.location?.location?.latitude
      const longitude = event.location?.location?.longitude

      if (
        latitude === undefined ||
        longitude === undefined ||
        typeof latitude !== 'number' ||
        typeof longitude !== 'number'
      ) {
        excludedEvents.push({
          event,
          reason: 'Missing coordinates',
        })
        continue
      }

      if (
        titleRegex &&
        event.title &&
        !titleRegex.test(event.title) &&
        !isPhonebank
      ) {
        excludedEvents.push({
          event,
          reason: `Title does not match regex: ${titleFilterRegex}`,
        })
        continue
      }

      allEvents.push(event)
    }

    // Check if we've reached the last page
    if (page >= data.total_pages) {
      break
    }

    page++

    // Rate limiting: ensure at least 1 second between requests
    const elapsedTime = Date.now() - startTime
    if (elapsedTime < minDelayMs) {
      await sleep(minDelayMs - elapsedTime)
    }
  }

  // Filter for future and public events only
  const now = new Date()
  const futureEvents = allEvents.filter((event) => {
    const eventDate = new Date(event.start_date.replace('Z', '-04:00'))
    const isFuture = eventDate > now
    const isPublic = event.visibility === 'public'
    if (!isFuture) {
      excludedEvents.push({
        event,
        reason: `Start time ${event.start_date} is in the past`,
      })
    }
    if (!isPublic) {
      excludedEvents.push({
        event,
        reason: `Event visibility is ${event.visibility || 'unknown'}`,
      })
    }
    return isFuture && isPublic
  })

  const buildDatabaseEvent = (event: ActionNetworkEvent): DatabaseEvent => {
    const location = event.location || {}
    const addressParts = [
      location.venue,
      ...(location.address_lines || []),
      location.locality,
      location.region,
      location.postal_code,
    ].filter(Boolean)

    // Action Network identifiers are globally deduped across groups and API
    // keys; the `action_network:<uuid>` one is the canonical native id.
    const anIdentifier = (event.identifiers || []).find((i) =>
      i.toLowerCase().startsWith('action_network:'),
    )
    const stableIdSuffix = anIdentifier
      ? anIdentifier.slice('action_network:'.length)
      : (event.identifiers?.[0] ?? event.browser_url ?? '')

    let effectiveUrl
    if (event.browser_url) {
      const iframeUrl = new URL(
        event.browser_url.replace(
          'https://actionnetwork.org/events/',
          'https://actionnetwork.org/widgets/v6/event/',
        ),
      )
      iframeUrl.searchParams.append('clear_id', 'true')
      effectiveUrl = iframeUrl.toString()
    } else {
      effectiveUrl = ''
    }

    return {
      stableEventId: `an.${stableIdSuffix}`,
      dedupeEventId: `an.${stableIdSuffix}`,
      // Action Network has no event-series or event-page concept.
      eventSeriesId: null,
      pageId: null,
      title: event.title,
      start_time: event.start_date.replace('Z', '-04:00'),
      end_time: (event.end_date || event.start_date).replace('Z', '-04:00'),
      location_name: location.venue || '',
      location_address: addressParts.join(', '),
      rsvps: event.total_accepted || 0,
      lon: event.location?.location?.longitude || 0,
      lat: event.location?.location?.latitude || 0,
      url: effectiveUrl,
      borough: '', // Will need to be determined separately
      suffix: 'action_network',
      tags: [
        ...(event.internalTags ?? []),

        ...(event.name?.includes('GOTV') || event.title.includes('GOTV')
          ? ['gotv']
          : []),
      ],
    }
  }

  const included = futureEvents.map(buildDatabaseEvent)
  const excluded = excludedEvents.map(({ event, reason }) => ({
    event: buildDatabaseEvent(event),
    reason,
  }))

  return { included, excluded }
}
