import { useEffect, useState, type MouseEvent } from 'react'
import type { StrategyPerformance } from '../types'
import { formatRatio } from '../format'
import { StrategyDetailModal } from '../components/StrategyDetailModal'
import { StrategyComparisonModal } from '../components/StrategyComparisonModal'

const MAX_COMPARE = 4
const MIN_COMPARE = 2

export function PlaybooksPage({ refreshKey, onStrategiesChanged }: { refreshKey: number; onStrategiesChanged: () => void }) {
  const [perf, setPerf] = useState<StrategyPerformance[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [adding, setAdding] = useState(false)
  const [openStrategyId, setOpenStrategyId] = useState<number | null>(null)
  const [compareMode, setCompareMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [comparing, setComparing] = useState(false)

  const load = () => {
    setLoading(true)
    window.api.strategies.getPerformance().then((p) => {
      setPerf(p)
      setLoading(false)
    })
  }

  useEffect(load, [refreshKey])

  const addStrategy = async () => {
    if (!newName.trim()) return
    setAdding(true)
    try {
      await window.api.strategies.create({ name: newName.trim(), description: newDesc.trim() })
      setNewName('')
      setNewDesc('')
      onStrategiesChanged()
      load()
    } finally {
      setAdding(false)
    }
  }

  const removeStrategy = async (e: MouseEvent, id: number) => {
    e.stopPropagation()
    if (!confirm('Delete this playbook/strategy? Trades tagged with it will be untagged, not deleted.')) return
    await window.api.strategies.delete(id)
    onStrategiesChanged()
    load()
  }

  const toggleCompareMode = () => {
    setCompareMode((prev) => !prev)
    setSelectedIds([])
  }

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((i) => i !== id)
      if (prev.length >= MAX_COMPARE) return prev
      return [...prev, id]
    })
  }

  const handleCardClick = (id: number) => {
    if (compareMode) toggleSelected(id)
    else setOpenStrategyId(id)
  }

  const selectedStrategies = perf.filter((s) => selectedIds.includes(s.id))

  if (loading) return <div style={{ padding: 24, color: 'var(--text-muted)' }}>Loading playbooks…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ padding: 16 }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 10 }}>Add a Playbook / Strategy</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" placeholder="Name (e.g. London Breakout)" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ flex: 1 }} />
          <input className="input" placeholder="Rules / description (optional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} style={{ flex: 2 }} />
          <button className="btn btn-primary" onClick={addStrategy} disabled={adding || !newName.trim()}>Add</button>
        </div>
      </div>

      {perf.length > 0 && (
        <div className="card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {!compareMode ? (
            <button className="btn" onClick={toggleCompareMode} disabled={perf.length < MIN_COMPARE}>
              ⇄ Compare Playbooks
            </button>
          ) : (
            <>
              <button className="btn" onClick={toggleCompareMode}>Cancel</button>
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                Select {MIN_COMPARE}–{MAX_COMPARE} playbooks to compare ({selectedIds.length} selected)
              </div>
              <button
                className="btn btn-primary"
                style={{ marginLeft: 'auto' }}
                disabled={selectedIds.length < MIN_COMPARE}
                onClick={() => setComparing(true)}
              >
                Compare Selected ({selectedIds.length})
              </button>
            </>
          )}
        </div>
      )}

      {perf.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', padding: 12 }}>No playbooks yet. Add one above, then tag trades with it from the Trade Entry form.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {perf.map((s) => {
            const isSelected = selectedIds.includes(s.id)
            return (
            <div
              key={s.id}
              className="card"
              onClick={() => handleCardClick(s.id)}
              style={{
                padding: 16,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                borderColor: isSelected ? 'var(--accent)' : undefined,
                boxShadow: isSelected ? '0 0 0 1px var(--accent)' : undefined,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {compareMode && (
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 4,
                        border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                        background: isSelected ? 'var(--accent)' : 'transparent',
                        color: '#06231a',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        flexShrink: 0,
                      }}
                    >
                      {isSelected ? '✓' : ''}
                    </span>
                  )}
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                </div>
                {!compareMode && (
                  <button className="btn btn-danger" style={{ padding: '3px 8px', fontSize: 11 }} onClick={(e) => removeStrategy(e, s.id)}>✕</button>
                )}
              </div>
              <div style={{ color: 'var(--text-dim)', fontSize: 11, marginBottom: 8 }}>{s.tradeCount} trades</div>
              {s.description && (
                <div
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: 11.5,
                    lineHeight: 1.5,
                    marginBottom: 10,
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {s.description}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Win Rate</span><span>{s.winRate}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Profit Factor</span><span>{formatRatio(s.profitFactor)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Expectancy / trade</span><span>${s.expectancy.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Avg R Multiple</span><span>{s.avgRMultiple.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Plan Adherence</span><span>{s.planAdherence}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Total P&L</span>
                  <span className={s.totalPnl >= 0 ? 'pnl-positive' : 'pnl-negative'}>${s.totalPnl.toFixed(0)}</span>
                </div>
              </div>
            </div>
            )
          })}
        </div>
      )}

      {openStrategyId !== null && (
        <StrategyDetailModal
          strategyId={openStrategyId}
          onClose={() => setOpenStrategyId(null)}
          onChanged={() => {
            load()
            onStrategiesChanged()
          }}
        />
      )}

      {comparing && selectedStrategies.length >= MIN_COMPARE && (
        <StrategyComparisonModal strategies={selectedStrategies} onClose={() => setComparing(false)} />
      )}
    </div>
  )
}
