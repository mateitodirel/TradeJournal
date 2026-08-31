import { getDb } from './db'

export interface SummaryFilters {
  accountId?: number | null
  strategyId?: number | null
  month: string // 'YYYY-MM'
}

interface TradeRow {
  id: number
  date: string
  pnl: number
  followed_plan: number
  session: string | null
}

function fetchTrades(filters: SummaryFilters, monthScoped: boolean): TradeRow[] {
  const db = getDb()
  const clauses: string[] = []
  const p: (string | number)[] = []
  if (filters.accountId) {
    clauses.push('account_id = ?')
    p.push(filters.accountId)
  }
  if (filters.strategyId) {
    clauses.push('strategy_id = ?')
    p.push(filters.strategyId)
  }
  if (monthScoped) {
    clauses.push('date LIKE ?')
    p.push(`${filters.month}%`)
  }
  const finalWhere = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const stmt = db.prepare(`SELECT id, date, pnl, followed_plan, session FROM trades ${finalWhere} ORDER BY date ASC`)
  return stmt.all(...p) as unknown as TradeRow[]
}

function winRateOf(trades: TradeRow[]): number {
  if (!trades.length) return 0
  const wins = trades.filter((t) => t.pnl > 0).length
  return wins / trades.length
}

function profitFactorOf(trades: TradeRow[]): number {
  const grossProfit = trades.filter((t) => t.pnl > 0).reduce((s, t) => s + t.pnl, 0)
  const grossLoss = Math.abs(trades.filter((t) => t.pnl < 0).reduce((s, t) => s + t.pnl, 0))
  if (grossLoss === 0) return grossProfit > 0 ? 999 : 0
  return grossProfit / grossLoss
}

function planAdherenceOf(trades: TradeRow[]): number {
  if (!trades.length) return 0
  return trades.filter((t) => t.followed_plan).length / trades.length
}

function equityCurveOf(trades: TradeRow[]) {
  let cumulative = 0
  return trades.map((t) => {
    cumulative += t.pnl
    return { date: t.date, cumulativePnl: Math.round(cumulative * 100) / 100 }
  })
}

function drawdownOf(curve: { date: string; cumulativePnl: number }[]) {
  let peak = 0
  let maxDrawdown = 0
  const series = curve.map((p) => {
    peak = Math.max(peak, p.cumulativePnl)
    const dd = p.cumulativePnl - peak
    maxDrawdown = Math.min(maxDrawdown, dd)
    return { date: p.date, drawdown: Math.round(dd * 100) / 100 }
  })
  return { series, maxDrawdown: Math.abs(maxDrawdown) }
}

function consistencyScoreOf(trades: TradeRow[]): number {
  const byDay = new Map<string, number>()
  for (const t of trades) byDay.set(t.date, (byDay.get(t.date) ?? 0) + t.pnl)
  const daily = [...byDay.values()]
  if (daily.length < 2) return daily.length ? 100 : 0
  const mean = daily.reduce((s, v) => s + v, 0) / daily.length
  if (mean === 0) return 0
  const variance = daily.reduce((s, v) => s + (v - mean) ** 2, 0) / daily.length
  const stdev = Math.sqrt(variance)
  const score = (1 - Math.min(stdev / Math.abs(mean), 1)) * 100
  return Math.max(0, Math.min(100, score))
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function weekdayOf(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00`).getDay()
}

function dailyBarsOf(trades: TradeRow[]) {
  const byWeekday = new Array(7).fill(0)
  for (const t of trades) byWeekday[weekdayOf(t.date)] += t.pnl
  return WEEKDAYS.map((day, i) => ({ day, pnl: Math.round(byWeekday[i] * 100) / 100 }))
}

function dayOfWeekBreakdownOf(trades: TradeRow[]) {
  const buckets: TradeRow[][] = Array.from({ length: 7 }, () => [])
  for (const t of trades) buckets[weekdayOf(t.date)].push(t)
  return WEEKDAYS.map((day, i) => {
    const b = buckets[i]
    const pnl = b.reduce((s, t) => s + t.pnl, 0)
    return {
      day,
      trades: b.length,
      pnl: Math.round(pnl * 100) / 100,
      winRate: Math.round(winRateOf(b) * 1000) / 10,
    }
  })
}

function calendarOf(trades: TradeRow[]) {
  const byDate = new Map<string, { pnl: number; count: number }>()
  for (const t of trades) {
    const entry = byDate.get(t.date) ?? { pnl: 0, count: 0 }
    entry.pnl += t.pnl
    entry.count += 1
    byDate.set(t.date, entry)
  }
  const result: Record<string, { pnl: number; count: number }> = {}
  for (const [date, v] of byDate) result[date] = { pnl: Math.round(v.pnl * 100) / 100, count: v.count }
  return result
}

function accountStartingBalance(accountId?: number | null): number {
  const db = getDb()
  if (accountId) {
    const row = db.prepare('SELECT starting_balance FROM accounts WHERE id = ?').get(accountId) as
      | { starting_balance: number }
      | undefined
    return row?.starting_balance ?? 0
  }
  const row = db.prepare('SELECT COALESCE(SUM(starting_balance),0) as total FROM accounts').get() as {
    total: number
  }
  return row.total
}

function buildInsights(allTrades: TradeRow[], dayOfWeek: ReturnType<typeof dayOfWeekBreakdownOf>) {
  const insights: string[] = []
  if (allTrades.length < 5) {
    insights.push('Log a few more trades to unlock reliable insights (aim for 20+ before trusting patterns).')
    return insights
  }

  const active = dayOfWeek.filter((d) => d.trades >= 3)
  if (active.length >= 2) {
    const best = active.reduce((a, b) => (b.pnl > a.pnl ? b : a))
    const worst = active.reduce((a, b) => (b.pnl < a.pnl ? b : a))
    if (best.day !== worst.day && best.pnl > 0) {
      insights.push(`${best.day} is your strongest day (${best.pnl >= 0 ? '+' : ''}$${best.pnl.toFixed(0)} total, ${best.winRate}% win rate).`)
    }
    if (worst.pnl < 0) {
      insights.push(`${worst.day} has cost you $${Math.abs(worst.pnl).toFixed(0)} total — worth reviewing what's different about setups you take that day.`)
    }
  }

  const adherence = planAdherenceOf(allTrades)
  const followed = allTrades.filter((t) => t.followed_plan)
  const notFollowed = allTrades.filter((t) => !t.followed_plan)
  if (followed.length >= 3 && notFollowed.length >= 3) {
    const wrFollowed = winRateOf(followed) * 100
    const wrNot = winRateOf(notFollowed) * 100
    if (wrFollowed - wrNot > 10) {
      insights.push(`Trades where you followed your plan win ${(wrFollowed - wrNot).toFixed(0)} pts more often (${wrFollowed.toFixed(0)}% vs ${wrNot.toFixed(0)}%). Plan adherence is currently ${(adherence * 100).toFixed(0)}%.`)
    }
  }

  const pf = profitFactorOf(allTrades)
  if (pf > 0 && pf < 1) {
    insights.push(`Profit factor is below 1.0 (${pf.toFixed(2)}) — losses are outweighing wins overall.`)
  } else if (pf >= 2.5) {
    insights.push(`Profit factor is strong at ${pf.toFixed(2)} — wins are outweighing losses by a healthy margin.`)
  }

  return insights.slice(0, 5)
}

