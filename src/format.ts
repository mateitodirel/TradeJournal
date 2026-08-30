export function formatRatio(n: number): string {
  return n >= 999 ? '∞' : n.toFixed(2)
}
