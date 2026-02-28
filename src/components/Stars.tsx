/* React import kept for JSX runtime compatibility */

export function Stars({ count }: { count: number }) {
  const n = Math.max(0, Math.min(5, count))
  const full = '★'.repeat(n)
  const empty = '☆'.repeat(5 - n)
  return (
    <span aria-label={`${n} stars`} style={{ fontSize: '1.25rem', color: 'var(--accent)' }}>
      {full}{empty}
    </span>
  )
}
