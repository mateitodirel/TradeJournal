import type { DrawdownMode } from './types'

// Representative, publicly-known "rule of thumb" numbers for each firm's most common
// challenge tier. These are approximations for planning purposes only, not scraped from
// live firm rulebooks — always verify against the firm's current published rules before
// relying on them for a real challenge attempt.
export interface PropFirmPreset {
  id: string
  label: string
  profitTargetPct: number
  maxDailyLossPct: number
  maxOverallDrawdownPct: number
  drawdownMode: DrawdownMode
  maxDayProfitPct: number | null // null = firm doesn't enforce a consistency rule
}

export const PROP_FIRM_PRESETS: PropFirmPreset[] = [
  {
    id: 'ftmo-100k',
    label: 'FTMO — $100k Challenge (Step 1)',
    profitTargetPct: 10,
    maxDailyLossPct: 5,
    maxOverallDrawdownPct: 10,
    drawdownMode: 'static',
    maxDayProfitPct: null,
  },
  {
    id: 'topstep-50k',
    label: 'Topstep — $50k Trading Combine',
    profitTargetPct: 6,
    maxDailyLossPct: 2,
    maxOverallDrawdownPct: 4,
    drawdownMode: 'trailing-eod',
    maxDayProfitPct: null,
  },
  {
    id: 'apex-100k',
    label: 'Apex Trader Funding — $100k Evaluation',
    profitTargetPct: 6,
    maxDailyLossPct: 5,
    maxOverallDrawdownPct: 3,
    drawdownMode: 'trailing-intraday',
    maxDayProfitPct: 30,
  },
  {
    id: 'mff-100k',
    label: 'MyFundedFutures — $100k Starter',
    profitTargetPct: 6,
    maxDailyLossPct: 4,
    maxOverallDrawdownPct: 4,
    drawdownMode: 'trailing-eod',
    maxDayProfitPct: 40,
  },
  {
    id: 'the5ers-100k',
    label: 'The5ers — $100k High Stakes',
    profitTargetPct: 8,
    maxDailyLossPct: 5,
    maxOverallDrawdownPct: 6,
    drawdownMode: 'static',
    maxDayProfitPct: null,
  },
  {
    id: 'e8-100k',
    label: 'E8 Markets — $100k Evaluation',
    profitTargetPct: 8,
    maxDailyLossPct: 5,
    maxOverallDrawdownPct: 8,
    drawdownMode: 'static',
    maxDayProfitPct: 30,
  },
]