export function getSummary(filters: SummaryFilters) {
  const monthTrades = fetchTrades(filters, true)
  const allTrades = fetchTrades(filters, false)

  const equityCurve = equityCurveOf(allTrades)
  const { series: drawdownSeries, maxDrawdown } = drawdownOf(equityCurve)
  const netProfitAllTime = allTrades.reduce((s, t) => s + t.pnl, 0)
  const recoveryFactor = maxDrawdown === 0 ? (netProfitAllTime > 0 ? 5 : 0) : netProfitAllTime / maxDrawdown

  const winRate = winRateOf(monthTrades)
  const totalPnl = monthTrades.reduce((s, t) => s + t.pnl, 0)
  const startingBalance = accountStartingBalance(filters.accountId)
  const returnsPct = startingBalance > 0 ? (totalPnl / startingBalance) * 100 : 0
  const profitFactor = profitFactorOf(monthTrades)

  const allTimeWinRate = winRateOf(allTrades)
  const allTimeProfitFactor = profitFactorOf(allTrades)
  const consistencyScore = consistencyScoreOf(allTrades)
  const allTimePlanAdherence = planAdherenceOf(allTrades)

  const dayPnls = [...calendarValues(monthTrades)]
  const bestDayPnl = dayPnls.length ? Math.max(...dayPnls) : 0
  const worstDayPnl = dayPnls.length ? Math.min(...dayPnls) : 0
  const avgDailyPnl = dayPnls.length ? dayPnls.reduce((s, v) => s + v, 0) / dayPnls.length : 0

  const wins = monthTrades.filter((t) => t.pnl > 0)
  const losses = monthTrades.filter((t) => t.pnl < 0)
  const avgWin = wins.length ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0
  const avgLoss = losses.length ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : 0
  const riskReward = avgLoss === 0 ? (avgWin > 0 ? 5 : 0) : avgWin / avgLoss

  const dayOfWeek = dayOfWeekBreakdownOf(allTrades)

  const allWins = allTrades.filter((t) => t.pnl > 0)
  const allLosses = allTrades.filter((t) => t.pnl < 0)
  const allAvgWin = allWins.length ? allWins.reduce((s, t) => s + t.pnl, 0) / allWins.length : 0
  const allAvgLoss = allLosses.length ? Math.abs(allLosses.reduce((s, t) => s + t.pnl, 0) / allLosses.length) : 0

  return {
    kpis: {
      winRate: round1(winRate * 100),
      totalPnl: round2(totalPnl),
      returnsPct: round1(returnsPct),
      profitFactor: round2(profitFactor),
    },
    radar: [
      { metric: 'Win Rate', value: round1(allTimeWinRate * 100) },
      { metric: 'Recovery Factor', value: round1(Math.min(recoveryFactor / 5, 1) * 100) },
      { metric: 'Profit Factor', value: round1(Math.min(allTimeProfitFactor / 3, 1) * 100) },
      { metric: 'Consistency Score', value: round1(consistencyScore) },
      { metric: 'Plan Adherence', value: round1(allTimePlanAdherence * 100) },
    ],
    equityCurve,
    drawdown: { series: drawdownSeries, maxDrawdown: round2(maxDrawdown) },
    dailyBars: dailyBarsOf(monthTrades),
    dayOfWeek,
    calendar: calendarOf(monthTrades),
    monthlyStats: {
      winRate: round1(winRate * 100),
      riskReward: round2(riskReward),
      profitFactor: round2(profitFactor),
      bestDayPnl: round2(bestDayPnl),
      worstDayPnl: round2(worstDayPnl),
      avgDailyPnl: round2(avgDailyPnl),
      tradeCount: monthTrades.length,
    },
    insights: buildInsights(allTrades, dayOfWeek),
    overall: {
      winRate: round1(allTimeWinRate * 100),
      profitFactor: round2(allTimeProfitFactor),
      avgWin: round2(allAvgWin),
      avgLoss: round2(allAvgLoss),
      totalTrades: allTrades.length,
    },
  }
}

