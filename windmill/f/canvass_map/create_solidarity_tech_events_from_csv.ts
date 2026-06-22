import Papa from 'papaparse'
import {
  REQUEST_DELAY_MS,
  createSession,
  fetchEvent,
  sleep,
} from './utils/st_api'
import type { AnchorLocation, StEvent } from './utils/st_api'

/**
 * Add Solidarity Tech *event sessions* to existing GOTV events, on a schedule
 * driven by a CSV.
 *
 * The events themselves are NOT created here anymore. They already exist in
 * Solidarity Tech, tagged `GOTV`, and each one is additionally tagged with its
 * *staging location* (e.g. `Williamsburg`, `Greenpoint`). Each GOTV event also
 * already has at least one session — we read that session's location and reuse
 * it for every new session we create on that event.
 *
 * The schedule lives in the hard-coded `CSV` below (mirrors
 * `Big NY7 GOTV Recommended cadence - Claire.csv` at the repo root). Each row is
 * one session to create. Rows are correlated to a GOTV event by the
 * `Staging Location` column, which must match one of the event's tags.
 *
 * Per row:
 *   - `In ST?` = `x`  -> the slot already exists in ST (it's the anchor session
 *                        whose location we read). Skipped — not re-created.
 *   - `Delete?` = `x` -> skipped (out of scope here).
 *   - `Type`          -> added as session tag(s) ("&"-split), alongside the
 *                        event's inherited tags.
 *
 * Endpoints (https://www.solidarity.tech/reference):
 *   - GET  /v1/events          (list events + their sessions/tags)
 *   - POST /v1/event_sessions  (create a session on an existing event)
 * Session start/end times are sent as Unix-second integers; `event_type` is the
 * enum `in_person`.
 */

// --- Hard-coded inputs ------------------------------------------------------

// Schedule dates in the CSV are `M/D` with no year; all fall in June 2026, which
// is daylight time in ET (UTC-04:00). Pasted verbatim from the source sheet.
const SCHEDULE_YEAR = 2026
const ET_OFFSET = '-04:00'

// --- CSV parsing ------------------------------------------------------------

interface ScheduleRow {
  stagingLocation: string
  parentEventId: number
  toDelete: string
  date: string
  startTime: string
  endTime: string
  type: string
  eventLocation: string
  sessionTitle: string
  sessionNote: string
}

// Maps the raw CSV headers to the simple `ScheduleRow` keys. Headers not listed
// (Campaign, Source, Day, Location address, Internal notes) are dropped.
const HEADER_MAP: Record<string, keyof ScheduleRow> = {
  'Staging Location': 'stagingLocation',
  'Parent Event ID': 'parentEventId',
  'Delete?': 'toDelete',
  Date: 'date',
  'Start Time': 'startTime',
  'End Time': 'endTime',
  'Event Location': 'eventLocation',
  'Location address': 'eventLocation',
  Type: 'type',
  'Event session title': 'sessionTitle',
  'Event session note (launch site)': 'sessionNote',
}

function parseCsv(text: string): Array<ScheduleRow> {
  const result = Papa.parse<ScheduleRow>(text.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => HEADER_MAP[h.trim()] ?? h.trim(),
    transform: (value) => value.trim(),
  })
  if (result.errors.length > 0) {
    throw new Error(
      `Failed to parse CSV: ${result.errors.map((e) => e.message).join('; ')}`,
    )
  }

  const values = result.data.map((val) => {
    const parentEventId = Number(val.parentEventId)
    if (Number.isNaN(parentEventId)) throw new Error('parse failure')
    return {
      ...val,
      parentEventId,
    }
  })

  return values
}

const normalize = (s: string): string => s.trim().toLowerCase()

// The ST `event_type` every session here is created with; also part of the
// idempotency key so it lines up with existing sessions.
const SESSION_EVENT_TYPE = 'in_person'

// Idempotency key for a session. A row whose key matches an existing session on
// the event is treated as already created (same parent event + time window +
// type + tags), so we don't duplicate it.
function sessionKey(parts: {
  parentEventId: number
  startUnix: number
  endUnix: number
  type: string
  tags: Array<string>
}): string {
  return [
    parts.parentEventId,
    parts.startUnix,
    parts.endUnix,
    normalize(parts.type),
    [...parts.tags].map(normalize).sort().join(','),
  ].join('|')
}

// --- Schedule time parsing --------------------------------------------------

