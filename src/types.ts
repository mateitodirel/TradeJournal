export interface Account {
  id: number
  name: string
  broker: string
  starting_balance: number
  currency: string
}

export interface Strategy {
  id: number
  name: string
  description: string
  rules: string[]
}

export interface Confluence {
  id: number
  name: string
}

export interface Trade {
  id: number
  name: string
  date: string
  pair: string | null
  session: string | null
  direction: string | null
  risk_per_trade: number | null
  pnl: number
  r_multiple: number | null
  mfe_r: number | null
  mae_r: number | null
  followed_plan: boolean
  break_even: boolean
  entry_win: boolean
  strategy_id: number | null
  account_id: number | null
  positive_tags: string[]
  negative_tags: string[]
  followed_rules: string[]
  notes: string | null
  created_at: string
  confluence_ids: number[]
}

export interface MissedTrade {
  id: number
  date: string
  pair: string | null
  direction: string | null
  would_be_pnl: number | null
  reason_missed: string | null
  strategy_id: number | null
  tags: string[]
  notes: string | null
  confluence_ids: number[]
}

export interface DailyReview {
  date: string
  notes: string
  emotion: string
  lessons_learned: string
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

export interface StrategyDetail {
  id: number
  name: string
  description: string
  rules: string[]
  stats: {
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
  // quantstats-style metrics pack — $-denominated (this app has no reliable per-strategy
  // starting balance), Sharpe/Sortino/Calmar are annualized ratios of day-aggregated PnL.
  quantMetrics: {
    sharpe: number
    sortino: number
    calmar: number
    recoveryFactor: number
    ulcerIndex: number
    gainToPainRatio: number
    maxWinStreak: number
    maxLossStreak: number
    outlierWinRatio: number
    outlierLossRatio: number
    sqn: number | null
    sqnRating: string | null
    rMultipleHistogram: { bucket: string; count: number }[]
    skewness: number | null
    kurtosis: number | null
  }
  ruleAdherence: RuleAdherenceStats
  equityCurve: { date: string; cumulativePnl: number }[]
  drawdown: { series: { date: string; drawdown: number }[]; maxDrawdown: number }
  dayOfWeek: { day: string; trades: number; pnl: number; winRate: number }[]
  trades: {
    id: number
    date: string
    name: string
    pair: string | null
    pnl: number
    followed_plan: boolean
    r_multiple: number | null
    mfe_r: number | null
    mae_r: number | null
  }[]
}

export interface AnalyticsSummary {
  kpis: { winRate: number; totalPnl: number; returnsPct: number; profitFactor: number }
  radar: { metric: string; value: number }[]
  equityCurve: { date: string; cumulativePnl: number }[]
  drawdown: { series: { date: string; drawdown: number }[]; maxDrawdown: number }
  dailyBars: { day: string; pnl: number }[]
  dayOfWeek: { day: string; trades: number; pnl: number; winRate: number }[]
  calendar: Record<string, { pnl: number; count: number }>
  monthlyStats: {
    winRate: number
    riskReward: number
    profitFactor: number
    bestDayPnl: number
    worstDayPnl: number
    avgDailyPnl: number
    tradeCount: number
  }
  insights: string[]
  overall: { winRate: number; profitFactor: number; avgWin: number; avgLoss: number; totalTrades: number }
}

export interface MonthlyBreakdownEntry {
  month: string
  label: string
  pnl: number
  tradeCount: number
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

export const SESSIONS = ['Asia', 'London', 'New York', 'London/NY Overlap'] as const
export const DIRECTIONS = ['Long', 'Short'] as const
