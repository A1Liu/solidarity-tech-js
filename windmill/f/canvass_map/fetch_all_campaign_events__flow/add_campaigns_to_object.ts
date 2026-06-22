// import * as wmill from "windmill-client"

export async function main(
  campaign: string,
  events: any,
  cantComeText: string,
  cantComeLink: string,
  iframeStyles: any,
) {
  return events.map((e: any) => ({
    campaign: campaign,
    campaigns: [campaign],
    kind: 'solidarity-tech',
    cantComeLink,
    cantComeText,
    iframeStyles,
    ...e,
  }))
}
