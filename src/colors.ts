export const COLORS = {
  green: '#34d399',
  red: '#f87171',
  accent: '#3ecf8e',
  border: '#262b2f',
  textMuted: '#8b9299',
  textDim: '#5b6167',
  card: '#15181b',
}

// Distinct line colors for overlaying up to 4 strategies on the same chart
// (strategy comparison view). Kept separate from COLORS.green/red so a
// strategy's line color never gets mistaken for a generic positive/negative
// P&L cue.
export const COMPARISON_LINE_COLORS = ['#3ecf8e', '#60a5fa', '#fbbf24', '#c084fc']