export interface MonthlyBreakdownFilters {
  accountId?: number | null
  strategyId?: number | null
  year: string // 'YYYY'
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function getMonthlyBreakdown(filters: MonthlyBreakdownFilters) {
  const db = getDb()
  const clauses: string[] = ['date LIKE ?']
  const p: (string | number)[] = [`${filters.year}%`]
  if (filters.accountId) {
    clauses.push('account_id = ?')
    p.push(filters.accountId)
  }
  if (filters.strategyId) {
    clauses.push('strategy_id = ?')
    p.push(filters.strategyId)
  }
  const rows = db.prepare(`SELECT date, pnl FROM trades WHERE ${clauses.join(' AND ')}`).all(...p) as {
    date: string
    pnl: number
  }[]
  const buckets = Array.from({ length: 12 }, () => ({ pnl: 0, count: 0 }))
  for (const r of rows) {
    const m = Number(r.date.slice(5, 7)) - 1
    if (m < 0 || m > 11) continue
    buckets[m].pnl += r.pnl
    buckets[m].count += 1
  }
  return buckets.map((b, i) => ({
    month: `${filters.year}-${String(i + 1).padStart(2, '0')}`,
    label: MONTH_LABELS[i],
    pnl: round2(b.pnl),
    tradeCount: b.count,
  }))
}

export type DrawdownMode = 'static' | 'trailing-eod' | 'trailing-intraday'

export interface FundedChallengeParams {
  profitTargetPct: number
  maxDailyLossPct: number
  maxOverallDrawdownPct: number
  riskPerTradePct: number
  tradingDaysRemaining: number
  drawdownMode?: DrawdownMode
  lockDrawdownAtBreakeven?: boolean
  maxDayProfitPct?: number | null
  enforceConsistencyRule?: boolean
  // When set, scope the simulation to one strategy's trades instead of the whole account.
  strategyId?: number | null
}

export interface FundedChallengeResult {
  sampleSize: number
  passRate: number
  dailyLossBreachRate: number
  maxDrawdownBreachRate: number
  consistencyBreachRate: number
  ranOutOfDaysRate: number
  medianDaysToPass: number | null
  insufficientData: boolean
  credibilityWeight: number
}

// Neutral placeholder R-multiple distribution used to fill out the resampling pool when
// logged trade history is thin — see credibility blending below.
const PLACEHOLDER_R_OUTCOMES = [1, 1, -1, -1, 2, -1, 1, -1, 1.5, -1]

export function simulateFundedChallenge(params: FundedChallengeParams): FundedChallengeResult {
  const db = getDb()
  const clauses: string[] = []
  const p: (string | number)[] = []
  if (params.strategyId) {
    clauses.push('strategy_id = ?')
    p.push(params.strategyId)
  }
  const finalWhere = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const rows = db
    .prepare(`SELECT pnl, r_multiple, risk_per_trade, date FROM trades ${finalWhere} ORDER BY date ASC`)
    .all(...p) as {
    pnl: number
    r_multiple: number | null
    risk_per_trade: number | null
    date: string
  }[]

  const rOutcomes: number[] = []
  for (const r of rows) {
    if (r.r_multiple !== null && r.r_multiple !== undefined) {
      rOutcomes.push(r.r_multiple)
    } else if (r.risk_per_trade) {
      rOutcomes.push(r.pnl / r.risk_per_trade)
    }
  }

  const loggedCount = rOutcomes.length
  // Credibility weight: how much to trust the real logged sample vs. the neutral placeholder.
  // w=0 at 0 logged trades (100% placeholder), w≈0.71 at 10, approaching 1 as history grows —
  // replaces the old hard "< 10 trades" cliff with a smooth blend.
  const credibilityWeight = loggedCount / (loggedCount + 4)
  const insufficientData = credibilityWeight < 0.6

  // Resampling pools: the block bootstrap below draws contiguous blocks from one of these two
  // chronological sequences, chosen per-block with probability credibilityWeight / (1 - credibilityWeight).
  const realPool = rOutcomes
  const placeholderPool = PLACEHOLDER_R_OUTCOMES

  const distinctDays = new Set(rows.map((r) => r.date)).size || 1
  const tradesPerDay = Math.max(1, Math.round(rows.length / distinctDays))

  const drawdownMode: DrawdownMode = params.drawdownMode ?? 'trailing-intraday'
  const lockDrawdownAtBreakeven = params.lockDrawdownAtBreakeven ?? false
  const enforceConsistencyRule = params.enforceConsistencyRule ?? false
  const maxDayProfitPct = params.maxDayProfitPct ?? 30

  // Block bootstrap: instead of drawing single trades IID (which erases autocorrelation and
  // makes losing streaks vanish), resample contiguous windows of the actual chronological
  // outcome sequence. Block length adapts to sample size — long enough to preserve streak
  // structure, short enough that a small logged history still has multiple blocks to draw from.
  function blockLength(poolSize: number): number {
    return Math.max(1, Math.min(10, Math.max(5, Math.round(poolSize / 4))))
  }

  // Pull `count` outcomes as a sequence of contiguous blocks, re-picking a new random block
  // (possibly from the other pool, per credibilityWeight) whenever the current block runs out.
  function drawBlockBootstrap(count: number): number[] {
    const result: number[] = []
    while (result.length < count) {
      const useReal = realPool.length > 0 && Math.random() < credibilityWeight
      const pool = useReal ? realPool : placeholderPool
      const len = Math.min(blockLength(pool.length), pool.length)
      const startMax = Math.max(1, pool.length - len + 1)
      const start = Math.floor(Math.random() * startMax)
      for (let i = 0; i < len && result.length < count; i++) {
        result.push(pool[start + i])
      }
    }
    return result
  }

  const N = 3000
  const days = Math.max(1, Math.min(Math.round(params.tradingDaysRemaining) || 1, 365))
  let passes = 0
  let dailyLossBreaches = 0
  let maxDrawdownBreaches = 0
  let consistencyFails = 0
  let ranOutOfDays = 0
  const daysToPass: number[] = []

  for (let sim = 0; sim < N; sim++) {
    let equityPct = 0
    let peakEquityPct = 0 // trailing-intraday peak
    let eodPeakEquityPct = 0 // trailing-eod peak (updated only between days)
    let drawdownFloorPct = -params.maxOverallDrawdownPct // absolute equity floor, updated per mode
    let breakevenLocked = false
    let outcome: 'pass' | 'dailyLoss' | 'maxDrawdown' | 'consistencyFail' | 'ranOut' = 'ranOut'
    let passDay = 0
    const dailyProfits: number[] = [] // per-day PnL (only positive contributions matter for consistency)
    let cumulativeProfitPct = 0 // sum of positive daily PnL so far (ignores losing days), for consistency check

    dayLoop: for (let d = 1; d <= days; d++) {
      let dailyPnlPct = 0
      const dayOutcomes = drawBlockBootstrap(tradesPerDay)
      for (let t = 0; t < tradesPerDay; t++) {
        const r = dayOutcomes[t]
        const pnlPct = r * params.riskPerTradePct
        equityPct += pnlPct
        dailyPnlPct += pnlPct
        peakEquityPct = Math.max(peakEquityPct, equityPct)

        if (lockDrawdownAtBreakeven && !breakevenLocked && equityPct >= 0) {
          breakevenLocked = true
        }

        let currentPeakForFloor: number
        if (drawdownMode === 'static') {
          currentPeakForFloor = 0
        } else if (drawdownMode === 'trailing-eod') {
          currentPeakForFloor = eodPeakEquityPct
        } else {
          currentPeakForFloor = peakEquityPct
        }
        drawdownFloorPct = breakevenLocked ? 0 : currentPeakForFloor - params.maxOverallDrawdownPct

        if (equityPct <= drawdownFloorPct) {
          outcome = 'maxDrawdown'
          break dayLoop
        }
        if (-dailyPnlPct >= params.maxDailyLossPct) {
          outcome = 'dailyLoss'
          break dayLoop
        }
        if (equityPct >= params.profitTargetPct) {
          dailyProfits.push(dailyPnlPct)
          cumulativeProfitPct += Math.max(0, dailyPnlPct)
          if (enforceConsistencyRule && cumulativeProfitPct > 0) {
            const largestDay = Math.max(...dailyProfits, 0)
            const breach = largestDay / cumulativeProfitPct > maxDayProfitPct / 100
            outcome = breach ? 'consistencyFail' : 'pass'
          } else {
            outcome = 'pass'
          }
          passDay = d
          break dayLoop
        }
      }
      dailyProfits.push(dailyPnlPct)
      cumulativeProfitPct += Math.max(0, dailyPnlPct)
      // trailing-eod peak only updates at day boundaries, not intraday
      eodPeakEquityPct = Math.max(eodPeakEquityPct, equityPct)
    }

    if (outcome === 'pass') {
      passes++
      daysToPass.push(passDay)
    } else if (outcome === 'consistencyFail') consistencyFails++
    else if (outcome === 'dailyLoss') dailyLossBreaches++
    else if (outcome === 'maxDrawdown') maxDrawdownBreaches++
    else ranOutOfDays++
  }

  daysToPass.sort((a, b) => a - b)
  const medianDaysToPass = daysToPass.length ? daysToPass[Math.floor(daysToPass.length / 2)] : null

  return {
    sampleSize: rOutcomes.length,
    passRate: round1((passes / N) * 100),
    dailyLossBreachRate: round1((dailyLossBreaches / N) * 100),
    maxDrawdownBreachRate: round1((maxDrawdownBreaches / N) * 100),
    consistencyBreachRate: round1((consistencyFails / N) * 100),
    ranOutOfDaysRate: round1((ranOutOfDays / N) * 100),
    medianDaysToPass,
    insufficientData,
    credibilityWeight: Math.round(credibilityWeight * 100) / 100,
  }
}

function* calendarValues(trades: TradeRow[]) {
  const byDate = new Map<string, number>()
  for (const t of trades) byDate.set(t.date, (byDate.get(t.date) ?? 0) + t.pnl)
  for (const v of byDate.values()) yield v
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}
function round2(n: number) {
  return Math.round(n * 100) / 100
}

export interface StrategyPerformance {
  id: number
  name: string
  description: string
  tradeCount: number
  winRate: number
  profitFactor: number
  expectancy: number
  totalPnl: number
  avgRMultiple: number
  planAdherence: number
  avgWin: number
  avgLoss: number
}

type StrategyTradeRow = TradeRow & {
  r_multiple: number | null
  name: string
  pair: string | null
  followed_rules: string | null
}

function parseJsonArray(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function strategyStats(trades: StrategyTradeRow[]) {
  const winRate = winRateOf(trades)
  const profitFactor = profitFactorOf(trades)
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0)
  const expectancy = trades.length ? totalPnl / trades.length : 0
  const wins = trades.filter((t) => t.pnl > 0)
  const losses = trades.filter((t) => t.pnl < 0)
  const avgWin = wins.length ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0
  const avgLoss = losses.length ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : 0
  const rTrades = trades.filter((t) => t.r_multiple !== null && t.r_multiple !== undefined)
  const avgRMultiple = rTrades.length ? rTrades.reduce((s, t) => s + (t.r_multiple ?? 0), 0) / rTrades.length : 0
  return {
    tradeCount: trades.length,
    winRate: round1(winRate * 100),
    profitFactor: round2(profitFactor),
    expectancy: round2(expectancy),
    totalPnl: round2(totalPnl),
    avgRMultiple: round2(avgRMultiple),
    planAdherence: round1(planAdherenceOf(trades) * 100),
    avgWin: round2(avgWin),
    avgLoss: round2(avgLoss),
  }
}

export interface RuleAdherenceBucket {
  tradeCount: number
  winRate: number
  expectancy: number
  avgRMultiple: number
  totalPnl: number
}

export type RuleAdherenceStats =
  | { hasRules: false }
  | { hasRules: true; allFollowed: RuleAdherenceBucket; notAllFollowed: RuleAdherenceBucket }

function ruleAdherenceBucket(trades: StrategyTradeRow[]): RuleAdherenceBucket {
  const winRate = winRateOf(trades)
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0)
  const expectancy = trades.length ? totalPnl / trades.length : 0
  const rTrades = trades.filter((t) => t.r_multiple !== null && t.r_multiple !== undefined)
  const avgRMultiple = rTrades.length ? rTrades.reduce((s, t) => s + (t.r_multiple ?? 0), 0) / rTrades.length : 0
  return {
    tradeCount: trades.length,
    winRate: round1(winRate * 100),
    expectancy: round2(expectancy),
    avgRMultiple: round2(avgRMultiple),
    totalPnl: round2(totalPnl),
  }
}

