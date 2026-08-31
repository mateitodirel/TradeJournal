import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, ResponsiveContainer, Tooltip, CartesianGrid, Cell } from 'recharts'
import { COLORS } from '../colors'
import type { StrategyDetail } from '../types'

// Exit efficiency = how much of the maximum favorable move (MFE) a trade's realized
// R-multiple actually captured before exit. Only meaningful for a winning trade with a
// logged, positive MFE. Real-world logs can be messy (r_multiple > mfe_r, e.g. mfe_r was
// under-logged) — rather than reporting a nonsensical >100%, the value is capped at 100%
// and the trade is flagged so the raw ratio can still be surfaced on hover.
function exitEfficiencyOf(rMultiple: number | null, mfeR: number | null): { pct: number; flagged: boolean } | null {
  if (rMultiple === null || rMultiple <= 0) return null
  if (mfeR === null || mfeR <= 0) return null
  const raw = rMultiple / mfeR
  return { pct: Math.min(raw, 1) * 100, flagged: raw > 1 }
}

type ScatterPoint = {
  id: number
  name: string
  date: string
  x: number // mae_r (heat taken, logged as a negative/zero R value)
  y: number // mfe_r (favorable room that existed, logged as a positive/zero R value)
  mae_r: number | null
  mfe_r: number | null
  r_multiple: number | null
  isWin: boolean
  efficiency: { pct: number; flagged: boolean } | null
}

export function MfeMaeScatter({ trades }: { trades: StrategyDetail['trades'] }) {
  const logged = trades.filter((t) => t.mfe_r !== null || t.mae_r !== null)

  const points: ScatterPoint[] = logged.map((t) => ({
    id: t.id,
    name: t.name,
    date: t.date,
    x: t.mae_r ?? 0,
    y: t.mfe_r ?? 0,
    mae_r: t.mae_r,
    mfe_r: t.mfe_r,
    r_multiple: t.r_multiple,
    isWin: t.pnl >= 0,
    efficiency: exitEfficiencyOf(t.r_multiple, t.mfe_r),
  }))

  return (
    <div className="card" style={{ padding: 16, flex: 1, minWidth: 320 }}>
      <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 4 }}>MFE / MAE — Exit Efficiency</div>
      {points.length === 0 ? (
        <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
          No MFE/MAE data logged yet
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <ScatterChart margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
              <CartesianGrid stroke={COLORS.border} strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="x"
                name="MAE"
                tick={{ fill: COLORS.textMuted, fontSize: 11 }}
                axisLine={{ stroke: COLORS.border }}
                tickLine={false}
                label={{ value: 'MAE (R) — heat taken', position: 'insideBottom', offset: -4, fill: COLORS.textDim, fontSize: 10 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="MFE"
                tick={{ fill: COLORS.textMuted, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                label={{ value: 'MFE (R) — favorable room', angle: -90, position: 'insideLeft', fill: COLORS.textDim, fontSize: 10 }}
              />
              <ZAxis range={[60, 60]} />
              <Tooltip
                cursor={{ strokeDasharray: '3 3', stroke: COLORS.border }}
                contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, fontSize: 12 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const p = payload[0].payload as ScatterPoint
                  return (
                    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, fontSize: 12, padding: '6px 10px' }}>
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>{p.name || p.date}</div>
                      <div>MFE: {p.mfe_r === null ? 'not logged' : `${p.mfe_r.toFixed(2)}R`}</div>
                      <div>MAE: {p.mae_r === null ? 'not logged' : `${p.mae_r.toFixed(2)}R`}</div>
                      <div>R Multiple: {p.r_multiple === null ? '—' : p.r_multiple.toFixed(2)}</div>
                      <div>
                        Exit efficiency:{' '}
                        {p.efficiency === null ? 'n/a' : `${p.efficiency.pct.toFixed(0)}%${p.efficiency.flagged ? ' (capped — logged MFE below R)' : ''}`}
                      </div>
                    </div>
                  )
                }}
              />
              <Scatter data={points} isAnimationActive={false}>
                {points.map((p) => (
                  <Cell key={p.id} fill={p.isWin ? COLORS.green : COLORS.red} fillOpacity={0.8} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <div style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 4 }}>
            Green = winning trades, red = losing trades. Points near the diagonal captured most of the available move; points far below it left R on the table.
          </div>
        </>
      )}
    </div>
  )
}
