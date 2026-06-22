import * as wmill from 'windmill-client'
import postgres from 'postgres'
import { createSDK as ST } from '@a1liu/solidarity-tech-api'

// TODO: IDK what we can do to make this idiotic API generation system output
// data instead of exceptions. But whatever! It's fine, everything is an `any` right?
// import FetchError from 'api/dist/core/errors/fetchError'

import { z } from 'zod'
import { PgQueue } from './utils/queue_utils.ts'
import type { PgQueueItem } from './utils/queue_utils.ts'

// Windmill variable path holding the RSVP API keys for every campaign across
// both platforms. Its value is a single object whose values are raw API key
// strings (read once and reused for every item). Keys are looked up by the
// unique campaign **id** first, falling back to the campaign **name** (the
// common, single-platform case). The id taking precedence is what lets a
// campaign that runs a Solidarity Tech and an Action Network account *at the
// same time* override the shared-name key per platform: both ST and AN events
// carry the same `source_campaign` name, so the names collide, but the
// `campaign.id` is unique per platform (`jabari-brisport-st` vs
// `jabari-brisport`).
const RsvpKeysVariablePath = 'f/canvass_map/gotv-rsvp-keys'

// The platform an event belongs to, derived from its `stableEventId` prefix.
type Platform = 'st' | 'an'

type RsvpApiKeys = Record<string, string>

// The queue item's JSON payload. `rsvpId` identifies the RSVP to process; the
// profile id + info ride along so the worker doesn't re-read them.
type RsvpQueueData = {
  rsvpId: string
  profileId: string
  firstName: string
  lastName: string
  email: string
  phone: string
  // The volunteer's ZIP, threaded through to the upstream signup so the ST /
  // AN record carries a postal address. Nullable for profiles created before
  // zip collection.
  zip?: string | null
}

// The rsvp row joined with its event's source campaign/page. (Profile fields for
// the ST user lookup/create come from the queue item's `data`, not the DB.)
type RsvpRow = {
  event_id: string
  source: string | null
  referrer: string | null
  event_series_id: string
  page_id: number | null
  // The campaign whose ST account owns this event's session — the key used to
  // resolve the API key / agent / chapter for the signup.
  source_campaign: string | null
  // The upstream RSVP/attendance id, once we have it. Persisted here so a retry
  // skips creating the RSVP and goes straight to re-confirming it. Null until the
  // first attempt records it.
  external_id: string | null
  // The Solidarity Tech user id, once resolved. Persisted here (not in the queue
  // item's JSON) so a retry of a later step reuses the user instead of recreating
  // them. Null until the first ST attempt resolves it; always null for AN.
  external_user_id: string | null
}

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

/**
 * Drain the `rsvp_queue` table.
 *
 * Wires a `PgQueue` to the `rsvp_queue` table and drains it, running the whole
 * Solidarity Tech flow per item: resolve (look up / create) the ST user, RSVP
 * them to the session, and record a user action. Claim/retry/backoff/poll
 * semantics live in the `PgQueue` class in `queue_utils.ts`; this file only
 * supplies config and the per-item handler.
 */
export async function main(
  db: Postgresql,
  idleTimeoutMinutes: number = 2,
  maxLifetimeMinutes: number = 4,
) {
  const idleTimeoutMs = idleTimeoutMinutes * 60_000
  const maxLifetimeMs = maxLifetimeMinutes * 60_000
  const sql = postgres(
    `postgres://${db.user}:${db.password}@${db.host}:${db.port}/${db.dbname}?sslmode=${db.sslmode}`,
    { max: 1 },
  )

  const queue = new PgQueue<RsvpQueueData>({
    sql,
    table: 'rsvp_queue',
    maxRetries: 5,
    baseBackoffMs: 10_000,
    backoffFactor: 1.5,
    maxBackoffMs: 60_000,
  })

  // Read the campaign -> API key map once at startup and reuse it for every
  // item; the variable doesn't change over the lifetime of a drain. This one map
  // serves both the Solidarity Tech and Action Network signup paths.
  const rsvpApiKeys = await getRsvpApiKeys()
  const startTime = Date.now()
  let lastItemAt = Date.now()

  try {
    while (true) {
      const foundItem = await queue.processNext(async (item) => {
        console.log(
          `Processing rsvp_queue item ${item.id} (attempt ${item.attemptCount})`,
        )
        await processRsvp(sql, item, rsvpApiKeys)
      })

      const now = Date.now()
      if (now - startTime >= maxLifetimeMs) {
        break
      }

      if (foundItem) {
        lastItemAt = now
        // keep processing
        continue
      }

      if (now - lastItemAt >= idleTimeoutMs) {
        break
      }

      await wmill.sleep(1)
    }
  } finally {
    await sql.end({ timeout: 5 })
  }
}

