import { useEffect, useState } from 'react'
import { Bar, BarChart, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from 'recharts'
import { Modal } from './Modal'
import { EquityCurveChart } from './EquityCurveChart'
import { DayOfWeekChart } from './DayOfWeekChart'
import { formatRatio } from '../format'
import { COLORS } from '../colors'
import type { StrategyDetail } from '../types'

function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border-soft)' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 600, color: color ?? 'var(--text)' }}>{value}</span>
    </div>
  )
}

export function StrategyDetailModal({
  strategyId,
  onClose,
  onChanged,
}: {
  strategyId: number
  onClose: () => void
  onChanged: () => void
}) {
  const [detail, setDetail] = useState<StrategyDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingDesc, setEditingDesc] = useState(false)
  const [descDraft, setDescDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    window.api.strategies.getDetail(strategyId).then((d) => {
      setDetail(d)
      setDescDraft(d?.description ?? '')
      setLoading(false)
    })
  }

  useEffect(load, [strategyId])

  const saveDescription = async () => {
    if (!detail) return
    setSaving(true)
    try {
      await window.api.strategies.update(detail.id, { name: detail.name, description: descDraft })
      setEditingDesc(false)
      onChanged()
      load()
    } finally {
      setSaving(false)
    }
  }

  if (loading || !detail) {
    return (
      <Modal title="Playbook" onClose={onClose} wide>
        <div style={{ color: 'var(--text-muted)', padding: 20 }}>Loading…</div>
      </Modal>
    )
  }

  return (
    <Modal title={detail.name} onClose={onClose} wide>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Rules / Description</div>
            {!editingDesc && <button className="btn" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => setEditingDesc(true)}>Edit</button>}
          </div>
          {editingDesc ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <textarea className="input" rows={5} value={descDraft} onChange={(e) => setDescDraft(e.target.value)} placeholder="Entry criteria, confirmation, risk rules, invalidation…" />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn" onClick={() => { setEditingDesc(false); setDescDraft(detail.description) }}>Cancel</button>
                <button className="btn btn-primary" onClick={saveDescription} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </div>
          ) : (
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, color: detail.description ? 'var(--text)' : 'var(--text-dim)' }}>
              {detail.description || 'No rules written yet. Click Edit to define this playbook.'}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div className="card" style={{ padding: 16, width: 240, flexShrink: 0 }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 4 }}>Performance</div>
            <StatRow label="Trades" value={String(detail.stats.tradeCount)} />
            <StatRow label="Win Rate" value={`${detail.stats.winRate}%`} />
            <StatRow label="Profit Factor" value={formatRatio(detail.stats.profitFactor)} />
            <StatRow label="Expectancy / trade" value={`$${detail.stats.expectancy.toFixed(2)}`} />
            <StatRow label="Avg R Multiple" value={detail.stats.avgRMultiple.toFixed(2)} />
            <StatRow label="Plan Adherence" value={`${detail.stats.planAdherence}%`} />
            <StatRow label="Avg Win" value={`$${detail.stats.avgWin.toFixed(2)}`} color="var(--green)" />
            <StatRow label="Avg Loss" value={`-$${detail.stats.avgLoss.toFixed(2)}`} color="var(--red)" />
            <StatRow
              label="Total P&L"
              value={`$${detail.stats.totalPnl.toFixed(0)}`}
              color={detail.stats.totalPnl >= 0 ? 'var(--green)' : 'var(--red)'}
            />
          </div>

          {detail.equityCurve.length >= 2 ? (
            <EquityCurveChart equityCurve={detail.equityCurve} drawdown={detail.drawdown} />
          ) : (
            <div className="card" style={{ padding: 16, flex: 2, minWidth: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
              Not enough trades yet for an equity curve
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div className="card" style={{ padding: 16, width: 240, flexShrink: 0 }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 4 }}>
              Advanced Metrics <span style={{ color: 'var(--text-dim)' }}>(PnL-based)</span>
            </div>
            <StatRow label="Sharpe" value={detail.quantMetrics.sharpe.toFixed(2)} />
            <StatRow label="Sortino" value={detail.quantMetrics.sortino.toFixed(2)} />
            <StatRow label="Calmar" value={detail.quantMetrics.calmar.toFixed(2)} />
            <StatRow label="Recovery Factor" value={formatRatio(detail.quantMetrics.recoveryFactor)} />
            <StatRow label="Ulcer Index" value={`$${detail.quantMetrics.ulcerIndex.toFixed(2)}`} />
            <StatRow label="Gain-to-Pain" value={formatRatio(detail.quantMetrics.gainToPainRatio)} />
            <StatRow label="Max Win Streak" value={String(detail.quantMetrics.maxWinStreak)} color="var(--green)" />
            <StatRow label="Max Loss Streak" value={String(detail.quantMetrics.maxLossStreak)} color="var(--red)" />
            <StatRow label="Outlier Win Ratio" value={detail.quantMetrics.outlierWinRatio.toFixed(2)} />
            <StatRow label="Outlier Loss Ratio" value={detail.quantMetrics.outlierLossRatio.toFixed(2)} />
            <StatRow
              label="SQN"
              value={detail.quantMetrics.sqn === null ? 'Need 5+ R-trades' : `${detail.quantMetrics.sqn.toFixed(2)} (${detail.quantMetrics.sqnRating})`}
            />
            <StatRow
              label="Skew / Kurtosis (R)"
              value={
                detail.quantMetrics.skewness === null || detail.quantMetrics.kurtosis === null
                  ? 'Need 5+ R-trades'
                  : `${detail.quantMetrics.skewness.toFixed(2)} / ${detail.quantMetrics.kurtosis.toFixed(2)}`
              }
            />
          </div>

          <div className="card" style={{ padding: 16, flex: 2, minWidth: 320 }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 4 }}>R-Multiple Distribution</div>
            {detail.quantMetrics.rMultipleHistogram.every((b) => b.count === 0) ? (
              <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
                No R-multiples logged yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={detail.quantMetrics.rMultipleHistogram}>
                  <XAxis dataKey="bucket" tick={{ fill: COLORS.textMuted, fontSize: 10 }} axisLine={{ stroke: COLORS.border }} tickLine={false} interval={0} angle={-45} textAnchor="end" height={60} />
                  <YAxis tick={{ fill: COLORS.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [v, 'Trades']}
                  />
                  <Bar dataKey="count" radius={[4, 4, 4, 4]}>
                    {detail.quantMetrics.rMultipleHistogram.map((b, i) => (
                      <Cell key={i} fill={b.bucket.startsWith('-') || b.bucket.startsWith('<') ? COLORS.red : COLORS.green} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <DayOfWeekChart data={detail.dayOfWeek} />

        <div className="card" style={{ overflowX: 'auto', maxHeight: 260, overflowY: 'auto' }}>
          <div style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 12, borderBottom: '1px solid var(--border-soft)' }}>
            Trades using this playbook ({detail.trades.length}{detail.trades.length === 50 ? '+' : ''})
          </div>
          {detail.trades.length === 0 ? (
            <div style={{ padding: 16, color: 'var(--text-muted)' }}>No trades tagged with this playbook yet.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Name</th>
                  <th>Pair</th>
                  <th>P/L</th>
                  <th>Followed Plan</th>
                </tr>
              </thead>
              <tbody>
                {detail.trades.map((t) => (
                  <tr key={t.id} style={{ cursor: 'default' }}>
                    <td>{t.date}</td>
                    <td>{t.name || '—'}</td>
                    <td>{t.pair || '—'}</td>
                    <td className={t.pnl >= 0 ? 'pnl-positive' : 'pnl-negative'}>{t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(2)}</td>
                    <td className="checkbox-cell">{t.followed_plan ? '✅' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Modal>
  )
}