// The ST API takes start_time/end_time as Unix seconds, not ISO strings.
function toUnixSeconds(iso: string): number {
  return Math.floor(new Date(iso).getTime() / 1000)
}

const pad = (n: number): string => String(n).padStart(2, '0')

/**
 * Convert a CSV `Date` (`M/D`, year-less) + `Start/End Time` (`h:mm AM/PM`) into
 * a `Date`, anchored to `SCHEDULE_YEAR` in ET (`ET_OFFSET`).
 */
function rowTimeToDate(dateCell: string, timeCell: string): Date {
  const [monthStr, dayStr] = dateCell.split('/')
  const month = Number(monthStr)
  const day = Number(dayStr)

  const m = timeCell.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  const hourStr = m?.[1]
  const minuteStr = m?.[2]
  const meridiem = m?.[3]?.toUpperCase()
  if (!hourStr || !minuteStr || !meridiem) {
    throw new Error(
      `Unparseable schedule date/time: "${dateCell}" "${timeCell}"`,
    )
  }
  let hour = Number(hourStr)
  const minute = Number(minuteStr)
  if (meridiem === 'PM' && hour !== 12) hour += 12
  if (meridiem === 'AM' && hour === 12) hour = 0

  const iso = `${SCHEDULE_YEAR}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00${ET_OFFSET}`
  return new Date(iso)
}

// --- GOTV event matching ----------------------------------------------------

interface EventTarget {
  event: StEvent
  location: AnchorLocation
  existingKeys: Set<string>
}

/**
 * Build the per-event target used to create sessions: the anchor location
 * (reused for new sessions) and the keys of existing sessions (for dedup).
 */
function buildEventTarget(event: StEvent): EventTarget {
  const sessions = event.event_sessions ?? []
  // Anchor session: the first one that actually carries a location.
  const anchor =
    sessions.find((s) => s.location_data?.coordinates) ||
    sessions.find((s) => s.lonlat)
  const coords = anchor?.location_data?.coordinates
  if (!coords) {
    throw new Error('missing coords' + event.id)
  }

  return {
    event,
    location: {
      location_name: anchor?.location_name || undefined,
      location_address: anchor?.location_address || undefined,
      coordinates: { latitude: coords.lat, longitude: coords.lng },
    },
    // Keys of the event's existing sessions, so we never duplicate one.
    existingKeys: new Set(
      sessions.map((s) =>
        sessionKey({
          parentEventId: event.id,
          startUnix: toUnixSeconds(s.start_time),
          endUnix: toUnixSeconds(s.end_time),
          type: s.event_type,
          tags: s.tags ?? [],
        }),
      ),
    ),
  }
}

// --- Entry point ------------------------------------------------------------

/**
 * @param apiKey   Windmill variable *path* holding the ST API key (resolved via
 *                 wmill.getVariable), matching the fetcher's convention.
 * @param dryRun   When true, fetch + match + log what *would* be created without
 *                 POSTing any sessions.
 */
