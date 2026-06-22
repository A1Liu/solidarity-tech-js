import * as wmill from 'windmill-client'
import {
  REQUEST_DELAY_MS,
  deleteSession,
  fetchEvent,
  sleep,
} from './utils/st_api'
import type { StEventSession } from './utils/st_api'

/**
 * Delete all but one session of a Solidarity Tech event.
 *
 * Useful for cleaning up an event that accumulated extra sessions (e.g. a bad
 * run of `create_solidarity_tech_events_from_csv`). The session kept is the
 * "anchor": the first one carrying a location (so the create script can still
 * read a location from it), falling back to the first session otherwise.
 *
 * Endpoints (https://www.solidarity.tech/reference):
 *   - GET    /v1/events/{id}            (read the event's sessions)
 *   - DELETE /v1/event_sessions/{id}    (delete a session)
 */

/** Pick the session to keep: prefer one with a location, else the first. */
function pickAnchor(
  sessions: Array<StEventSession>,
): StEventSession | undefined {
  return (
    sessions.find((s) => s.location_data?.coordinates) ||
    sessions.find((s) => s.lonlat) ||
    sessions.find((s) => s.location_address) ||
    sessions.find((s) => s.location_name) ||
    sessions[0]
  )
}

/**
 * @param apiKey   Windmill variable *path* holding the ST API key (resolved via
 *                 wmill.getVariable), matching the fetcher's convention.
 * @param eventId  ST event id whose sessions should be pruned to one.
 * @param dryRun   When true, log what *would* be deleted without hitting the API.
 */
export async function main(
  apiKey: string,
  eventId: number,
  dryRun: boolean = false,
): Promise<{
  eventId: number
  keptSessionId: number | null
  deletedSessionIds: Array<number>
}> {
  const apiKeyValue = await wmill.getVariable(apiKey)

  const event = await fetchEvent(apiKeyValue, eventId)
  const sessions = event.event_sessions ?? []
  console.log(
    `Event ${eventId} ("${event.title}") has ${sessions.length} session(s).`,
  )

  const anchor = pickAnchor(sessions)
  if (!anchor || sessions.length <= 1) {
    console.log('Nothing to delete (event has one session or fewer).')
    return {
      eventId,
      keptSessionId: anchor?.id ?? null,
      deletedSessionIds: [],
    }
  }

  const toDelete = sessions.filter((s) => s.id !== anchor.id)
  console.log(
    `Keeping session ${anchor.id}; deleting ${toDelete.length} other session(s).`,
  )

  const deletedSessionIds: Array<number> = []
  for (const session of toDelete) {
    if (dryRun) {
      console.log(`  [dry-run] would delete session ${session.id}`)
      deletedSessionIds.push(session.id)
      continue
    }
    await deleteSession(apiKeyValue, session.id)
    deletedSessionIds.push(session.id)
    console.log(`  deleted session ${session.id}`)
    await sleep(REQUEST_DELAY_MS)
  }

  return { eventId, keptSessionId: anchor.id, deletedSessionIds }
}
