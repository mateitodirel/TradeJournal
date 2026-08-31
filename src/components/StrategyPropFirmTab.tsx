import { useEffect, useState } from 'react'
import { Line, LineChart, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { COLORS } from '../colors'
import { PROP_FIRM_PRESETS } from '../propFirmPresets'
import type { DrawdownMode, FundedChallengeResult, StrategyPropSimHistoryEntry } from '../types'

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 110 }}>
      <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: color ?? 'var(--text)' }}>{value}</div>
    </div>
  )
}

export function StrategyPropFirmTab({ strategyId }: { strategyId: number }) {
  const [presetId, setPresetId] = useState('custom')
  const [profitTargetPct, setProfitTargetPct] = useState('8')
  const [maxDailyLossPct, setMaxDailyLossPct] = useState('5')
  const [maxOverallDrawdownPct, setMaxOverallDrawdownPct] = useState('10')
  const [riskPerTradePct, setRiskPerTradePct] = useState('1')
  const [tradingDaysRemaining, setTradingDaysRemaining] = useState('30')
  const [drawdownMode, setDrawdownMode] = useState<DrawdownMode>('trailing-intraday')
  const [lockDrawdownAtBreakeven, setLockDrawdownAtBreakeven] = useState(false)
  const [enforceConsistencyRule, setEnforceConsistencyRule] = useState(false)
  const [maxDayProfitPct, setMaxDayProfitPct] = useState('30')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<FundedChallengeResult | null>(null)
  const [history, setHistory] = useState<StrategyPropSimHistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  const loadHistory = () => {
    setHistoryLoading(true)
    window.api.analytics.getStrategyPropSimHistory(strategyId).then((rows) => {
      setHistory(rows ?? [])
      setHistoryLoading(false)
    })
  }

  useEffect(loadHistory, [strategyId])

  const applyPreset = (id: string) => {
    setPresetId(id)
    if (id === 'custom') return
    const preset = PROP_FIRM_PRESETS.find((p) => p.id === id)
    if (!preset) return
    setProfitTargetPct(String(preset.profitTargetPct))
    setMaxDailyLossPct(String(preset.maxDailyLossPct))
    setMaxOverallDrawdownPct(String(preset.maxOverallDrawdownPct))
    setDrawdownMode(preset.drawdownMode)
    if (preset.maxDayProfitPct !== null) {
      setEnforceConsistencyRule(true)
      setMaxDayProfitPct(String(preset.maxDayProfitPct))
    } else {
      setEnforceConsistencyRule(false)
    }
  }

  const runSimulation = async () => {
    setRunning(true)
    try {
      const params = {
        profitTargetPct: parseFloat(profitTargetPct) || 0,
        maxDailyLossPct: parseFloat(maxDailyLossPct) || 0,
        maxOverallDrawdownPct: parseFloat(maxOverallDrawdownPct) || 0,
        riskPerTradePct: parseFloat(riskPerTradePct) || 0,
        tradingDaysRemaining: parseFloat(tradingDaysRemaining) || 1,
        drawdownMode,
        lockDrawdownAtBreakeven,
        enforceConsistencyRule,
        maxDayProfitPct: parseFloat(maxDayProfitPct) || 30,
        strategyId,
      }
      const res: FundedChallengeResult = await window.api.analytics.simulateFundedChallenge(params)
      setResult(res)
      const preset = presetId === 'custom' ? null : PROP_FIRM_PRESETS.find((p) => p.id === presetId) ?? null
      await window.api.analytics.saveStrategyPropSimResult(strategyId, preset?.label ?? null, params, res)
      loadHistory()
    } finally {
      setRunning(false)
    }
  }

  const trendData = [...history]
    .slice()
    .reverse()
    .map((h) => ({ date: h.createdAt.slice(0, 10), passRate: h.passRate }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ padding: 16 }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 12 }}>
          Prop Firm simulation scoped to this strategy's trades only (block-bootstrap Monte Carlo over this playbook's logged R-multiples). Treat as a rough guide, not a guarantee.
        </div>

        <div style={{ marginBottom: 12 }}>
          <label className="field" style={{ minWidth: 220, maxWidth: 320 }}>Firm Preset
            <select className="input" value={presetId} onChange={(e) => applyPreset(e.target.value)}>
              <option value="custom">Custom</option>
              {PROP_FIRM_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          <label className="field" style={{ minWidth: 130 }}>Profit Target %
            <input className="input" type="number" step="any" value={profitTargetPct} onChange={(e) => { setPresetId('custom'); setProfitTargetPct(e.target.value) }} />
          </label>
          <label className="field" style={{ minWidth: 130 }}>Max Daily Loss %
            <input className="input" type="number" step="any" value={maxDailyLossPct} onChange={(e) => { setPresetId('custom'); setMaxDailyLossPct(e.target.value) }} />
          </label>
          <label className="field" style={{ minWidth: 130 }}>Max Drawdown %
            <input className="input" type="number" step="any" value={maxOverallDrawdownPct} onChange={(e) => { setPresetId('custom'); setMaxOverallDrawdownPct(e.target.value) }} />
          </label>
          <label className="field" style={{ minWidth: 130 }}>Risk per Trade %
            <input className="input" type="number" step="any" value={riskPerTradePct} onChange={(e) => setRiskPerTradePct(e.target.value)} />
          </label>
          <label className="field" style={{ minWidth: 130 }}>Trading Days Left
            <input className="input" type="number" step="any" value={tradingDaysRemaining} onChange={(e) => setTradingDaysRemaining(e.target.value)} />
          </label>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 12, alignItems: 'flex-end' }}>
          <label className="field" style={{ minWidth: 200 }}>Drawdown Mode
            <select className="input" value={drawdownMode} onChange={(e) => { setPresetId('custom'); setDrawdownMode(e.target.value as DrawdownMode) }}>
              <option value="static">Static (fixed from start)</option>
              <option value="trailing-eod">Trailing — end of day</option>
              <option value="trailing-intraday">Trailing — intraday</option>
            </select>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-muted)' }}>
            <input type="checkbox" checked={lockDrawdownAtBreakeven} onChange={(e) => setLockDrawdownAtBreakeven(e.target.checked)} />
            Lock drawdown floor at breakeven
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-muted)' }}>
            <input type="checkbox" checked={enforceConsistencyRule} onChange={(e) => { setPresetId('custom'); setEnforceConsistencyRule(e.target.checked) }} />
            Enforce consistency rule
          </label>
          {enforceConsistencyRule && (
            <label className="field" style={{ minWidth: 130 }}>Max Day Profit %
              <input className="input" type="number" step="any" value={maxDayProfitPct} onChange={(e) => { setPresetId('custom'); setMaxDayProfitPct(e.target.value) }} />
            </label>
          )}
          <button className="btn btn-primary" onClick={runSimulation} disabled={running}>
            {running ? 'Simulating…' : 'Run Simulation'}
          </button>
        </div>

        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {result.insufficientData && (
              <div style={{ color: 'var(--text-dim)', fontSize: 11.5 }}>
                Estimate confidence is {Math.round(result.credibilityWeight * 100)}% — based on {result.sampleSize} logged trade{result.sampleSize === 1 ? '' : 's'} from this strategy with an R-multiple or risk value. The rest of the sample is blended in from a neutral placeholder distribution. Log more trades on this playbook for a higher-confidence estimate.
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              <StatBox label="Pass Probability" value={`${result.passRate}%`} color="var(--green)" />
              <StatBox label="Daily-Loss Breach" value={`${result.dailyLossBreachRate}%`} color="var(--red)" />
              <StatBox label="Max-Drawdown Breach" value={`${result.maxDrawdownBreachRate}%`} color="var(--red)" />
              <StatBox label="Consistency Breach" value={`${result.consistencyBreachRate}%`} color="var(--red)" />
              <StatBox label="Ran Out of Days" value={`${result.ranOutOfDaysRate}%`} />
              <StatBox label="Median Days to Pass" value={result.medianDaysToPass !== null ? String(result.medianDaysToPass) : '—'} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              Based on {result.sampleSize} logged trade outcomes from this strategy ({Math.round(result.credibilityWeight * 100)}% confidence), simulated across 3,000 paths.
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 8 }}>
          Pass-Probability History <span style={{ color: 'var(--text-dim)' }}>(last {history.length} run{history.length === 1 ? '' : 's'})</span>
        </div>
        {historyLoading ? (
          <div style={{ color: 'var(--text-dim)', padding: 8 }}>Loading…</div>
        ) : history.length === 0 ? (
          <div style={{ color: 'var(--text-dim)', padding: 8 }}>No simulations saved yet for this strategy. Run one above to start tracking pass probability over time.</div>
        ) : (
          <>
            {trendData.length >= 2 && (
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={trendData}>
                  <XAxis dataKey="date" tick={{ fill: COLORS.textMuted, fontSize: 10 }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: COLORS.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip
                    contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [`${v}%`, 'Pass Rate']}
                  />
                  <Line type="monotone" dataKey="passRate" stroke={COLORS.accent} strokeWidth={2} dot={{ r: 3, fill: COLORS.accent }} />
                </LineChart>
              </ResponsiveContainer>
            )}
            <div style={{ overflowX: 'auto', marginTop: trendData.length >= 2 ? 12 : 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Preset</th>
                    <th>Pass Rate</th>
                    <th>Daily-Loss Breach</th>
                    <th>Max-DD Breach</th>
                    <th>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} style={{ cursor: 'default' }}>
                      <td>{h.createdAt.slice(0, 10)}</td>
                      <td>{h.presetLabel ?? 'Custom'}</td>
                      <td className={h.passRate >= 50 ? 'pnl-positive' : 'pnl-negative'}>{h.passRate}%</td>
                      <td>{h.dailyLossBreachRate}%</td>
                      <td>{h.maxDrawdownBreachRate}%</td>
                      <td>{Math.round(h.credibilityWeight * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