/**
 * Look up the RSVP this queue item is for and run the full signup flow.
 *
 * The event's source prefix decides the upstream: `st.` events go through the
 * Solidarity Tech APIs (resolve user → RSVP → user action), `an.` events go
 * through the Action Network record-attendance helper. A failed API call throws
 * a plain Error so it's retried with backoff; anything we can't route hard-fails
 * (no retries).
 */
async function processRsvp(
  sql: postgres.Sql,
  item: PgQueueItem<RsvpQueueData>,
  rsvpApiKeys: RsvpApiKeys,
) {
  const rsvpId = item.data.rsvpId

  const [rsvp] = await sql<Array<RsvpRow>>`
    SELECT r.event_id,
           r.external_id,
           r.external_user_id,
           COALESCE(r.source, a.source) as source,
           COALESCE(r.referrer, a.referrer) as referrer,
           e.page_id,
           e.event_series_id,
           e.source_campaign
    FROM rsvp r
    LEFT JOIN event e ON e.id = r.event_id
    LEFT JOIN availability_submission a ON a.id = r.submission_id
    WHERE r.id = ${rsvpId}
  `
  assert(rsvp, `No rsvp row found for rsvp_id ${rsvpId}`)

  if (rsvp.event_id.startsWith('st.')) {
    await signUpForSolidarityTechEvent(sql, item, rsvp, rsvpApiKeys)
  } else if (rsvp.event_id.startsWith('an.')) {
    await signUpForActionNetworkEvent(sql, item, rsvp, rsvpApiKeys)
  } else {
    throw new PgQueue.HardFailError(`Unrecognized event id ${rsvp.event_id}`)
  }

  // Flow finished — record when we submitted this RSVP upstream and stamp the
  // ids it came back with so a later reconciliation can find the remote row.
  await sql`
    UPDATE rsvp
    SET submitted_at = now(),
        last_synced_at = now()
    WHERE id = ${rsvpId}
  `
}

async function signUpForSolidarityTechEvent(
  sql: postgres.Sql,
  item: PgQueueItem<RsvpQueueData>,
  rsvp: RsvpRow,
  rsvpApiKeys: RsvpApiKeys,
) {
  // `st.<session.id>` — RSVPs target the session, not the parent event.
  const sessionId = Number.parseInt(rsvp.event_id.slice('st.'.length))
  const eventSeriesId = Number.parseInt(
    rsvp.event_series_id.slice('st.'.length),
  )

  // One campaign per item: the event's source campaign owns the ST account that
  // holds this session, so it's used to resolve the user, RSVP them, and record
  // the user action — the api key, agent user id, and chapter id all come from
  // it, and the ids line up.
  const { apiKey, st } = await resolveCampaign(
    sql,
    rsvp.source_campaign,
    'st',
    rsvpApiKeys,
  )

  // `resolveCampaign` guarantees `st` is populated for the 'st' platform.
  assert(st, `ST campaign config missing for event ${rsvp.event_id}`)
  const { agentUserId, chapterId } = st

  ST.auth(`Bearer ${apiKey}`)
  console.log(
    `RSVP id=${item.id} rsvp=${item.data.rsvpId} profileId=${item.data.profileId}`,
  )
  console.log(`  Creating user...`)
  const userId = await ensureStUserId(sql, item, rsvp, chapterId)
  console.log(`    -> Got userId=${userId}`)

  await confirmStRsvp({
    sql,
    item,
    rsvp,
    userId,
    apiKey,
    sessionId,
    eventSeriesId,
    agentUserId,
  })

  // Also record the signup as a user action (Solidarity Tech's term for a form
  // submission) on the event's page, when we know the page id.
  if (rsvp.page_id === null) {
    console.warn(
      `    No page_id for event ${rsvp.event_id}; skipping Solidarity Tech user action`,
    )
    return
  }

  console.log(`  Creating user action with page_id=${rsvp.page_id}`)
  await ST.postUser_actions({
    page_id: rsvp.page_id,
    user_id: userId,
  })
  console.log(`    -> Done`)
}