/**
 * Classifies each trade as "all rules followed" vs "not all followed" for a strategy's
 * defined rule checklist, and computes the same stat shape for each bucket — this is what
 * answers "is the strategy bad, or is my execution bad?"
 *
 * When the strategy has no rules defined yet, adherence tracking is meaningless (there's
 * nothing to have followed or not), so this returns { hasRules: false } rather than a
 * misleading 0%/100% split.
 */
export function ruleAdherenceStats(trades: StrategyTradeRow[], rules: string[]): RuleAdherenceStats {
  if (!rules.length) return { hasRules: false }

  const allFollowedTrades: StrategyTradeRow[] = []
  const notAllFollowedTrades: StrategyTradeRow[] = []
  for (const t of trades) {
    const followed = parseJsonArray(t.followed_rules)
    const allFollowed = rules.every((r) => followed.includes(r))
    if (allFollowed) allFollowedTrades.push(t)
    else notAllFollowedTrades.push(t)
  }

  return {
    hasRules: true,
    allFollowed: ruleAdherenceBucket(allFollowedTrades),
    notAllFollowed: ruleAdherenceBucket(notAllFollowedTrades),
  }
}

export function getStrategyPerformance(): StrategyPerformance[] {
  const db = getDb()
  const strategies = db.prepare('SELECT id, name, description FROM strategies ORDER BY name ASC').all() as {
    id: number
    name: string
    description: string | null
  }[]
  return strategies.map((s) => {
    const trades = db
      .prepare('SELECT id, date, pnl, followed_plan, session, r_multiple, name, pair FROM trades WHERE strategy_id = ?')
      .all(s.id) as unknown as StrategyTradeRow[]
    return {
      id: s.id,
      name: s.name,
      description: s.description ?? '',
      ...strategyStats(trades),
    }
  })
}