export async function main(
  apiKey: string,
  dryRun: boolean = false,
): Promise<{
  created: Array<{
    stagingLocation: string
    eventId: number
    sessionIds: Array<number>
  }>
  skipped: Array<{ stagingLocation: string; reason: string; rows: number }>
}> {
  const apiKeyValue = apiKey
  const rows = parseCsv(getCSV())

  // Group eligible rows by their `Parent Event ID`; we fetch that event directly
  // and add the rows' sessions to it. Drops anchor/delete rows and rows with no
  // valid id.
  interface RowGroup {
    rows: Array<ScheduleRow>
    label: string
    eventId: number
  }
  const groups = new Map<number, RowGroup>()
  const skipped: Array<{
    stagingLocation: string
    reason: string
    rows: number
  }> = []
  for (const row of rows) {
    const eventId = row.parentEventId

    const group = groups.get(eventId) ?? {
      rows: [],
      label: row.stagingLocation || `event ${eventId}`,
      eventId,
    }
    group.rows.push(row)
    groups.set(eventId, group)
  }

  const created: Array<{
    stagingLocation: string
    eventId: number
    sessionIds: Array<number>
  }> = []

  for (const group of groups.values()) {
    const displayName = group.label
    let target: EventTarget
    try {
      target = buildEventTarget(await fetchEvent(apiKeyValue, group.eventId))
    } catch (err) {
      console.warn(
        `Failed to fetch event ${group.eventId} ("${displayName}"); skipping ${group.rows.length} row(s): ${String(err)}`,
      )
      skipped.push({
        stagingLocation: displayName,
        reason: 'event fetch failed',
        rows: group.rows.length,
      })
      continue
    }

    const { event, location, existingKeys } = target
    const sessionIds: Array<number> = []

    for (const row of group.rows) {
      const start = rowTimeToDate(row.date, row.startTime)
      const end = rowTimeToDate(row.date, row.endTime)
      // Inherit the parent event's tags, plus a "Bulk Created" marker.
      const tags = [...new Set([...event.tags, 'Bulk Created'])]
      const rowKey = sessionKey({
        parentEventId: event.id,
        startUnix: Math.floor(start.getTime() / 1000),
        endUnix: Math.floor(end.getTime() / 1000),
        type: SESSION_EVENT_TYPE,
        tags,
      })

      if (existingKeys.has(rowKey)) {
        console.log(
          `  [${displayName}] session at ${row.date} ${row.startTime} already exists; skipping.`,
        )
        continue
      }

      const note = row.sessionNote || undefined

      existingKeys.add(rowKey)

      const session = {
        eventId: event.id,
        // Use the per-row session title when present, else the event's title.
        title: row.sessionTitle,
        tags,
        // locationName: '',
        locationAddress: row.eventLocation || location.location_address,
        coordinates: location.coordinates,
        start,
        end,
        note,
      }
      if (dryRun) {
        console.log(
          `  [dry-run] [${displayName}] would add session to event ${event.id} at ${row.date} ${row.startTime}–${row.endTime}`,
        )
        console.log('      ', JSON.stringify(session))
        sessionIds.push(0)
        continue
      }

      const sessionId = await createSession(apiKeyValue, session)
      console.log(
        `  [${displayName}] created session ${sessionId} on event ${event.id} (${row.date} ${row.startTime}–${row.endTime})`,
      )
      sessionIds.push(sessionId)
      await sleep(REQUEST_DELAY_MS)
    }

    created.push({
      stagingLocation: displayName,
      eventId: event.id,
      sessionIds,
    })
  }

  return { created, skipped }
}

function getCSV(): string {
  return CSV
}