const RsvpDataSchema = z.object({ data: z.object({ id: z.number() }) })
const GetEventRsvpsResultSchema = z.object({
  data: z.array(
    z.object({
      id: z.number(),
      user_id: z.number(),
      event_session_id: z.number(),
    }),
  ),
})
async function confirmStRsvp({
  sql,
  item,
  rsvp,
  agentUserId,
  userId,
  apiKey,
  eventSeriesId,
  sessionId,
}: {
  sql: postgres.Sql
  item: PgQueueItem<RsvpQueueData>
  rsvp: RsvpRow
  apiKey: string
  agentUserId: number
  userId: number
  sessionId: number
  eventSeriesId: number
}): Promise<{ externalId: number }> {
  // The upstream Solidarity Tech RSVP id. If a previous attempt already recorded
  // it on the rsvp row, skip the create and re-confirm that RSVP directly.
  const externalRsvpId: number = Number.parseInt(rsvp.external_id ?? '')

  if (!Number.isNaN(externalRsvpId)) {
    console.log(`   Reconfirming ST rsvp with id=${externalRsvpId}...`)
    await ST.putEvent_rsvpsId({ is_attending: 'yes' }, { id: externalRsvpId })

    return { externalId: externalRsvpId }
  }

  console.log(`  Creating ST rsvp...`)
  let externalId: number | undefined = undefined
  try {
    const { data } = await ST.postEvent_rsvps({
      event_id: eventSeriesId,
      event_session_id: sessionId,
      user_id: userId,
      is_attending: 'yes', // enum: 'yes' | 'no' | 'maybe'
      agent_user_id: agentUserId,

      source: [rsvp.source?.trim() || 'canvass.soc.nyc/gotv', rsvp.referrer]
        .map((a) => a?.trim())
        .flatMap((a) => (a ? [a] : []))
        .join(','),
      source_system: rsvp.referrer || undefined,
      skip_email_confirmation: false,
    })
    externalId = RsvpDataSchema.parse(data).data.id
    console.log(`    -> Got rsvpId=${externalId}`)

    return { externalId }
  } catch (e: any) {
    // assert(
    //   e instanceof FetchError,
    //   `Got weird error type for error: ${String(e)}, type=${typeof e}, constructor=${e.constructor.name}`,
    // )
    console.log(`    -> Error: ${String(e)} (data=${JSON.stringify(e.data)})`)
    const { errors } = z.object({ errors: z.string().array() }).parse(e.data)
    if (!errors.includes('User has already been taken')) {
      // Plain Error -> retried with backoff (the ST API may just be flaky).
      throw new Error(
        `Solidarity Tech signup failed for session=${sessionId}, event=${eventSeriesId}`,
      )
    }

    console.log(
      `    Getting RSVPs for event=${eventSeriesId} session=${sessionId}...`,
    )
    // `_limit`/`_offset`/`_since`/`full_user_payload` carry schema defaults but
    // the generated metadata type still requires them; pass the defaults
    // explicitly to keep the prior raw-fetch behavior.
    externalId = await (async (): Promise<number> => {
      const limit = 100
      let offset = 0
      while (true) {
        const resp = await fetch(
          `https://api.solidarity.tech/v1/event_rsvps?_limit=100&_offset=${offset}&_since=0&session_id=${sessionId}&full_user_payload=false`,
          {
            headers: {
              authorization: `Bearer ${apiKey}`,
            },
          },
        )
        const data = await resp.json()
        const { data: rsvps } = GetEventRsvpsResultSchema.parse(data)
        if (rsvps.length === 0) break
        const existing = rsvps.find((r) => r.user_id === userId)
        if (!existing) {
          console.log(
            `    X offset=${offset} didn't have RSVP (${JSON.stringify(rsvps)})`,
          )
          await wmill.sleep(0.6)
          offset += limit
          continue
        }

        console.log(
          `    -> Found existing RSVP (id=${existing.id}, offset=${offset})`,
        )
        return existing.id
      }

      throw new Error(
        `Solidarity Tech reported an existing RSVP for session=${sessionId}, user=${userId} but none was found in the listing`,
      )
    })()
  } finally {
    if (externalId !== undefined) {
      await sql`
        UPDATE rsvp
        SET external_id = ${String(externalId)}
        WHERE id = ${item.data.rsvpId}
      `
    }
  }

  await ST.putEvent_rsvpsId({ is_attending: 'yes' }, { id: externalId })
  console.log(
    `    -> Updated existing rsvp for id=${item.id} rsvp=${item.data.rsvpId} userId=${userId}`,
  )
  return { externalId: externalRsvpId }
}

