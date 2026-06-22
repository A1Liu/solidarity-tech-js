// import * as wmill from "windmill-client"

export async function main(
  campaign: string,
  events: any,
  cantComeText: string,
  cantComeLink: string,
  iframeStyles: any,
) {
  return events.map((e: any) => ({
    campaign,
    kind: 'action-network',
    cantComeLink,
    cantComeText,
    iframeStyles,
    ...e,
  }))
}
