import { Line, LineChart, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'
import { COLORS, COMPARISON_LINE_COLORS } from '../colors'
import type { ComparisonSeries } from '../types'

function buildMergedRows(series: ComparisonSeries[]) {
  const allDates = Array.from(new Set(series.flatMap((s) => s.equityCurve.map((e) => e.date)))).sort()
  return allDates.map((date) => {
    const row: Record<string, string | number | null> = { date }
    for (const s of series) {
      let val: number | null = null
      for (const e of s.equityCurve) {
        if (e.date > date) break
        val = e.cumulativePnl
      }
      row[`s${s.id}`] = val
    }
    return row
  })
}

export function StrategyComparisonChart({ series }: { series: ComparisonSeries[] }) {
  const hasEnoughData = series.some((s) => s.equityCurve.length >= 2)
  const rows = buildMergedRows(series)

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Equity Curve Comparison (all-time)</div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {series.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-muted)' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: COMPARISON_LINE_COLORS[i % COMPARISON_LINE_COLORS.length], display: 'inline-block' }} />
              {s.name}
            </div>
          ))}
        </div>
      </div>
      {!hasEnoughData ? (
        <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
          Not enough trades yet to plot equity curves
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={rows}>
            <CartesianGrid stroke={COLORS.border} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: COLORS.textMuted, fontSize: 10 }} axisLine={{ stroke: COLORS.border }} tickLine={false} minTickGap={30} />
            <YAxis tick={{ fill: COLORS.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, fontSize: 12 }}
              formatter={(v, key) => {
                const s = series.find((s) => `s${s.id}` === key)
                return [v === null ? '—' : `$${v}`, s?.name ?? key]
              }}
            />
            {series.map((s, i) => (
              <Line
                key={s.id}
                type="monotone"
                dataKey={`s${s.id}`}
                name={s.name}
                stroke={COMPARISON_LINE_COLORS[i % COMPARISON_LINE_COLORS.length]}
                strokeWidth={2}
                dot={false}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
