/* React is only needed for JSX transform; no explicit import is required in modern tooling */
import { useState, useEffect } from 'react'
import { getLearningSettings, setNativeLang, setLearningMode, setPreferWhisper, type NativeLanguage, type LearningMode } from '../services/settings'

export function SettingsScreen({ onBack, onSignOut }: { onBack?: () => void; onSignOut?: () => void } = {}) {
  const [quizSize, setQuizSize] = useState(10)
  const [nativeLang, setNativeLangState] = useState<NativeLanguage>('en')
  const [learningMode, setLearningModeState] = useState<LearningMode>('mixed')
  const [preferWhisper, setPreferWhisperState] = useState(false)
  
  useEffect(() => {
    const saved = localStorage.getItem('settings.quizSize')
    if (saved) setQuizSize(parseInt(saved, 10))
    
    const settings = getLearningSettings()
    setNativeLangState(settings.nativeLang)
    setLearningModeState(settings.learningMode)
    setPreferWhisperState(settings.preferWhisper)
  }, [])
  
  const handleQuizSizeChange = (size: number) => {
    setQuizSize(size)
    localStorage.setItem('settings.quizSize', String(size))
  }
  
  const handleNativeLangChange = (lang: NativeLanguage) => {
    setNativeLangState(lang)
    setNativeLang(lang)
  }
  
  const handleLearningModeChange = (mode: LearningMode) => {
    setLearningModeState(mode)
    setLearningMode(mode)
  }
  
  const handlePreferWhisperChange = (prefer: boolean) => {
    setPreferWhisperState(prefer)
    setPreferWhisper(prefer)
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
          <NotificationSettingsRow onSignOut={onSignOut} />
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
                  className={`px-sm py-xs rounded-full text-sm font-semibold transition-fast ${quizSize === size ? 'bg-accent text-white' : 'bg-surface text-secondary hover:bg-border'}`}
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
              value={nativeLang}
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
              value={learningMode}
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
              value={preferWhisper ? 'whisper' : 'captions'}
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
      <div className="card mb-xl p-0 overflow-hidden opacity-50">
        <div className="px-md py-sm bg-surface font-semibold text-sm text-secondary border-b border-border">Data</div>
        <div className="flex-col divide-y divide-border">
          <div className="flex-between p-md">
            <span className="font-medium">Export Cards</span>
            <span className="text-tertiary text-sm">Coming soon</span>
          </div>
          <div className="flex-between p-md">
            <span className="font-medium">Import Cards</span>
            <span className="text-tertiary text-sm">Coming soon</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function NotificationSettingsRow({ onSignOut }: { onSignOut?: () => void }) {
  const [enabled, setEnabled] = useState(true)
  const [time, setTime] = useState('19:00')
  
  useEffect(() => {
    const e = localStorage.getItem('dailyQuiz.enabled')
    const t = localStorage.getItem('dailyQuiz.time') || '19:00'
    setEnabled(e !== 'false')
    setTime(t)
  }, [])
  
  useEffect(() => {
    localStorage.setItem('dailyQuiz.enabled', String(enabled))
    localStorage.setItem('dailyQuiz.time', time)
  }, [enabled, time])
  
  return (
    <>
      <div className="flex-between p-md bg-white">
        <span className="font-medium">Daily Reminder</span>
        <button 
          onClick={() => setEnabled(!enabled)}
          className={`relative w-12 h-6 rounded-full transition-fast cursor-pointer border-none ${enabled ? 'bg-accent' : 'bg-border'}`}
        >
          <span 
            className="absolute top-[2px] w-[20px] h-[20px] rounded-full bg-white transition-fast shadow-sm"
            style={{ left: enabled ? '26px' : '2px' }}
          />
        </button>
      </div>
      {enabled && (
        <div className="flex-between p-md bg-white border-t border-border animate-slide-down">
          <span className="font-medium text-secondary">Reminder Time</span>
          <input 
            type="time" 
            value={time} 
            onChange={(e) => setTime(e.target.value)}
            className="bg-transparent border-none text-secondary font-medium cursor-pointer outline-none text-right"
          />
        </div>
      )}

      {/* Sign Out */}
      <div className="mt-xl">
        <button 
          onClick={() => {
            if (onSignOut) {
              onSignOut();
            } else {
              localStorage.removeItem('auth.token');
              localStorage.removeItem('auth.user');
              window.location.reload();
            }
          }}
          className="btn btn-secondary btn-full text-danger"
          style={{ borderColor: 'var(--danger-hover)', color: 'var(--danger)' }}
        >
          Sign Out
        </button>
      </div>
    </>
  )
}