// --- quantstats-style per-strategy metrics pack -----------------------------------------------
// Pure formulas ported (not copied) from the public quantstats formula reference
// (ranaroussi/quantstats, Apache-2.0) — reimplemented from scratch against this app's
// data shape. All $-denominated (this app has no reliable per-strategy starting balance),
// so Sharpe/Sortino/Calmar here are annualized ratios of the day-aggregated PnL series,
// not literal % returns.

function mean(values: number[]): number {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0
}

// Population stdev, mirroring the convention already used by consistencyScoreOf().
function stdevOf(values: number[]): number {
  if (values.length < 2) return 0
  const m = mean(values)
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

function dailyPnlSeriesOf(trades: StrategyTradeRow[]): number[] {
  const byDay = new Map<string, number>()
  for (const t of trades) byDay.set(t.date, (byDay.get(t.date) ?? 0) + t.pnl)
  return [...byDay.values()]
}

function sharpeOf(dailyPnl: number[]): number {
  const sd = stdevOf(dailyPnl)
  if (sd === 0) return 0
  return (mean(dailyPnl) / sd) * Math.sqrt(252)
}

function sortinoOf(dailyPnl: number[]): number {
  const downsideDeviation = Math.sqrt(mean(dailyPnl.map((v) => Math.min(v, 0) ** 2)))
  if (downsideDeviation === 0) return 0
  return (mean(dailyPnl) / downsideDeviation) * Math.sqrt(252)
}

function calmarOf(dailyPnl: number[], maxDrawdownAbs: number, netProfit: number): number {
  if (maxDrawdownAbs === 0) return netProfit > 0 ? 5 : 0
  return (mean(dailyPnl) * 252) / maxDrawdownAbs
}

function recoveryFactorOf(totalPnl: number, maxDrawdownAbs: number): number {
  if (maxDrawdownAbs === 0) return totalPnl > 0 ? 5 : 0
  return totalPnl / maxDrawdownAbs
}

function ulcerIndexOf(drawdownSeries: { drawdown: number }[]): number {
  if (!drawdownSeries.length) return 0
  return Math.sqrt(mean(drawdownSeries.map((d) => d.drawdown ** 2)))
}

function gainToPainOf(trades: StrategyTradeRow[]): number {
  const netSum = trades.reduce((s, t) => s + t.pnl, 0)
  const grossLoss = Math.abs(trades.filter((t) => t.pnl < 0).reduce((s, t) => s + t.pnl, 0))
  if (grossLoss === 0) return netSum > 0 ? 999 : 0
  return netSum / grossLoss
}

function consecutiveStreaksOf(trades: StrategyTradeRow[]): { maxWinStreak: number; maxLossStreak: number } {
  let winStreak = 0
  let lossStreak = 0
  let maxWinStreak = 0
  let maxLossStreak = 0
  for (const t of trades) {
    if (t.pnl > 0) {
      winStreak += 1
      lossStreak = 0
    } else if (t.pnl < 0) {
      lossStreak += 1
      winStreak = 0
    } else {
      winStreak = 0
      lossStreak = 0
    }
    maxWinStreak = Math.max(maxWinStreak, winStreak)
    maxLossStreak = Math.max(maxLossStreak, lossStreak)
  }
  return { maxWinStreak, maxLossStreak }
}

// outlier ratio = mean(top ~10% by size) / mean(all). Falls back to largest/avg when the
// sample is too small (<10) for a meaningful top-10% slice.
function outlierRatioOf(magnitudes: number[]): number {
  if (!magnitudes.length) return 0
  const avg = mean(magnitudes)
  if (avg === 0) return 0
  const sorted = [...magnitudes].sort((a, b) => b - a)
  if (sorted.length < 10) return sorted[0] / avg
  const topCount = Math.max(1, Math.round(sorted.length * 0.1))
  return mean(sorted.slice(0, topCount)) / avg
}

function sqnOf(rMultiples: number[]): number | null {
  if (rMultiples.length < 5) return null
  const sd = stdevOf(rMultiples)
  if (sd === 0) return 0
  return Math.sqrt(rMultiples.length) * (mean(rMultiples) / sd)
}

function sqnRating(sqn: number): string {
  if (sqn < 1.6) return 'Poor'
  if (sqn < 2.0) return 'Below Average'
  if (sqn < 2.5) return 'Average'
  if (sqn < 3.0) return 'Good'
  if (sqn < 5.0) return 'Excellent'
  if (sqn < 7.0) return 'Superb'
  return 'Holy Grail'
}

const R_HISTOGRAM_BOUNDS = [-3, -2.5, -2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5, 3]

function rHistogramOf(rMultiples: number[]): { bucket: string; count: number }[] {
  const buckets: { bucket: string; count: number }[] = [{ bucket: '< -3.0', count: 0 }]
  for (let i = 0; i < R_HISTOGRAM_BOUNDS.length - 1; i++) {
    buckets.push({ bucket: `${R_HISTOGRAM_BOUNDS[i].toFixed(1)} to ${R_HISTOGRAM_BOUNDS[i + 1].toFixed(1)}`, count: 0 })
  }
  buckets.push({ bucket: '> 3.0', count: 0 })

  for (const r of rMultiples) {
    if (r < -3) {
      buckets[0].count += 1
      continue
    }
    if (r > 3) {
      buckets[buckets.length - 1].count += 1
      continue
    }
    let idx = R_HISTOGRAM_BOUNDS.length - 2
    for (let i = 0; i < R_HISTOGRAM_BOUNDS.length - 1; i++) {
      if (r >= R_HISTOGRAM_BOUNDS[i] && r < R_HISTOGRAM_BOUNDS[i + 1]) {
        idx = i
        break
      }
    }
    buckets[idx + 1].count += 1
  }
  return buckets
}

function skewKurtosisOf(rMultiples: number[]): { skewness: number | null; kurtosis: number | null } {
  if (rMultiples.length < 5) return { skewness: null, kurtosis: null }
  const sd = stdevOf(rMultiples)
  if (sd === 0) return { skewness: 0, kurtosis: 0 }
  const m = mean(rMultiples)
  const skewness = mean(rMultiples.map((r) => (r - m) ** 3)) / sd ** 3
  const kurtosis = mean(rMultiples.map((r) => (r - m) ** 4)) / sd ** 4 - 3
  return { skewness, kurtosis }
}

function strategyQuantMetrics(
  trades: StrategyTradeRow[],
  equityCurve: { date: string; cumulativePnl: number }[],
  drawdown: { series: { date: string; drawdown: number }[]; maxDrawdown: number }
) {
  const dailyPnl = dailyPnlSeriesOf(trades)
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0)
  const maxDrawdownAbs = drawdown.maxDrawdown

  const { maxWinStreak, maxLossStreak } = consecutiveStreaksOf(trades)

  const wins = trades.filter((t) => t.pnl > 0).map((t) => t.pnl)
  const losses = trades.filter((t) => t.pnl < 0).map((t) => Math.abs(t.pnl))
  const outlierWinRatio = outlierRatioOf(wins)
  const outlierLossRatio = outlierRatioOf(losses)

  const rTrades = trades.filter((t) => t.r_multiple !== null && t.r_multiple !== undefined)
  const rMultiples = rTrades.map((t) => t.r_multiple as number)
  const sqn = sqnOf(rMultiples)
  const { skewness, kurtosis } = skewKurtosisOf(rMultiples)

  return {
    sharpe: round2(sharpeOf(dailyPnl)),
    sortino: round2(sortinoOf(dailyPnl)),
    calmar: round2(calmarOf(dailyPnl, maxDrawdownAbs, totalPnl)),
    recoveryFactor: round2(recoveryFactorOf(totalPnl, maxDrawdownAbs)),
    ulcerIndex: round2(ulcerIndexOf(drawdown.series)),
    gainToPainRatio: round2(gainToPainOf(trades)),
    maxWinStreak,
    maxLossStreak,
    outlierWinRatio: round2(outlierWinRatio),
    outlierLossRatio: round2(outlierLossRatio),
    sqn: sqn === null ? null : round2(sqn),
    sqnRating: sqn === null ? null : sqnRating(sqn),
    rMultipleHistogram: rHistogramOf(rMultiples),
    skewness: skewness === null ? null : round2(skewness),
    kurtosis: kurtosis === null ? null : round2(kurtosis),
  }
}
// -----------------------------------------------------------------------------------------------

