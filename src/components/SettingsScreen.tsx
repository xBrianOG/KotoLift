import { useState, useEffect } from 'react'
import {
  initSettings,
  setNativeLang,
  setLearningMode,
  setPreferWhisper,
  setQuizSize,
  setDailyReminder,
  type NativeLanguage,
  type LearningMode,
  type LearningSettings,
} from '../services/settings'
import { getAllCards, createCard } from '../services/cards'

export function SettingsScreen({ onBack, onSignOut }: { onBack?: () => void; onSignOut?: () => void } = {}) {
  const [settings, setSettings] = useState<LearningSettings | null>(null)

  useEffect(() => {
    initSettings().then(setSettings)
  }, [])

  if (!settings) {
    return <div className="screen flex-center" style={{ minHeight: '60vh' }}><p className="text-secondary">Loading settings…</p></div>
  }

  const handleQuizSizeChange = async (size: number) => {
    await setQuizSize(size)
    setSettings(s => s ? { ...s, quizSize: size } : s)
  }

  const handleNativeLangChange = async (lang: NativeLanguage) => {
    await setNativeLang(lang)
    setSettings(s => s ? { ...s, nativeLang: lang } : s)
  }

  const handleLearningModeChange = async (mode: LearningMode) => {
    await setLearningMode(mode)
    setSettings(s => s ? { ...s, learningMode: mode } : s)
  }

  const handlePreferWhisperChange = async (prefer: boolean) => {
    await setPreferWhisper(prefer)
    setSettings(s => s ? { ...s, preferWhisper: prefer } : s)
  }

  const handleReminderToggle = async () => {
    const next = !settings.dailyReminderEnabled
    await setDailyReminder(next, settings.dailyReminderTime)
    setSettings(s => s ? { ...s, dailyReminderEnabled: next } : s)
  }

  const handleReminderTimeChange = async (time: string) => {
    await setDailyReminder(settings.dailyReminderEnabled, time)
    setSettings(s => s ? { ...s, dailyReminderTime: time } : s)
  }

  return (
    <div className="screen animate-fade-in" style={{ paddingBottom: '120px' }}>
      {/* Header */}
      <div className="flex-center mb-xl" style={{ justifyContent: 'flex-start' }}>
        {onBack && (
          <button
            onClick={onBack}
            className="btn-subtle"
            style={{
              padding: 'var(--space-sm) var(--space-md)',
              marginRight: 'var(--space-sm)',
              borderRadius: 'var(--radius-round)'
            }}
          >
            ← Back
          </button>
        )}
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      {/* Reminders Section */}
      <div className="card mb-xl p-0 overflow-hidden">
        <div className="px-md py-sm bg-surface font-semibold text-sm text-secondary border-b border-border">Reminders</div>
        <div className="flex-col divide-y divide-border">
          <div className="flex-between p-md">
            <span className="font-medium">Daily Reminder</span>
            <button
              onClick={handleReminderToggle}
              className={`relative w-12 h-6 rounded-full transition-fast cursor-pointer border-none ${settings.dailyReminderEnabled ? 'bg-accent' : 'bg-border'}`}
            >
              <span
                className="absolute top-[2px] w-[20px] h-[20px] rounded-full bg-white transition-fast shadow-sm"
                style={{ left: settings.dailyReminderEnabled ? '26px' : '2px' }}
              />
            </button>
          </div>
          {settings.dailyReminderEnabled && (
            <div className="flex-between p-md animate-slide-down">
              <span className="font-medium text-secondary">Reminder Time</span>
              <input
                type="time"
                value={settings.dailyReminderTime}
                onChange={(e) => handleReminderTimeChange(e.target.value)}
                className="bg-transparent border-none text-secondary font-medium cursor-pointer outline-none text-right"
              />
            </div>
          )}
        </div>
      </div>

      {/* Quiz Section */}
      <div className="card mb-xl p-0 overflow-hidden">
        <div className="px-md py-sm bg-surface font-semibold text-sm text-secondary border-b border-border">Quiz</div>
        <div className="flex-col divide-y divide-border">
          <div className="flex-between p-md">
            <span className="font-medium">Questions per session</span>
            <div className="flex-center gap-xs">
              {[5, 10, 15].map(size => (
                <button
                  key={size}
                  onClick={() => handleQuizSizeChange(size)}
                  className={`px-sm py-xs rounded-full text-sm font-semibold transition-fast ${settings.quizSize === size ? 'bg-accent text-white' : 'bg-surface text-secondary hover:bg-border'}`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Learning Section */}
      <div className="card mb-xl p-0 overflow-hidden">
        <div className="px-md py-sm bg-surface font-semibold text-sm text-secondary border-b border-border">Learning</div>
        <div className="flex-col divide-y divide-border">
          <div className="flex-between p-md">
            <span className="font-medium">My Language</span>
            <select
              value={settings.nativeLang}
              onChange={(e) => handleNativeLangChange(e.target.value as NativeLanguage)}
              className="bg-transparent border-none text-secondary text-right font-medium cursor-pointer outline-none"
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="ja">Japanese</option>
            </select>
          </div>
          <div className="flex-between p-md">
            <span className="font-medium">Learning Mode</span>
            <select
              value={settings.learningMode}
              onChange={(e) => handleLearningModeChange(e.target.value as LearningMode)}
              className="bg-transparent border-none text-secondary text-right font-medium cursor-pointer outline-none"
            >
              <option value="passive">Source → Native</option>
              <option value="active">Native → Source</option>
              <option value="mixed">Mixed</option>
            </select>
          </div>
          <div className="flex-between p-md">
            <span className="font-medium">Video Transcription</span>
            <select
              value={settings.preferWhisper ? 'whisper' : 'captions'}
              onChange={(e) => handlePreferWhisperChange(e.target.value === 'whisper')}
              className="bg-transparent border-none text-secondary text-right font-medium cursor-pointer outline-none"
            >
              <option value="captions">Prefer YouTube Captions</option>
              <option value="whisper">Always use Whisper</option>
            </select>
          </div>
        </div>
      </div>

      {/* Data Section */}
      <DataSection />

      {/* Sign Out */}
      <div className="mt-xl">
        <button
          onClick={() => onSignOut ? onSignOut() : (() => { localStorage.removeItem('auth.token'); localStorage.removeItem('auth.user'); window.location.reload() })()}
          className="btn btn-secondary btn-full"
          style={{ borderColor: 'var(--danger-hover)', color: 'var(--danger)' }}
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}

function DataSection() {
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)

  const handleExport = async () => {
    setExporting(true)
    try {
      const cards = await getAllCards()
      const json = JSON.stringify(cards, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `kotolift-cards-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportMsg(null)
    try {
      const text = await file.text()
      const cards = JSON.parse(text)
      if (!Array.isArray(cards)) throw new Error('Invalid format')
      const { ensureReviewStates } = await import('../services/review')
      let added = 0
      for (const card of cards) {
        try {
          const savedCard = await createCard(
            card.sourceText || card.jaText || '',
            card.translations?.en || card.enText || '',
            card.translations?.es || card.esText || '',
            card.tags || [],
            card.notes,
            card.sourceLang,
            card.sourceUrl,
            card.startMs,
            card.endMs,
            card.translations?.ja || card.jaText
          )
          await ensureReviewStates(savedCard)
          added++
        } catch (err) {
          console.error('Failed to import card:', err)
        }
      }
      setImportMsg(`✓ Imported ${added} new cards`)
    } catch (err) {
      setImportMsg(`✗ ${err instanceof Error ? err.message : 'Import failed'}`)
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  return (
    <div className="card mb-xl p-0 overflow-hidden">
      <div className="px-md py-sm bg-surface font-semibold text-sm text-secondary border-b border-border">Data</div>
      <div className="flex-col divide-y divide-border">
        <div className="flex-between p-md">
          <span className="font-medium">Export Cards</span>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="text-sm font-semibold text-accent cursor-pointer bg-transparent border-none"
          >
            {exporting ? 'Exporting…' : 'Export JSON'}
          </button>
        </div>
        <div className="flex-col p-md gap-xs">
          <div className="flex-between">
            <span className="font-medium">Import Cards</span>
            <label className="text-sm font-semibold text-accent cursor-pointer" style={{ opacity: importing ? 0.5 : 1 }}>
              {importing ? 'Importing…' : 'Choose File'}
              <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} disabled={importing} />
            </label>
          </div>
          {importMsg && <p className="text-sm text-secondary">{importMsg}</p>}
        </div>
      </div>
    </div>
  )
}
