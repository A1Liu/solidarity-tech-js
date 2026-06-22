import * as wmill from 'windmill-client'
import postgres from 'postgres'
import { google } from 'googleapis'

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

type GcpServiceAccount = {
  type: string
  auth_uri: string
  client_id: string
  token_uri: string
  project_id: string
  private_key: string
  client_email: string
  private_key_id: string
  client_x509_cert_url: string
  auth_provider_x509_cert_url: string
}

type ExportRow = {
  'First Name': string
  'Last Name': string
  'Phone Number': string
  'Initial Status': 'Abandoned' | 'Partial'
  'Current Status': 'Abandoned' | 'Partial'
  'Resume URL': string
  'Slot Commitments': string
  'Slots Missing RSVPs': string
  'Submitted At': string
  'Current RSVP Count': number
  'Other RSVPs Jun 13-23': number
  'Has Other Completed Commitment': boolean | ''
}

type DbRow = {
  submission_id: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  source: string | null
  submitted_at: string
  availability_slot_count: number
  slots_missing_rsvps: string | null
  rsvp_count: number
  slot_commitments: string | null
  has_other_completed_commitment: boolean
}

type ElectoralP2PRsvpCountRow = {
  phone_number: string
  rsvp_count: number
}

const DEFAULT_DESTINATION_SHEET =
  'https://docs.google.com/spreadsheets/d/1YPRPWxWR21UdE3kdXwze4nKqS3e1BjSxOQghfoiyNNE/edit?gid=0#gid=0'
const RESUME_BASE_URL = 'https://canvass.socialists.nyc/gotv/rsvp'
const HEADERS: Array<keyof ExportRow> = [
  'First Name',
  'Last Name',
  'Phone Number',
  'Initial Status',
  'Current Status',
  'Resume URL',
  'Slot Commitments',
  'Slots Missing RSVPs',
  'Submitted At',
  'Current RSVP Count',
  'Other RSVPs Jun 13-23',
  'Has Other Completed Commitment',
]
const UPDATE_HEADERS = new Set(
  [
    'Initial Status',
    'Current Status',
    'Resume URL',
    'Slot Commitments',
    'Slots Missing RSVPs',
    'Current RSVP Count',
    'Other RSVPs Jun 13-23',
    'Has Other Completed Commitment',
  ].map(normalizeHeader),
)

function extractSpreadsheetId(sheetUrl: string): string {
  const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  if (!match)
    throw new Error(`Could not extract spreadsheet ID from URL: ${sheetUrl}`)
  return match[1]!
}

function extractGid(sheetUrl: string): number | null {
  const match = sheetUrl.match(/[?#&]gid=(\d+)/)
  return match ? Number(match[1]) : null
}

function quoteSheetName(title: string): string {
  return `'${title.replace(/'/g, "''")}'`
}

function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function normalizePhone(phone: string | null | undefined): string {
  return (phone ?? '').replace(/[^0-9a-zA-Z]/g, '').slice(-10)
}

function columnLetter(columnNumber: number): string {
  let letter = ''
  while (columnNumber > 0) {
    const remainder = (columnNumber - 1) % 26
    letter = String.fromCharCode(65 + remainder) + letter
    columnNumber = Math.floor((columnNumber - 1) / 26)
  }
  return letter
}

function buildResumeUrl(submissionId: string, source: string | null): string {
  const url = new URL(RESUME_BASE_URL)
  url.searchParams.set('submission', submissionId)
  if (source?.trim()) url.searchParams.set('source', source.trim())
  return url.toString()
}

function toSheetValues(
  row: ExportRow,
  headers: Array<string>,
): Array<string | number | boolean> {
  const rowByNormalizedHeader = new Map(
    HEADERS.map((header) => [normalizeHeader(header), row[header] ?? '']),
  )
  return headers.map((header) => {
    const normalizedHeader = normalizeHeader(header)
    return rowByNormalizedHeader.get(normalizedHeader) ?? ''
  })
}

function trimTrailingBlankValues(
  values: Array<string | number | boolean>,
): Array<string | number | boolean> {
  let lastNonBlankIndex = values.length - 1
  while (lastNonBlankIndex >= 0 && values[lastNonBlankIndex] === '') {
    lastNonBlankIndex--
  }
  return values.slice(0, lastNonBlankIndex + 1)
}

function toSheetUpdateData(
  row: ExportRow,
  headers: Array<string>,
  rowNumber: number,
  quotedTabName: string,
): Array<{ range: string; values: Array<Array<string | number | boolean>> }> {
  const rowByNormalizedHeader = new Map(
    HEADERS.map((header) => [normalizeHeader(header), row[header] ?? '']),
  )
  return headers.flatMap((header, index) => {
    const normalizedHeader = normalizeHeader(header)
    if (
      !UPDATE_HEADERS.has(normalizedHeader) ||
      !rowByNormalizedHeader.has(normalizedHeader)
    ) {
      return []
    }
    const column = columnLetter(index + 1)
    return [
      {
        range: `${quotedTabName}!${column}${rowNumber}`,
        values: [[rowByNormalizedHeader.get(normalizedHeader) ?? '']],
      },
    ]
  })
}

async function getWorksheet(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  gid: number | null,
): Promise<{ title: string; sheetId: number }> {
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId })
  const worksheets = spreadsheet.data.sheets ?? []
  const worksheet =
    gid == null
      ? worksheets[0]
      : worksheets.find((sheet) => sheet.properties?.sheetId === gid)
  const title = worksheet?.properties?.title
  const sheetId = worksheet?.properties?.sheetId
  if (!title || sheetId == null) {
    throw new Error(
      gid == null
        ? `Spreadsheet ${spreadsheetId} has no worksheets`
        : `Could not find worksheet gid=${gid} in spreadsheet ${spreadsheetId}`,
    )
  }
  return { title, sheetId }
}