export interface StrategyDetail {
  id: number
  name: string
  description: string
  rules: string[]
  stats: ReturnType<typeof strategyStats>
  quantMetrics: ReturnType<typeof strategyQuantMetrics>
  ruleAdherence: RuleAdherenceStats
  equityCurve: { date: string; cumulativePnl: number }[]
  drawdown: { series: { date: string; drawdown: number }[]; maxDrawdown: number }
  dayOfWeek: ReturnType<typeof dayOfWeekBreakdownOf>
  trades: { id: number; date: string; name: string; pair: string | null; pnl: number; followed_plan: boolean }[]
}

export function getStrategyDetail(strategyId: number): StrategyDetail | null {
  const db = getDb()
  const strategy = db.prepare('SELECT id, name, description, rules FROM strategies WHERE id = ?').get(strategyId) as
    | { id: number; name: string; description: string | null; rules: string | null }
    | undefined
  if (!strategy) return null

  const rules = parseJsonArray(strategy.rules)

  const trades = db
    .prepare(
      'SELECT id, date, pnl, followed_plan, session, r_multiple, name, pair, followed_rules FROM trades WHERE strategy_id = ? ORDER BY date ASC'
    )
    .all(strategyId) as unknown as StrategyTradeRow[]

  const equityCurve = equityCurveOf(trades)
  const { series: drawdownSeries, maxDrawdown } = drawdownOf(equityCurve)
  const drawdownRounded = { series: drawdownSeries, maxDrawdown: round2(maxDrawdown) }

  return {
    id: strategy.id,
    name: strategy.name,
    description: strategy.description ?? '',
    rules,
    stats: strategyStats(trades),
    quantMetrics: strategyQuantMetrics(trades, equityCurve, drawdownRounded),
    ruleAdherence: ruleAdherenceStats(trades, rules),
    equityCurve,
    drawdown: drawdownRounded,
    dayOfWeek: dayOfWeekBreakdownOf(trades),
    trades: trades
      .slice(-50)
      .reverse()
      .map((t) => ({ id: t.id, date: t.date, name: t.name, pair: t.pair, pnl: t.pnl, followed_plan: !!t.followed_plan })),
  }
}

