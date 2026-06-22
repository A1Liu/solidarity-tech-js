// import * as wmill from "windmill-client"

export async function main(allEvents: any) {
  return allEvents.map((ev: any) =>
    ev.title && ev.title.toLowerCase().includes('tax the rich')
      ? {
          ...ev,
          campaigns: ev.campaigns.concat(['Tax the Rich']),
        }
      : ev,
  )
}
