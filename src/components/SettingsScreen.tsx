import { useState, useEffect, useRef } from 'react'
import {
  initSettings,
  getLearningSettings,
  setNativeLang,
  setLearningMode,
  setPreferWhisper,
  setQuizSize,
  setDailyReminder,
  setCustomBackground,
  setGlassEnabled,
  type NativeLanguage,
  type LearningMode,
  type LearningSettings,
} from '../services/settings'
import { getAllCards, createCard } from '../services/cards'

const PRESET_BACKGROUNDS = [
  { id: 'preset-1', name: 'Purple Dream', class: 'bg-preset-1' },
  { id: 'preset-2', name: 'Sunset', class: 'bg-preset-2' },
  { id: 'preset-3', name: 'Ocean', class: 'bg-preset-3' },
  { id: 'preset-4', name: 'Forest', class: 'bg-preset-4' },
  { id: 'preset-5', name: 'Sunrise', class: 'bg-preset-5' },
  { id: 'preset-6', name: 'Peach', class: 'bg-preset-6' },
]

export function SettingsScreen({ onBack, onSignOut, settings: initialSettings }: { onBack?: () => void; onSignOut?: () => void; settings?: LearningSettings | null } = {}) {
  const [settings, setSettings] = useState<LearningSettings | null>(initialSettings ?? getLearningSettings())

  useEffect(() => {
    if (initialSettings) {
      setSettings(initialSettings)
    } else {
      initSettings().then(setSettings)
    }
  }, [initialSettings])

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

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleBackgroundSelect = async (background: string | null) => {
    await setCustomBackground(background)
    setSettings(s => s ? { ...s, customBackground: background } : s)
  }

  const handleGlassToggle = async () => {
    const next = !settings.glassEnabled
    await setGlassEnabled(next)
    setSettings(s => s ? { ...s, glassEnabled: next } : s)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Convert to base64
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = reader.result as string
      await setCustomBackground(base64)
      setSettings(s => s ? { ...s, customBackground: base64 } : s)
    }
    reader.readAsDataURL(file)
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

      {/* Background Section */}
      <div className="card mb-xl p-0 overflow-hidden">
        <div className="px-md py-sm bg-surface font-semibold text-sm text-secondary border-b border-border">Custom Background</div>
        <div className="p-md flex-col gap-md">
          {/* Preview */}
          <div 
            className={`rounded-xl p-lg flex-center ${settings.customBackground ? (settings.glassEnabled ? 'glass' : 'bg-surface') : 'bg-surface'}`}
            style={{ 
              minHeight: '100px',
              background: settings.customBackground 
                ? (settings.customBackground.startsWith('bg-') 
                  ? undefined 
                  : `url(${settings.customBackground}) center/cover`)
                : undefined,
              border: settings.customBackground ? '2px solid var(--accent)' : '2px dashed var(--border)'
            }}
          >
            {settings.customBackground ? (
              <span className="font-semibold" style={{ color: settings.glassEnabled ? 'var(--text)' : 'var(--text)' }}>
                Background Active
              </span>
            ) : (
              <span className="text-secondary">No background selected</span>
            )}
          </div>

          {/* Glass Toggle */}
          <div className="flex-between items-center">
            <div>
              <span className="font-medium">Glass Effect</span>
              <p className="text-xs text-secondary mt-xs">Frosted glass on cards</p>
            </div>
            <button
              onClick={handleGlassToggle}
              className={`w-12 h-6 rounded-full transition-fast ${settings.glassEnabled ? 'bg-accent' : 'bg-border'}`}
              style={{ position: 'relative' }}
            >
              <div 
                className="absolute top-1 w-4 h-4 bg-white rounded-full transition-fast"
                style={{ 
                  left: settings.glassEnabled ? '26px' : '4px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}
              />
            </button>
          </div>

          {/* Preset Backgrounds */}
          <div>
            <span className="font-medium block mb-sm">Presets</span>
            <div className="flex gap-sm flex-wrap">
              {PRESET_BACKGROUNDS.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => handleBackgroundSelect(preset.class)}
                  className={`w-14 h-10 rounded-lg transition-fast border-2 ${settings.customBackground === preset.class ? 'border-accent scale-110' : 'border-transparent hover:scale-105'}`}
                  style={{ background: 'none' }}
                  title={preset.name}
                >
                  <div className={`w-full h-full rounded-md ${preset.class}`} />
                </button>
              ))}
            </div>
          </div>

          {/* Upload Custom Image */}
          <div>
            <span className="font-medium block mb-sm">Custom</span>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-secondary btn-full"
            >
              Choose from Device
            </button>
            {settings.customBackground && !settings.customBackground.startsWith('bg-') && (
              <button
                onClick={() => handleBackgroundSelect(null)}
                className="btn btn-subtle btn-full mt-sm"
              >
                Remove
              </button>
            )}
          </div>

          {/* None / Default */}
          <button
            onClick={() => handleBackgroundSelect(null)}
            className={`btn w-full ${!settings.customBackground ? 'bg-accent text-white' : 'bg-surface text-secondary'}`}
          >
            No Background
          </button>
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