// --- per-strategy prop-firm simulation history --------------------------------------------------
// Persists the inputs/outputs of a strategy-scoped simulateFundedChallenge() run so pass
// probability can be tracked over time as more trades are logged for that strategy.

export interface StrategyPropSimHistoryEntry {
  id: number
  strategyId: number
  presetLabel: string | null
  profitTargetPct: number
  maxDailyLossPct: number
  maxOverallDrawdownPct: number
  drawdownMode: DrawdownMode
  riskPerTradePct: number
  tradingDaysRemaining: number
  passRate: number
  dailyLossBreachRate: number
  maxDrawdownBreachRate: number
  consistencyBreachRate: number
  ranOutOfDaysRate: number
  credibilityWeight: number
  createdAt: string
}

interface StrategyPropSimRow {
  id: number
  strategy_id: number
  preset_label: string | null
  profit_target_pct: number
  max_daily_loss_pct: number
  max_overall_drawdown_pct: number
  drawdown_mode: string
  risk_per_trade_pct: number
  trading_days_remaining: number
  pass_rate: number
  daily_loss_breach_rate: number
  max_drawdown_breach_rate: number
  consistency_breach_rate: number
  ran_out_of_days_rate: number
  credibility_weight: number
  created_at: string
}

function mapStrategyPropSimRow(row: StrategyPropSimRow): StrategyPropSimHistoryEntry {
  return {
    id: row.id,
    strategyId: row.strategy_id,
    presetLabel: row.preset_label,
    profitTargetPct: row.profit_target_pct,
    maxDailyLossPct: row.max_daily_loss_pct,
    maxOverallDrawdownPct: row.max_overall_drawdown_pct,
    drawdownMode: row.drawdown_mode as DrawdownMode,
    riskPerTradePct: row.risk_per_trade_pct,
    tradingDaysRemaining: row.trading_days_remaining,
    passRate: row.pass_rate,
    dailyLossBreachRate: row.daily_loss_breach_rate,
    maxDrawdownBreachRate: row.max_drawdown_breach_rate,
    consistencyBreachRate: row.consistency_breach_rate,
    ranOutOfDaysRate: row.ran_out_of_days_rate,
    credibilityWeight: row.credibility_weight,
    createdAt: row.created_at,
  }
}