async function upsertRowsToSheet(
  serviceAccount: GcpServiceAccount,
  sheetUrl: string,
  rows: Array<ExportRow>,
  excludedPhoneNumbers: Array<string>,
) {
  try {
    const spreadsheetId = extractSpreadsheetId(sheetUrl)
    const gid = extractGid(sheetUrl)
    const auth = new google.auth.JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })
    const sheets = google.sheets({ version: 'v4', auth })
    const worksheet = await getWorksheet(sheets, spreadsheetId, gid)
    const tabName = worksheet.title
    const quotedTabName = quoteSheetName(tabName)

    const existingRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${quotedTabName}!A:Z`,
    })
    const existingValues = existingRes.data.values ?? []
    const existingHeaders = (existingValues[0] ?? []).map((value) =>
      String(value),
    )
    const hasHeaders = existingHeaders.length > 0

    const existingHeaderSet = new Set(existingHeaders.map(normalizeHeader))
    const missingHeaders = HEADERS.filter(
      (header) => !existingHeaderSet.has(normalizeHeader(header)),
    )
    const headers = hasHeaders
      ? [...existingHeaders, ...missingHeaders]
      : HEADERS

    if (!hasHeaders || missingHeaders.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${quotedTabName}!A1:${columnLetter(headers.length)}1`,
        valueInputOption: 'RAW',
        requestBody: { values: [headers] },
      })
    }

    const resumeUrlColumnIndex = headers.findIndex(
      (header) => normalizeHeader(header) === normalizeHeader('Resume URL'),
    )
    if (resumeUrlColumnIndex === -1) {
      throw new Error('Destination sheet must have a "Resume URL" column')
    }

    const phoneColumnIndex = headers.findIndex(
      (header) => normalizeHeader(header) === normalizeHeader('Phone Number'),
    )
    const desiredResumeUrls = new Set(rows.map((row) => row['Resume URL']))
    const excludedPhoneSet = new Set(
      excludedPhoneNumbers.map(normalizePhone).filter((phone) => phone !== ''),
    )

    const existingRowByResumeUrl = new Map<string, number>()
    const rowNumbersToDelete: Array<number> = []
    for (let i = 1; i < existingValues.length; i++) {
      const existingRow = existingValues[i]
      const resumeUrl = String(existingRow?.[resumeUrlColumnIndex] ?? '').trim()
      const phone =
        phoneColumnIndex === -1
          ? ''
          : normalizePhone(String(existingRow?.[phoneColumnIndex] ?? ''))
      const shouldDelete =
        (resumeUrl && !desiredResumeUrls.has(resumeUrl)) ||
        (phone && excludedPhoneSet.has(phone))

      if (shouldDelete) {
        rowNumbersToDelete.push(i + 1)
      } else if (resumeUrl) {
        existingRowByResumeUrl.set(resumeUrl, i + 1)
      }
    }

    const updates = [] as Array<{
      range: string
      values: Array<Array<string | number | boolean>>
    }>
    const appends = [] as Array<Array<string | number | boolean>>
    let updatedRowCount = 0

    for (const row of rows) {
      const existingRowNumber = existingRowByResumeUrl.get(row['Resume URL'])
      if (existingRowNumber) {
        updates.push(
          ...toSheetUpdateData(row, headers, existingRowNumber, quotedTabName),
        )
        updatedRowCount++
      } else {
        appends.push(trimTrailingBlankValues(toSheetValues(row, headers)))
      }
    }

    if (updates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'RAW',
          data: updates,
        },
      })
    }

    if (rowNumbersToDelete.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: rowNumbersToDelete
            .sort((a, b) => b - a)
            .map((rowNumber) => ({
              deleteDimension: {
                range: {
                  sheetId: worksheet.sheetId,
                  dimension: 'ROWS',
                  startIndex: rowNumber - 1,
                  endIndex: rowNumber,
                },
              },
            })),
        },
      })
    }

    let appendRange: string | undefined
    if (appends.length > 0) {
      const appendRes = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${quotedTabName}!A1`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: appends },
      })
      appendRange = appendRes.data.updates?.updatedRange ?? undefined
    }

    return {
      tabName,
      exportedRows: rows.length,
      updatedRows: updatedRowCount,
      appendedRows: appends.length,
      deletedRows: rowNumbersToDelete.length,
      appendRange,
    }
  } catch (error: any) {
    if (error?.code === 403 || error?.status === 403) {
      throw new Error(
        `Google Sheets permission denied. Share ${sheetUrl} with ${serviceAccount.client_email} and grant edit access.`,
      )
    }
    throw error
  }
}

export async function main(
  destinationSheet: string = DEFAULT_DESTINATION_SHEET,
  testPhoneNumbers: Array<string> = [
    '4132040608',
    '8572349307',
    '7164655303',
    '6606203671',
    '4124146478',
    '2147010869',
  ],
) {
  const db: Postgresql = await wmill.getResource('f/canvass_map/database')
  const electoralP2PDb: Postgresql =
    await wmill.getResource('f/electoral_p2p/pg')
  const gcs: GcpServiceAccount = await wmill.getResource(
    'f/tnt_core/drive_service_account',
  )
  const sql = postgres(
    `postgres://${db.user}:${db.password}@${db.host}:${db.port}/${db.dbname}?sslmode=${db.sslmode}`,
    { max: 1 },
  )
  const electoralP2PSql = postgres(
    `postgres://${electoralP2PDb.user}:${electoralP2PDb.password}@${electoralP2PDb.host}:${electoralP2PDb.port}/${electoralP2PDb.dbname}?sslmode=${electoralP2PDb.sslmode}`,
    { max: 1 },
  )

  try {
    const rows = await sql<Array<DbRow>>`
      WITH rsvp_counts AS (
        SELECT
          r.submission_id,
          count(*)::integer AS rsvp_count,
          string_agg(
            concat_ws(
              ' — ',
              to_char(e.start_time AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York', 'Dy Mon FMDD FMHH:MI AM'),
              nullif(e.title, ''),
              nullif(e.location_name, '')
            ),
            E'\n'
            ORDER BY e.start_time, e.title
          ) AS slot_commitments
        FROM rsvp r
        LEFT JOIN event e ON e.id = r.event_id
        WHERE r.submission_id IS NOT NULL
        GROUP BY r.submission_id
      ), availability_counts AS (
        SELECT
          submission_id,
          count(*)::integer AS availability_slot_count
        FROM availability_time_block
        GROUP BY submission_id
      ), submission_phones AS (
        SELECT
          s.id AS submission_id,
          right(
            regexp_replace(
              COALESCE(NULLIF(p.phone, ''), s.data->>'phone', ''),
              '[^0-9a-zA-Z]',
              '',
              'g'
            ),
            10
          ) AS phone_number
        FROM availability_submission s
        LEFT JOIN profile p ON p.id = s.profile_id
      ), completed_commitment_counts_by_phone AS (
        SELECT
          sp.phone_number,
          count(*)::integer AS completed_commitment_count
        FROM submission_phones sp
        JOIN rsvp_counts r ON r.submission_id = sp.submission_id
        WHERE sp.phone_number <> ''
          AND COALESCE(r.rsvp_count, 0) > 0
        GROUP BY sp.phone_number
      ), missing_slots AS (
        SELECT
          tb.submission_id,
          count(*)::integer AS missing_slot_count,
          string_agg(
            concat(
              to_char(tb.start_time AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York', 'Dy Mon FMDD FMHH:MI AM'),
              '–',
              to_char(tb.end_time AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York', 'FMHH:MI AM')
            ),
            E'\n'
            ORDER BY tb.start_time
          ) AS slots_missing_rsvps
        FROM availability_time_block tb
        WHERE NOT EXISTS (
          SELECT 1
          FROM rsvp r
          JOIN event e ON e.id = r.event_id
          WHERE r.submission_id = tb.submission_id
            AND e.start_time < tb.end_time
            AND e.end_time > tb.start_time
        )
        GROUP BY tb.submission_id
      )
      SELECT
        s.id::text AS submission_id,
        COALESCE(NULLIF(p.first_name, ''), s.data->>'firstName') AS first_name,
        COALESCE(NULLIF(p.last_name, ''), s.data->>'lastName') AS last_name,
        COALESCE(NULLIF(p.phone, ''), s.data->>'phone') AS phone,
        COALESCE(NULLIF(s.source, ''), NULLIF(s.data->>'source', '')) AS source,
        to_char(s.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York', 'YYYY-MM-DD HH24:MI:SS') AS submitted_at,
        COALESCE(a.availability_slot_count, 0)::integer AS availability_slot_count,
        m.slots_missing_rsvps,
        COALESCE(r.rsvp_count, 0)::integer AS rsvp_count,
        r.slot_commitments,
        COALESCE(cc.completed_commitment_count, 0) > CASE
          WHEN COALESCE(r.rsvp_count, 0) > 0 THEN 1
          ELSE 0
        END AS has_other_completed_commitment
      FROM availability_submission s
      LEFT JOIN profile p ON p.id = s.profile_id
      LEFT JOIN availability_counts a ON a.submission_id = s.id
      LEFT JOIN rsvp_counts r ON r.submission_id = s.id
      LEFT JOIN missing_slots m ON m.submission_id = s.id
      LEFT JOIN submission_phones sp ON sp.submission_id = s.id
      LEFT JOIN completed_commitment_counts_by_phone cc ON cc.phone_number = sp.phone_number
      WHERE s.created_at <= now() - interval '30 minutes'
        AND (
          COALESCE(r.rsvp_count, 0) = 0
          OR COALESCE(m.missing_slot_count, 0) > 0
        )
      ORDER BY s.created_at ASC
    `

    const p2pRsvpCounts = await electoralP2PSql<
      Array<ElectoralP2PRsvpCountRow>
    >`
      SELECT
        right(regexp_replace(sr.phone_number, '[^0-9a-zA-Z]', '', 'g'), 10) AS phone_number,
        count(*)::integer AS rsvp_count
      FROM electoral_p2p.slate_rsvps sr
      JOIN electoral_p2p.slate_event_sessions ses
        ON ses.candidate_slug = sr.candidate_slug
       AND ses.id = sr.session_id
      WHERE ses.start_time >= '2026-06-13'::date
        AND ses.start_time < '2026-06-24'::date
        AND right(regexp_replace(sr.phone_number, '[^0-9a-zA-Z]', '', 'g'), 10) <> ''
      GROUP BY 1
    `
    const p2pRsvpCountByPhone = new Map(
      p2pRsvpCounts.map((row) => [row.phone_number, row.rsvp_count]),
    )

    const excludedPhoneSet = new Set(
      testPhoneNumbers.map(normalizePhone).filter((phone) => phone !== ''),
    )
    const exportRows: Array<ExportRow> = rows
      .filter((row) => !excludedPhoneSet.has(normalizePhone(row.phone)))
      .map((row) => ({
        'First Name': row.first_name ?? '',
        'Last Name': row.last_name ?? '',
        'Phone Number': normalizePhone(row.phone),
        'Initial Status': row.rsvp_count === 0 ? 'Abandoned' : 'Partial',
        'Current Status': row.rsvp_count === 0 ? 'Abandoned' : 'Partial',
        'Resume URL': buildResumeUrl(row.submission_id, row.source),
        'Slot Commitments': row.slot_commitments ?? '',
        'Slots Missing RSVPs': row.slots_missing_rsvps ?? '',
        'Submitted At': row.submitted_at,
        'Current RSVP Count': row.rsvp_count,
        'Other RSVPs Jun 13-23': Math.max(
          (p2pRsvpCountByPhone.get(normalizePhone(row.phone)) ?? 0) -
            row.rsvp_count,
          0,
        ),
        'Has Other Completed Commitment': row.has_other_completed_commitment
          ? true
          : '',
      }))

    return await upsertRowsToSheet(
      gcs,
      destinationSheet,
      exportRows,
      testPhoneNumbers,
    )
  } finally {
    await Promise.all([
      sql.end({ timeout: 5 }),
      electoralP2PSql.end({ timeout: 5 }),
    ])
  }
}