/**
 * Sign up for an Action Network event via the record-attendance helper.
 * Docs: https://actionnetwork.org/docs/v2/record_attendance_helper
 */
async function signUpForActionNetworkEvent(
  sql: postgres.Sql,
  item: PgQueueItem<RsvpQueueData>,
  rsvp: RsvpRow,
  rsvpApiKeys: RsvpApiKeys,
) {
  // `an.<uuid>` — the suffix is the Action Network event id used in the path.
  const eventId = rsvp.event_id.slice('an.'.length)
  const { apiKey } = await resolveCampaign(
    sql,
    rsvp.source_campaign,
    'an',
    rsvpApiKeys,
  )

  // Person is upserted by email/phone; postal_addresses carries the ZIP when we
  // have one (profiles predating zip collection won't).
  const person: Record<string, unknown> = {
    given_name: item.data.firstName,
    family_name: item.data.lastName,
    email_addresses: [{ address: item.data.email }],
    phone_numbers: [{ number: item.data.phone }],
  }
  if (item.data.zip) {
    person.postal_addresses = [{ postal_code: item.data.zip }]
  }

  const res = await fetch(
    `https://actionnetwork.org/api/v2/events/${eventId}/attendances`,
    {
      method: 'POST',
      headers: {
        'OSDI-API-Token': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        person,

        'action_network:referrer_data': {
          source: rsvp.source?.trim() || 'canvass.soc.nyc/gotv',
          referrerData: rsvp.referrer?.trim() || undefined,
        },

        // Send the confirmation email / etc
        triggers: {
          autoresponse: { enabled: true },
        },
      }),
    },
  )

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    // Plain Error -> retried with backoff (the AN API may just be flaky).
    throw new Error(
      `Action Network attendance failed for event=${eventId}: ${res.status} ${res.statusText} ${body}`,
    )
  }
  console.log(
    `Recorded Action Network attendance for id=${item.id} rsvp=${item.data.rsvpId} event=${eventId}`,
  )
}

/**
 * Resolve the Solidarity Tech user id for this RSVP. If a previous attempt
 * already resolved it, it's tracked on the rsvp row's `external_user_id` and
 * reused. Otherwise we look up / create the user and persist the id onto the
 * rsvp row before continuing, so a failure in a later step doesn't re-create the
 * user.
 */
