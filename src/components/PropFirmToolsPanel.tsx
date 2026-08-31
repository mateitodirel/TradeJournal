import { useState } from 'react'
import type { AnalyticsSummary, DrawdownMode, FundedChallengeResult } from '../types'
import { PROP_FIRM_PRESETS } from '../propFirmPresets'

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 110 }}>
      <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: color ?? 'var(--text)' }}>{value}</div>
    </div>
  )
}

export function PropFirmToolsPanel({ overall }: { overall: AnalyticsSummary['overall'] }) {
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
      const res = await window.api.analytics.simulateFundedChallenge({
        profitTargetPct: parseFloat(profitTargetPct) || 0,
        maxDailyLossPct: parseFloat(maxDailyLossPct) || 0,
        maxOverallDrawdownPct: parseFloat(maxOverallDrawdownPct) || 0,
        riskPerTradePct: parseFloat(riskPerTradePct) || 0,
        tradingDaysRemaining: parseFloat(tradingDaysRemaining) || 1,
        drawdownMode,
        lockDrawdownAtBreakeven,
        enforceConsistencyRule,
        maxDayProfitPct: parseFloat(maxDayProfitPct) || 30,
      })
      setResult(res)
    } finally {
      setRunning(false)
    }
  }

  const payoffRatio = overall.avgLoss > 0 ? overall.avgWin / overall.avgLoss : 0
  const winRateFrac = overall.winRate / 100
  const kellyPct = payoffRatio > 0 ? Math.max(0, Math.min(1, winRateFrac - (1 - winRateFrac) / payoffRatio)) * 100 : 0

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 12 }}>
        Prop Firm Tools — estimates computed locally from your own trade history (block-bootstrap Monte Carlo over your logged R-multiples). Treat as a rough guide, not a guarantee.
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {result.insufficientData && (
            <div style={{ color: 'var(--text-dim)', fontSize: 11.5 }}>
              Estimate confidence is {Math.round(result.credibilityWeight * 100)}% — based on {result.sampleSize} logged trade{result.sampleSize === 1 ? '' : 's'} with an R-multiple or risk value. The rest of the sample is blended in from a neutral placeholder distribution. Log more risk-per-trade / R-multiple values for a higher-confidence estimate based on your real edge.
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
            Based on {result.sampleSize} logged trade outcomes ({Math.round(result.credibilityWeight * 100)}% confidence), simulated across 3,000 paths.
          </div>
        </div>
      )}

      <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 12 }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 8 }}>Kelly Criterion — suggested risk per trade</div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <StatBox label="Full Kelly" value={overall.totalTrades >= 10 ? `${kellyPct.toFixed(1)}%` : '—'} />
          <StatBox label="Half Kelly (safer)" value={overall.totalTrades >= 10 ? `${(kellyPct / 2).toFixed(1)}%` : '—'} color="var(--accent)" />
          <StatBox label="Your Win Rate / Payoff" value={overall.totalTrades >= 10 ? `${overall.winRate}% / ${payoffRatio.toFixed(2)}` : '—'} />
        </div>
        {overall.totalTrades < 10 && (
          <div style={{ color: 'var(--text-dim)', fontSize: 11.5, marginTop: 8 }}>Log at least 10 trades to unlock a Kelly sizing suggestion.</div>
        )}
      </div>
    </div>
  )
}
