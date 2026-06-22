import { Pool } from 'pg'
// import { PgQueue } from '@a1liu/js-utils@0.0.7/postgres/queue'
import { z } from 'zod'

// read data from all campaigns, write to bucket, and then add an entry to the queue
// maybe we can just combine ST and AN into one thing.

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

export type RsvpQueueItem = z.infer<typeof RsvpQueueItemSchema>
export const RsvpQueueItemSchema = z.object({
  rsvpId: z.string(),
  profileId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  phone: z.string(),
  zip: z.string(),
  stUserId: z.number().nullish(),
})

export type DataScrapeQueueItem = z.infer<typeof DataScrapeQueueItemSchema>
const DataScrapeQueueItemSchema = z.object({
  itemId: z.string(),
  sourceId: z.string(),
  path: z.string(),
})

export async function main(db: Postgresql) {
  const pool = new Pool({
    ...db,
    database: db.dbname,
    ssl: false,
  })

  console.log(pool.options)

  // const queue = new PgQueue<DataScrapeQueueItem>({
  //   pool,
  //   table: "data_scrape_queue"
  // })

  // const queue = new PgQueue()
  // let x = await wmill.getVariable('u/user/foo')
  return {}
}