const PostUserResultSchema = z.object({ id: z.number() })
async function ensureStUserId(
  sql: postgres.Sql,
  item: PgQueueItem<RsvpQueueData>,
  rsvp: RsvpRow,
  chapterId: number,
): Promise<number> {
  const storedUserId = Number.parseInt(rsvp.external_user_id ?? '')
  if (!Number.isNaN(storedUserId)) {
    return storedUserId
  }

  const profile = item.data
  console.log(`    Calling POST on /users...`)
  const { data } = await ST.postUsers({
    phone_number: profile.phone,
    email: profile.email,
    first_name: profile.firstName,
    last_name: profile.lastName,

    // TODO: Zip code collection for solidarity tech
    // zip_code: profile.zip || undefined,

    // Chapter the user is assigned to when they don't already exist.
    chapter_id: chapterId,
  })

  const userId = PostUserResultSchema.parse(data).id

  // Stamp the resolved id onto the rsvp row so retries skip the lookup/create.
  const externalUserId = String(userId)
  await sql`
    UPDATE rsvp
    SET external_user_id = ${externalUserId}
    WHERE id = ${item.data.rsvpId}
  `

  return userId
}

// The resolved config for the campaign chosen to process an RSVP, for either
// platform: the unique campaign id, its host platform, and the API key (from the
// `gotv-rsvp-keys` Windmill variable). `st` carries the Solidarity-Tech-only
// `agent_user_id` / `chapter_id` (read from the `campaign` table) and is present
// only when `host_platform === 'st'`; Action Network needs no such ids.
type CampaignConfig = {
  campaignId: string
  host_platform: Platform
  apiKey: string
  st?: {
    agentUserId: number
    chapterId: number
  }
}

/**
 * Read the single `gotv-rsvp-keys` Windmill variable and return it as a map of
 * unique campaign id *or* campaign name -> raw API key.
 */
async function getRsvpApiKeys(): Promise<RsvpApiKeys> {
  try {
    const raw = await wmill.getVariable(RsvpKeysVariablePath)
    const jsonObj = JSON.parse(raw)
    return z.record(z.string(), z.string()).parse(jsonObj)
  } catch (err) {
    throw new PgQueue.HardFailError(
      `Failed to parse RSVP keys variable "${RsvpKeysVariablePath}": ${String(err)}`,
    )
  }
}

/**
 * Resolve the config for the event's source campaign on a given platform — the
 * campaign whose account owns the session/event being signed up for. Reads the
 * campaign row from the `campaign` table by name + `host_platform`, then resolves
 * the API key from the shared `gotv-rsvp-keys` map by the campaign's unique id,
 * falling back to its name. For ST it also returns the agent user id + chapter id
 * (Action Network has no such ids). Hard-fails (no retries) when the event has no
 * source campaign, there's no matching `campaign` row, or no key can be found —
 * signing up via the wrong account would target an id that doesn't exist there.
 */
async function resolveCampaign(
  sql: postgres.Sql,
  campaign: string | null,
  platform: Platform,
  rsvpApiKeys: RsvpApiKeys,
): Promise<CampaignConfig> {
  assert(campaign, 'Event has no source campaign to resolve an API key from')
  console.log(`    Resolving campaign=${campaign}`)

  const [row] = await sql<
    Array<{
      id: string
      host_platform: Platform
      st_agent_user_id: number | null
      st_chapter_id: number | null
    }>
  >`
    SELECT id, host_platform, st_agent_user_id, st_chapter_id
    FROM campaign
    WHERE name = ${campaign}
      AND host_platform = ${platform}
    LIMIT 1
  `
  assert(row, `No ${platform} row found for campaign=${campaign}`)

  const apiKey = rsvpApiKeys[row.id] ?? rsvpApiKeys[campaign]
  assert(apiKey, `"${campaign}"/${row.id} missing in ${RsvpKeysVariablePath}`)

  const config: CampaignConfig = {
    campaignId: row.id,
    host_platform: row.host_platform,
    apiKey,
  }

  if (row.host_platform === 'st') {
    if (row.st_agent_user_id == null || row.st_chapter_id == null) {
      throw new PgQueue.HardFailError(
        `Solidarity Tech campaign "${campaign}" (id "${row.id}") is missing st_agent_user_id / st_chapter_id`,
      )
    }
    config.st = {
      agentUserId: row.st_agent_user_id,
      chapterId: row.st_chapter_id,
    }
  }

  return config
}

function assert(val: unknown, message: string): asserts val {
  if (!val) {
    throw new PgQueue.HardFailError(message)
  }
}
