import fs from 'node:fs'
import { getDb } from './db'

export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim().length > 0)
  const splitLine = (line: string) => {
    const cells: string[] = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"'
          i++
        } else if (ch === '"') {
          inQuotes = false
        } else {
          cur += ch
        }
      } else if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        cells.push(cur)
        cur = ''
      } else {
        cur += ch
      }
    }
    cells.push(cur)
    return cells.map((c) => c.trim())
  }
  const headers = lines.length ? splitLine(lines[0]) : []
  const rows = lines.slice(1).map(splitLine)
  return { headers, rows }
}

export function readCsvFile(filePath: string) {
  const text = fs.readFileSync(filePath, 'utf-8')
  return parseCsv(text)
}

export interface ColumnMapping {
  date: number
  pair?: number
  session?: number
  direction?: number
  risk_per_trade?: number
  pnl: number
  notes?: number
}

export function importTrades(rows: string[][], mapping: ColumnMapping, accountId: number | null): number {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT INTO trades (name, date, pair, session, direction, risk_per_trade, pnl, account_id, positive_tags, negative_tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]', '[]')
  `)
  let count = 0
  for (const row of rows) {
    const date = row[mapping.date]?.trim()
    const pnlRaw = row[mapping.pnl]?.replace(/[^0-9.\-]/g, '')
    if (!date || pnlRaw === undefined || pnlRaw === '') continue
    const pnl = parseFloat(pnlRaw)
    if (Number.isNaN(pnl)) continue
    stmt.run(
      'Imported trade',
      normalizeDate(date),
      mapping.pair !== undefined ? row[mapping.pair] ?? null : null,
      mapping.session !== undefined ? row[mapping.session] ?? null : null,
      mapping.direction !== undefined ? row[mapping.direction] ?? null : null,
      mapping.risk_per_trade !== undefined ? parseFloat(row[mapping.risk_per_trade]) || null : null,
      pnl,
      accountId
    )
    count++
  }
  return count
}

function normalizeDate(raw: string): string {
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toISOString().slice(0, 10)
}

export function tradesToCsv(): string {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT name, date, pair, session, direction, risk_per_trade, pnl, r_multiple,
              followed_plan, break_even, entry_win, positive_tags, negative_tags, notes
       FROM trades ORDER BY date ASC`
    )
    .all() as Record<string, unknown>[]

  const headers = [
    'name', 'date', 'pair', 'session', 'direction', 'risk_per_trade', 'pnl',
    'r_multiple', 'followed_plan', 'break_even', 'entry_win', 'positive_tags', 'negative_tags', 'notes',
  ]
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(','))
  }
  return lines.join('\n')
}
