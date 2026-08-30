import { useState } from 'react'

export function TagInput({
  tags,
  onChange,
  variant,
  placeholder,
}: {
  tags: string[]
  onChange: (tags: string[]) => void
  variant: 'positive' | 'negative'
  placeholder?: string
}) {
  const [draft, setDraft] = useState('')

  const addTag = () => {
    const t = draft.trim()
    if (t && !tags.includes(t)) onChange([...tags, t])
    setDraft('')
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
        {tags.map((t) => (
          <span key={t} className={`tag-pill ${variant}`}>
            {t}
            <span
              style={{ cursor: 'pointer', opacity: 0.7 }}
              onClick={() => onChange(tags.filter((x) => x !== t))}
            >
              ✕
            </span>
          </span>
        ))}
      </div>
      <input
        className="input"
        placeholder={placeholder ?? 'Type a tag and press Enter'}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            addTag()
          }
        }}
      />
    </div>
  )
}
