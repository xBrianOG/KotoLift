import { useEffect, useState } from 'react'
import { initNotifications, scheduleDailyNotification, cancelDailyNotification } from '../services/notifications'

export function NotificationSettings({ hideHeader = false }: { hideHeader?: boolean } = {}) {
  const [enabled, setEnabled] = useState<boolean>(true)
  const [time, setTime] = useState<string>('19:00')

  useEffect(() => {
    const e = localStorage.getItem('dailyQuiz.enabled')
    const t = localStorage.getItem('dailyQuiz.time') || '19:00'
    setEnabled(e !== 'false')
    setTime(t)
  }, [])

  useEffect(() => {
    localStorage.setItem('dailyQuiz.enabled', String(enabled))
    localStorage.setItem('dailyQuiz.time', time)
    if (enabled) {
      const [h, m] = time.split(':').map(n => parseInt(n, 10))
      scheduleDailyNotification(isNaN(h) ? 19 : h, isNaN(m) ? 0 : m)
    } else {
      cancelDailyNotification()
    }
  }, [enabled, time])

  // Initialize on first load
  useEffect(() => {
    initNotifications()
  }, [])

  return (
    <div className="card" style={{ marginTop: 16 }} aria-label="daily-reminder">
      {!hideHeader && <h3>Daily Reminder</h3>}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Enable daily reminder
      </label>
      <div>
        <label style={{ display: 'block', marginBottom: 6 }}>Time</label>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </div>
    </div>
  )
}