export function saveStrategyPropSimResult(
  strategyId: number,
  presetLabel: string | null,
  params: FundedChallengeParams,
  result: FundedChallengeResult
): StrategyPropSimHistoryEntry {
  const db = getDb()
  const drawdownMode: DrawdownMode = params.drawdownMode ?? 'trailing-intraday'
  const info = db
    .prepare(
      `INSERT INTO strategy_prop_sim_results (
        strategy_id, preset_label, profit_target_pct, max_daily_loss_pct, max_overall_drawdown_pct,
        drawdown_mode, risk_per_trade_pct, trading_days_remaining,
        pass_rate, daily_loss_breach_rate, max_drawdown_breach_rate, consistency_breach_rate,
        ran_out_of_days_rate, credibility_weight
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      strategyId,
      presetLabel,
      params.profitTargetPct,
      params.maxDailyLossPct,
      params.maxOverallDrawdownPct,
      drawdownMode,
      params.riskPerTradePct,
      params.tradingDaysRemaining,
      result.passRate,
      result.dailyLossBreachRate,
      result.maxDrawdownBreachRate,
      result.consistencyBreachRate,
      result.ranOutOfDaysRate,
      result.credibilityWeight
    )
  const row = db
    .prepare('SELECT * FROM strategy_prop_sim_results WHERE id = ?')
    .get(info.lastInsertRowid) as unknown as StrategyPropSimRow
  return mapStrategyPropSimRow(row)
}

export function getStrategyPropSimHistory(strategyId: number): StrategyPropSimHistoryEntry[] {
  const db = getDb()
  const rows = db
    .prepare('SELECT * FROM strategy_prop_sim_results WHERE strategy_id = ? ORDER BY created_at DESC LIMIT 20')
    .all(strategyId) as unknown as StrategyPropSimRow[]
  return rows.map(mapStrategyPropSimRow)
}
