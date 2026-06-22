// import * as wmill from "windmill-client"

interface CampaignEvent {
  stableEventId?: string
  dedupeEventId?: string
  campaign?: string
  campaigns?: Array<string>
  // The campaign whose ST account owns this row's session (set by the fetcher).
  // Must follow the surviving row through dedup so the RSVP worker signs up via
  // the right account.
  sourceCampaign?: string | null
  tags?: Array<string>
  [key: string]: any
}

export async function main(doubleTuple: [Array<object>, Array<object>]) {
  const [eventListA, eventListB] = doubleTuple
  const allEvents = (eventListA.flat() as Array<CampaignEvent>).concat(
    eventListB.flat() as Array<CampaignEvent>,
  )

  // Group by dedupeEventId. Rows without a dedupeEventId are passed through as
  // their own singleton groups.
  const groups = new Map<string, Array<CampaignEvent>>()
  let syntheticKey = 0
  for (const ev of allEvents) {
    const key = ev.dedupeEventId || `__no_dedupe_id__:${syntheticKey++}`
    const bucket = groups.get(key)
    if (bucket) {
      bucket.push(ev)
    } else {
      groups.set(key, [ev])
    }
  }

  const result: Array<CampaignEvent> = []
  for (const [dedupeId, eventsInGroup] of groups) {
    // Merge campaign lists from every event in the group; the survivor must
    // carry them all.
    const mergedCampaigns = [
      ...new Set(
        eventsInGroup.flatMap((e) =>
          e.campaigns && e.campaigns.length > 0
            ? e.campaigns
            : e.campaign
              ? [e.campaign]
              : [],
        ),
      ),
    ].sort()

    // Merge tags from every event in the group so a co-hosted mirror's tags
    // aren't lost when only the winning row survives.
    const mergedTags = [
      ...new Set(eventsInGroup.flatMap((e) => e.tags ?? []).filter(Boolean)),
    ].sort()

    if (eventsInGroup.length === 1) {
      const only = eventsInGroup[0]!
      result.push({
        ...only,
        campaigns: mergedCampaigns,
        tags: mergedTags,
        sourceCampaign: only.sourceCampaign ?? only.campaign ?? null,
      })
      continue
    }

    // 1. Prefer the canonical row whose stableEventId matches the dedupe id
    //    (the original, not a co-hosted mirror).
    const canonical = eventsInGroup.filter((e) => e.stableEventId === dedupeId)
    const candidates = canonical.length > 0 ? canonical : eventsInGroup

    // 2. Tiebreak by campaign name, alphabetically first.
    const winner = [...candidates].sort((a, b) =>
      (a.campaign ?? '').localeCompare(b.campaign ?? ''),
    )[0]!

    // The winner is the row whose session id survives as `stableEventId`, so its
    // `sourceCampaign` is the ST account that owns that session.
    result.push({
      ...winner,
      campaigns: mergedCampaigns,
      tags: mergedTags,
      sourceCampaign: winner.sourceCampaign ?? winner.campaign ?? null,
    })
  }

  const filtered = result.filter((c) => {
    if (c.lon < -75 || c.lon > -73) return false
    if (c.lat > 41 || c.lat < 40) return false
    return true
  })

  return filtered
}
