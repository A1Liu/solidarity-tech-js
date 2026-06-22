import type postgres from 'postgres'

// Status values stored in the queue table's `status` column.
const QUEUED = 'queued'
const PROCESSING = 'processing'
const DONE = 'done'
const FAILED = 'failed'

// Error which prevents queue retry — the item goes straight to FAILED.
class HardFailError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HardFailError'
  }
}

// A claimed item, normalized to fixed field names. `id` is the queue row's
// primary key (used for status updates); `data` is its JSON payload.
export type PgQueueItem<T = unknown> = {
  id: string
  data: T
  status: string
  enteredQueueAt: Date
  attemptCount: number
}

export type PgQueueConfig = {
  sql: postgres.Sql
  table: string

  // Retry / backoff.
  maxRetries?: number
  baseBackoffMs?: number
  backoffFactor?: number
  maxBackoffMs?: number
}

/**
 * A Postgres-backed work queue using `SELECT ... FOR UPDATE SKIP LOCKED` for
 * exclusive, concurrency-safe claims. Failed items are retried with exponential
 * backoff by deferring `entered_queue_at` into the future; after `maxRetries`
 * they are marked FAILED.
 *
 * The table name is configurable, but the queue's columns are fixed:
 * `id`, `data`, `status`, `entered_queue_at`, `updated_at`, `attempt_count`.
 */
export class PgQueue<T = unknown> {
  static HardFailError = HardFailError

  private readonly sql: postgres.Sql
  private readonly table: string

  private readonly maxRetries: number
  private readonly baseBackoffMs: number
  private readonly backoffFactor: number
  private readonly maxBackoffMs: number

  constructor(config: PgQueueConfig) {
    this.sql = config.sql
    this.table = config.table

    this.maxRetries = config.maxRetries ?? 15
    this.baseBackoffMs = config.baseBackoffMs ?? 4_000
    this.backoffFactor = config.backoffFactor ?? 1.5
    this.maxBackoffMs = config.maxBackoffMs ?? 60 * 60_000
  }

  /**
   * Run `handler` against claimed items until the queue stays empty for
   * `idleTimeoutMs`, polling every `pollIntervalMs` while idle. Returns the
   * number of items processed.
   */
  async drain(
    handler: (item: PgQueueItem<T>) => Promise<void>,
  ): Promise<{ processed: number }> {
    let processed = 0
    let item = await this.processNext(handler)

    while (item) {
      processed += 1
      item = await this.processNext(handler)
    }

    return { processed }
  }

  /**
   * Claim the next due item and run `handler` on it. On success the row is
   * marked DONE; on a thrown error it's retried with backoff (or failed).
   * Returns the claimed item, or null when the queue is empty.
   */
  async processNext(
    handler: (item: PgQueueItem<T>) => Promise<void>,
  ): Promise<PgQueueItem<T> | null> {
    const item = await this.claim()
    if (!item) return null

    try {
      await handler(item)
      await this.setStatus(item.id, DONE)
    } catch (err) {
      await this.handleFailure(item, err)
    }

    return item
  }

  /**
   * Atomically claim the oldest due queued item. The `FOR UPDATE SKIP LOCKED`
   * subquery picks one unlocked queued row ordered by `entered_queue_at`; the
   * surrounding UPDATE flips it to PROCESSING in the same statement, so no two
   * workers can grab the same row. `entered_queue_at <= now()` keeps
   * backoff-deferred items from being picked up early.
   */
  private async claim(): Promise<PgQueueItem<T> | null> {
    const { sql } = this
    const rows = await sql<Array<PgQueueItem<T>>>`
      UPDATE ${sql(this.table)}
      SET status = ${PROCESSING},
          attempt_count = attempt_count + 1,
          updated_at = now()
      WHERE id = (
        SELECT id
        FROM ${sql(this.table)}
        WHERE status = ${QUEUED}
          AND entered_queue_at <= now()
        ORDER BY entered_queue_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING
        id AS "id",
        data AS "data",
        status AS "status",
        entered_queue_at AS "enteredQueueAt",
        attempt_count AS "attemptCount"
    `

    return rows[0] ?? null
  }

  /**
   * Re-queue a failed item with exponential backoff, or mark it FAILED once it
   * has exhausted its retries. `attemptCount` was already incremented at claim
   * time, so it reflects the number of attempts made (including this one).
   */
  private async handleFailure(
    item: PgQueueItem<T>,
    err: unknown,
  ): Promise<void> {
    const hardFail = err instanceof HardFailError
    if (hardFail || item.attemptCount >= this.maxRetries) {
      console.error(
        hardFail
          ? `${this.table} item ${item.id} hard-failed; giving up`
          : `${this.table} item ${item.id} failed after ${item.attemptCount} attempts; giving up`,
        err,
      )
      await this.setStatus(item.id, FAILED)
      return
    }

    const delayMs = this.backoffMs(item.attemptCount)
    console.warn(
      `${this.table} item ${item.id} failed (attempt ${item.attemptCount}); retrying in ${delayMs}ms`,
      err,
    )

    // Defer the next attempt by bumping entered_queue_at into the future.
    // claim() skips it until it's due, and the ORDER BY keeps the queue fair.
    const { sql } = this
    await sql`
      UPDATE ${sql(this.table)}
      SET status = ${QUEUED},
          entered_queue_at = now() + (${delayMs}::double precision * interval '1 millisecond'),
          updated_at = now()
      WHERE id = ${item.id}
    `
  }

  private async setStatus(id: string, status: string): Promise<void> {
    const { sql } = this
    await sql`
      UPDATE ${sql(this.table)}
      SET status = ${status},
          updated_at = now()
      WHERE id = ${id}
    `
  }

  /** Exponential backoff for a 1-based attempt number, capped at maxBackoffMs. */
  private backoffMs(attempt: number): number {
    return Math.min(
      this.baseBackoffMs * this.backoffFactor ** (attempt - 1),
      this.maxBackoffMs,
    )
  }
}
