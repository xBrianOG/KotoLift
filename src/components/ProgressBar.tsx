/* React import retained for JSX runtime compatibility */

export function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0
  return (
    <div style={{ width: '100%', height: 8, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }} aria-label="progress">
      <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)' }} />
    </div>
  )
}
