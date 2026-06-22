import * as wmill from 'windmill-client'

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  const str = typeof value === 'object' ? JSON.stringify(value) : String(value)

  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }

  return str
}

function rowsToCsv(rows: unknown): string {
  if (!Array.isArray(rows)) {
    throw new Error('Expected send_brad_data to return an array of rows')
  }

  if (rows.length === 0) {
    return ''
  }

  const firstRow = rows[0]
  if (
    typeof firstRow !== 'object' ||
    firstRow === null ||
    Array.isArray(firstRow)
  ) {
    throw new Error('Expected send_brad_data rows to be objects')
  }

  const keys = Object.keys(firstRow as Record<string, unknown>)
  const lines = [keys.map(csvEscape).join(',')]

  for (const row of rows) {
    const record = row as Record<string, unknown>
    lines.push(keys.map((key) => csvEscape(record[key])).join(','))
  }

  return `${lines.join('\n')}\n`
}

export async function main() {
  const rows = await wmill.runScriptByPath('f/canvass_map/send_brad_data')
  const csv = rowsToCsv(rows)

  return {
    wm_content_type: 'text/csv; charset=utf-8',
    windmill_content_type: 'text/csv; charset=utf-8',
    wm_headers: {
      'Content-Disposition': 'attachment; filename="brad_data.csv"',
    },
    windmill_headers: {
      'Content-Disposition': 'attachment; filename="brad_data.csv"',
    },
    result: csv,
  }
}
