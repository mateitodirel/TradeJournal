import type { Account, Strategy } from '../types'

export function FilterBar({
  accounts,
  strategies,
  accountId,
  strategyId,
  onAccountChange,
  onStrategyChange,
}: {
  accounts: Account[]
  strategies: Strategy[]
  accountId: number | null
  strategyId: number | null
  onAccountChange: (id: number | null) => void
  onStrategyChange: (id: number | null) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <select
        className="select"
        value={accountId ?? ''}
        onChange={(e) => onAccountChange(e.target.value ? Number(e.target.value) : null)}
        style={{ width: 160 }}
      >
        <option value="">All Accounts</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>
      <select
        className="select"
        value={strategyId ?? ''}
        onChange={(e) => onStrategyChange(e.target.value ? Number(e.target.value) : null)}
        style={{ width: 160 }}
      >
        <option value="">All Strategies</option>
        {strategies.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
    </div>
  )
}
