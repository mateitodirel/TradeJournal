import { Bar, BarChart, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from 'recharts'
import { COLORS } from '../colors'
import type { AnalyticsSummary } from '../types'

export function DayOfWeekChart({ data }: { data: AnalyticsSummary['dayOfWeek'] }) {
  return (
    <div className="card" style={{ padding: 16, flex: 1, minWidth: 320 }}>
      <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 4 }}>
        Performance by Day of Week (all-time)
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <XAxis dataKey="day" tick={{ fill: COLORS.textMuted, fontSize: 11 }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
          <YAxis tick={{ fill: COLORS.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, fontSize: 12 }}
            formatter={(v) => [`$${v}`, 'P&L']}
            labelFormatter={(label, items) => {
              const p = items?.[0]?.payload
              return p ? `${label} — ${p.trades} trades, ${p.winRate}% win rate` : label
            }}
          />
          <Bar dataKey="pnl" radius={[4, 4, 4, 4]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.pnl >= 0 ? COLORS.green : COLORS.red} opacity={d.trades === 0 ? 0.25 : 1} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
