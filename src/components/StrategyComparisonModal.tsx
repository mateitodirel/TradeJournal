import { useEffect, useState } from 'react'
import { Modal } from './Modal'
import { StrategyComparisonChart } from './StrategyComparisonChart'
import { formatRatio } from '../format'
import { COMPARISON_LINE_COLORS } from '../colors'
import type { StrategyPerformance, StrategyDetail, ComparisonSeries } from '../types'

interface MetricRow {
  label: string
  format: (v: number) => string
  getValue: (s: StrategyPerformance) => number
  highlightBest: boolean
}

const METRIC_ROWS: MetricRow[] = [
  { label: 'Win Rate', getValue: (s) => s.winRate, format: (v) => `${v}%`, highlightBest: true },
  { label: 'Profit Factor', getValue: (s) => s.profitFactor, format: (v) => formatRatio(v), highlightBest: true },
  { label: 'Expectancy / trade', getValue: (s) => s.expectancy, format: (v) => `$${v.toFixed(2)}`, highlightBest: true },
  { label: 'Avg R Multiple', getValue: (s) => s.avgRMultiple, format: (v) => v.toFixed(2), highlightBest: true },
  { label: 'Plan Adherence', getValue: (s) => s.planAdherence, format: (v) => `${v}%`, highlightBest: true },
  { label: 'Total P&L', getValue: (s) => s.totalPnl, format: (v) => `$${v.toFixed(0)}`, highlightBest: true },
  { label: 'Trade Count', getValue: (s) => s.tradeCount, format: (v) => String(v), highlightBest: false },
]

export function StrategyComparisonModal({
  strategies,
  onClose,
}: {
  strategies: StrategyPerformance[]
  onClose: () => void
}) {
  const [series, setSeries] = useState<ComparisonSeries[] | null>(null)

  useEffect(() => {
    let cancelled = false
    setSeries(null)
    Promise.all(strategies.map((s) => window.api.strategies.getDetail(s.id) as Promise<StrategyDetail>)).then((details) => {
      if (cancelled) return
      setSeries(
        details.map((d, i) => ({
          id: strategies[i].id,
          name: strategies[i].name,
          equityCurve: d.equityCurve,
        })),
      )
    })
    return () => {
      cancelled = true
    }
  }, [strategies])

  return (
    <Modal title="Compare Playbooks" onClose={onClose} wide>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {series === null ? (
          <div style={{ color: 'var(--text-muted)', padding: 20 }}>Loading comparison…</div>
        ) : (
          <StrategyComparisonChart series={series} />
        )}

        <div className="card" style={{ padding: 16, overflowX: 'auto' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 10 }}>Metric Comparison</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--text-muted)', fontWeight: 500, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                  Metric
                </th>
                {strategies.map((s, i) => (
                  <th
                    key={s.id}
                    style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: '50%',
                          background: COMPARISON_LINE_COLORS[i % COMPARISON_LINE_COLORS.length],
                          display: 'inline-block',
                        }}
                      />
                      {s.name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRIC_ROWS.map((row) => {
                const values = strategies.map(row.getValue)
                const best = row.highlightBest ? Math.max(...values) : null
                return (
                  <tr key={row.label}>
                    <td style={{ padding: '8px 10px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-soft)', whiteSpace: 'nowrap' }}>
                      {row.label}
                    </td>
                    {strategies.map((s, i) => {
                      const v = values[i]
                      const isBest = best !== null && v === best
                      return (
                        <td
                          key={s.id}
                          style={{
                            padding: '8px 10px',
                            textAlign: 'right',
                            borderBottom: '1px solid var(--border-soft)',
                            whiteSpace: 'nowrap',
                            fontWeight: isBest ? 700 : 400,
                            color: isBest ? 'var(--accent)' : 'var(--text)',
                          }}
                        >
                          {row.format(v)}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  )
}