// Mirrors `Big NY7 GOTV Recommended cadence - Claire.csv`. The Windmill runtime
// can't read repo files, so the schedule is embedded here. If the sheet changes,
// re-paste it. No cell contains a comma, so no CSV quoting is needed.
const CSV = `
ID,Campaign,Staging Location,Source,In ST?,Delete?,Parent Event ID,Date,Day,Start Time,End Time,Type,Location address,Event session title,Event session note (launch site),Internal notes
1,David,Ridgewood,Claire rec,,,20632,6/13,Sat,9:00 AM,12:00 PM,PSV,"Ridgewood, Queens, NY, USA","Canvass for Claire, Aber, David, and Samantha in Ridgewood!","David for Queens HQ (60-40 Myrtle Avenue, Ridgewood, NY, USA)",
2,David,Ridgewood,Claire rec,x,,20632,6/13,Sat,12:00 PM,3:00 PM,Canvass & PSV,"Ridgewood, Queens, NY, USA","Canvass for Claire, Aber, David, and Samantha in Ridgewood!","David for Queens HQ (60-40 Myrtle Avenue, Ridgewood, NY, USA)",
3,David,Ridgewood,Claire rec,,,20632,6/13,Sat,3:00 PM,6:00 PM,Canvass & PSV,"Ridgewood, Queens, NY, USA","Canvass for Claire, Aber, David, and Samantha in Ridgewood!","David for Queens HQ (60-40 Myrtle Avenue, Ridgewood, NY, USA)",
4,David,Ridgewood,Claire rec,,,20632,6/14,Sun,9:00 AM,12:00 PM,PSV,"Ridgewood, Queens, NY, USA","Canvass for Claire, Aber, David, and Samantha in Ridgewood!","David for Queens HQ (60-40 Myrtle Avenue, Ridgewood, NY, USA)",
5,David,Ridgewood,Claire rec,,,20632,6/14,Sun,12:00 PM,3:00 PM,Canvass & PSV,"Ridgewood, Queens, NY, USA","Canvass for Claire, Aber, David, and Samantha in Ridgewood!","David for Queens HQ (60-40 Myrtle Avenue, Ridgewood, NY, USA)",with JVPA for Aber Kawas and Samantha Kattan
6,David,Ridgewood,Claire rec,,,20632,6/14,Sun,3:00 PM,6:00 PM,Canvass & PSV,"Ridgewood, Queens, NY, USA","Canvass for Claire, Aber, David, and Samantha in Ridgewood!","David for Queens HQ (60-40 Myrtle Avenue, Ridgewood, NY, USA)",
7,David,Ridgewood,Claire rec,,,20632,6/15,Mon,5:30 PM,8:30 PM,Canvass & PSV,"Ridgewood, Queens, NY, USA","Canvass for Claire, Aber, David, and Samantha in Ridgewood!","David for Queens HQ (60-40 Myrtle Avenue, Ridgewood, NY, USA)",
8,David,Ridgewood,Claire rec,,,20632,6/17,Wed,5:30 PM,8:30 PM,Canvass & PSV,"Ridgewood, Queens, NY, USA","Canvass for Claire, Aber, David, and Samantha in Ridgewood!","David for Queens HQ (60-40 Myrtle Avenue, Ridgewood, NY, USA)",
9,David,Ridgewood,Claire rec,,,20632,6/18,Thu,5:30 PM,8:30 PM,Canvass & PSV,"Ridgewood, Queens, NY, USA","Canvass for Claire, Aber, David, and Samantha in Ridgewood!","David for Queens HQ (60-40 Myrtle Avenue, Ridgewood, NY, USA)",
10,David,Ridgewood,Claire rec,,,20632,6/20,Sat,9:00 AM,12:00 PM,PSV,"Ridgewood, Queens, NY, USA","Canvass for Claire, Aber, David, and Samantha in Ridgewood!","David for Queens HQ (60-40 Myrtle Avenue, Ridgewood, NY, USA)",
11,David,Ridgewood,Claire rec,x,,20632,6/20,Sat,12:00 PM,3:00 PM,Canvass & PSV,"Ridgewood, Queens, NY, USA","Canvass for Claire, Aber, David, and Samantha in Ridgewood!","David for Queens HQ (60-40 Myrtle Avenue, Ridgewood, NY, USA)",with UAW
12,David,Ridgewood,Claire rec,,,20632,6/20,Sat,3:00 PM,6:00 PM,Canvass & PSV,"Ridgewood, Queens, NY, USA","Canvass for Claire, Aber, David, and Samantha in Ridgewood!","David for Queens HQ (60-40 Myrtle Avenue, Ridgewood, NY, USA)",
13,David,Ridgewood,Claire rec,,,20632,6/20,Sat,6:00 PM,9:00 PM,Canvass,"Ridgewood, Queens, NY, USA","Canvass for Claire, Aber, David, and Samantha in Ridgewood!","David for Queens HQ (60-40 Myrtle Avenue, Ridgewood, NY, USA)",
14,David,Ridgewood,Claire rec,,,20632,6/21,Sun,9:00 AM,12:00 PM,PSV,"Ridgewood, Queens, NY, USA","Canvass for Claire, Aber, David, and Samantha in Ridgewood!","David for Queens HQ (60-40 Myrtle Avenue, Ridgewood, NY, USA)",
15,David,Ridgewood,Claire rec,x,,20632,6/21,Sun,12:00 PM,3:00 PM,Canvass & PSV,"Ridgewood, Queens, NY, USA","Canvass for Claire, Aber, David, and Samantha in Ridgewood!","David for Queens HQ (60-40 Myrtle Avenue, Ridgewood, NY, USA)",with JVPA & with JFREJ 
16,David,Ridgewood,Claire rec,,,20632,6/21,Sun,3:00 PM,6:00 PM,Canvass & PSV,"Ridgewood, Queens, NY, USA","Canvass for Claire, Aber, David, and Samantha in Ridgewood!","David for Queens HQ (60-40 Myrtle Avenue, Ridgewood, NY, USA)",
17,David,Ridgewood,Claire rec,,,20632,6/21,Sun,6:00 PM,9:00 PM,Canvass,"Ridgewood, Queens, NY, USA","Canvass for Claire, Aber, David, and Samantha in Ridgewood!","David for Queens HQ (60-40 Myrtle Avenue, Ridgewood, NY, USA)",
18,David,Ridgewood,Claire rec,,,20632,6/22,Mon,12:00 PM,3:00 PM,Canvass,"Ridgewood, Queens, NY, USA","Canvass for Claire, Aber, David, and Samantha in Ridgewood!","David for Queens HQ (60-40 Myrtle Avenue, Ridgewood, NY, USA)",
19,David,Ridgewood,Claire rec,,,20632,6/22,Mon,3:00 PM,6:00 PM,Canvass,"Ridgewood, Queens, NY, USA","Canvass for Claire, Aber, David, and Samantha in Ridgewood!","David for Queens HQ (60-40 Myrtle Avenue, Ridgewood, NY, USA)",
20,David,Ridgewood,Claire rec,,,20632,6/22,Mon,6:00 PM,9:00 PM,Canvass,"Ridgewood, Queens, NY, USA","Canvass for Claire, Aber, David, and Samantha in Ridgewood!","David for Queens HQ (60-40 Myrtle Avenue, Ridgewood, NY, USA)",
21,David,Ridgewood,Claire rec,,,20632,6/23,Tue,6:00 AM,9:00 AM,PSV,"Ridgewood, Queens, NY, USA","Canvass for Claire, Aber, David, and Samantha in Ridgewood!","David for Queens HQ (60-40 Myrtle Avenue, Ridgewood, NY, USA)",
22,David,Ridgewood,Claire rec,,,20632,6/23,Tue,9:00 AM,12:00 PM,Canvass & PSV,"Ridgewood, Queens, NY, USA","Canvass for Claire, Aber, David, and Samantha in Ridgewood!","David for Queens HQ (60-40 Myrtle Avenue, Ridgewood, NY, USA)",
23,David,Ridgewood,Claire rec,,,20632,6/23,Tue,12:00 PM,3:00 PM,Canvass & PSV,"Ridgewood, Queens, NY, USA","Canvass for Claire, Aber, David, and Samantha in Ridgewood!","David for Queens HQ (60-40 Myrtle Avenue, Ridgewood, NY, USA)",
24,David,Ridgewood,Claire rec,,,20632,6/23,Tue,3:00 PM,6:00 PM,Canvass & PSV,"Ridgewood, Queens, NY, USA","Canvass for Claire, Aber, David, and Samantha in Ridgewood!","David for Queens HQ (60-40 Myrtle Avenue, Ridgewood, NY, USA)",
25,David,Ridgewood,Claire rec,,,20632,6/23,Tue,6:00 PM,9:00 PM,Canvass & PSV,"Ridgewood, Queens, NY, USA","Canvass for Claire, Aber, David, and Samantha in Ridgewood!","David for Queens HQ (60-40 Myrtle Avenue, Ridgewood, NY, USA)",
50,David,Woodhaven,Template,,,20664,6/13,Sat,9:00 AM,12:00 PM,PSV,"Woodhaven, Queens, NY, USA",Canvass for David & Claire in Woodhaven and Ozone Park!,,
51,David,Woodhaven,Template,,,20664,6/13,Sat,12:00 PM,3:00 PM,Canvass & PSV,"Woodhaven, Queens, NY, USA",Canvass for David & Claire in Woodhaven,,
52,David,Woodhaven,Template,,,20664,6/13,Sat,3:00 PM,6:00 PM,Canvass & PSV,"Woodhaven, Queens, NY, USA",Canvass for David & Claire in Woodhaven,,
53,David,Woodhaven,Template,,,20664,6/14,Sun,9:00 AM,12:00 PM,PSV,"Woodhaven, Queens, NY, USA",Canvass for David & Claire in Woodhaven and Ozone Park!,,
54,David,Woodhaven,Template,,,20664,6/14,Sun,12:00 PM,3:00 PM,Canvass & PSV,"Woodhaven, Queens, NY, USA",Canvass for David Richmond Hill,,
55,David,Woodhaven,Template,,,20664,6/14,Sun,3:00 PM,6:00 PM,Canvass & PSV,"Woodhaven, Queens, NY, USA",Canvass for David & Claire in Ozone Park,,
56,David,Woodhaven,Template,,,20664,6/15,Mon,6:00 PM,9:00 PM,Canvass,"Woodhaven, Queens, NY, USA",Canvass for David in Richmond Hill,,
57,David,Woodhaven,Template,,,20664,6/16,Tue,6:00 PM,9:00 PM,Canvass,"Woodhaven, Queens, NY, USA",Canvass for David & Claire in Ozone Park,,
58,David,Woodhaven,Template,,,20664,6/17,Wed,6:00 PM,9:00 PM,Canvass,"Woodhaven, Queens, NY, USA",Canvass for David & Claire in Woodhaven,,
59,David,Woodhaven,Template,,,20664,6/18,Thu,6:00 PM,9:00 PM,Canvass,"Woodhaven, Queens, NY, USA",Canvass for David & Claire in Woodhaven,,
60,David,Woodhaven,Template,,,20664,6/19,Fri,12:00 PM,3:00 PM,HTC,"Woodhaven, Queens, NY, USA",Canvass for David & Claire in Woodhaven and Ozone Park!,,
61,David,Woodhaven,Template,,,20664,6/19,Fri,3:00 PM,6:00 PM,HTC,"Woodhaven, Queens, NY, USA",Canvass for David & Claire in Woodhaven and Ozone Park!,,
62,David,Woodhaven,Template,,,20664,6/19,Fri,6:00 PM,9:00 PM,HTC,"Woodhaven, Queens, NY, USA",Canvass for David & Claire in Woodhaven and Ozone Park!,,
63,David,Woodhaven,Template,,,20664,6/20,Sat,9:00 AM,12:00 PM,PSV,"Woodhaven, Queens, NY, USA",Canvass for David & Claire in Woodhaven and Ozone Park!,,
64,David,Woodhaven,Template,,,20664,6/20,Sat,12:00 PM,3:00 PM,Canvass & PSV,"Woodhaven, Queens, NY, USA",Canvass for David & Claire in Woodhaven and Ozone Park!,,
65,David,Woodhaven,Template,,,20664,6/20,Sat,3:00 PM,6:00 PM,Canvass & PSV,"Woodhaven, Queens, NY, USA",Canvass for David & Claire in Woodhaven and Ozone Park!,,
66,David,Woodhaven,Template,,,20664,6/20,Sat,6:00 PM,9:00 PM,Canvass,"Woodhaven, Queens, NY, USA",Canvass for David & Claire in Woodhaven and Ozone Park!,,
67,David,Woodhaven,Template,,,20664,6/21,Sun,9:00 AM,12:00 PM,PSV,"Woodhaven, Queens, NY, USA",Canvass for David & Claire in Woodhaven and Ozone Park!,,
68,David,Woodhaven,Template,,,20664,6/21,Sun,12:00 PM,3:00 PM,Canvass & PSV,"Woodhaven, Queens, NY, USA",Canvass for David & Claire in Woodhaven and Ozone Park!,,
69,David,Woodhaven,Template,,,20664,6/21,Sun,3:00 PM,6:00 PM,Canvass & PSV,"Woodhaven, Queens, NY, USA",Canvass for David & Claire in Woodhaven and Ozone Park!,,
70,David,Woodhaven,Template,,,20664,6/21,Sun,6:00 PM,9:00 PM,Canvass,"Woodhaven, Queens, NY, USA",Canvass for David & Claire in Woodhaven and Ozone Park!,,
71,David,Woodhaven,Template,,,20664,6/22,Mon,12:00 PM,3:00 PM,Canvass,"Woodhaven, Queens, NY, USA",Canvass for David & Claire in Woodhaven and Ozone Park!,,
72,David,Woodhaven,Template,,,20664,6/22,Mon,3:00 PM,6:00 PM,Canvass,"Woodhaven, Queens, NY, USA",Canvass for David & Claire in Woodhaven and Ozone Park!,,
73,David,Woodhaven,Template,,,20664,6/22,Mon,6:00 PM,9:00 PM,Canvass,"Woodhaven, Queens, NY, USA",Canvass for David & Claire in Woodhaven and Ozone Park!,,
74,David,Woodhaven,Template,,,20664,6/23,Tue,6:00 AM,9:00 AM,PSV,"Woodhaven, Queens, NY, USA",Canvass for David & Claire in Woodhaven and Ozone Park!,,
75,David,Woodhaven,Template,,,20664,6/23,Tue,9:00 AM,12:00 PM,Canvass & PSV,"Woodhaven, Queens, NY, USA",Canvass for David & Claire in Woodhaven and Ozone Park!,,
76,David,Woodhaven,Template,,,20664,6/23,Tue,12:00 PM,3:00 PM,Canvass & PSV,"Woodhaven, Queens, NY, USA",Canvass for David & Claire in Woodhaven and Ozone Park!,,
77,David,Woodhaven,Template,,,20664,6/23,Tue,3:00 PM,6:00 PM,Canvass & PSV,"Woodhaven, Queens, NY, USA",Canvass for David & Claire in Woodhaven and Ozone Park!,,
78,David,Woodhaven,Template,,,20664,6/23,Tue,6:00 PM,9:00 PM,Canvass & PSV,"Woodhaven, Queens, NY, USA",Canvass for David & Claire in Woodhaven and Ozone Park!,,
`
