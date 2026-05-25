import { useState, useEffect, useRef } from 'react'
import { setAvatar, getLearningSettings, type LearningSettings } from '../services/settings'
import { getStoredUser, updateUserName } from '../services/auth'

export function ProfileScreen({ onBack }: { onBack?: () => void } = {}) {
  const [settings, setSettings] = useState<LearningSettings | null>(null)
  const [userName, setUserName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setSettings(getLearningSettings())
    const user = getStoredUser()
    setUserName(user?.name || 'User')
    setNameInput(user?.name || 'User')
  }, [])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = reader.result as string
      await setAvatar(base64)
      setSettings(s => s ? { ...s, avatar: base64 } : s)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveAvatar = async () => {
    await setAvatar(null)
    setSettings(s => s ? { ...s, avatar: null } : s)
  }

  const handleSaveName = async () => {
    if (nameInput.trim()) {
      await updateUserName(nameInput.trim())
      setUserName(nameInput.trim())
      setEditingName(false)
    }
  }

  if (!settings) {
    return <div className="screen flex-center" style={{ minHeight: '60vh' }}><p className="text-secondary">Loading...</p></div>
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
        <h1 className="text-2xl font-bold">Profile</h1>
      </div>

      {/* Avatar Section */}
      <div className="card mb-xl p-lg flex-center flex-col">
        {settings.avatar ? (
          <img 
            src={settings.avatar} 
            alt="Avatar" 
            className="rounded-full mb-md"
            style={{ width: 100, height: 100, objectFit: 'cover', border: '4px solid var(--accent)' }}
          />
        ) : (
          <div 
            className="rounded-full mb-md flex-center"
            style={{ width: 100, height: 100, background: 'var(--accent-light)', border: '4px solid var(--accent)' }}
          >
            <span className="text-3xl font-bold text-accent">{userName?.charAt(0).toUpperCase() || 'U'}</span>
          </div>
        )}
        <input
          type="file"
          ref={avatarInputRef}
          accept="image/*"
          onChange={handleAvatarUpload}
          className="hidden"
        />
        <div className="flex gap-sm">
          <button
            onClick={() => avatarInputRef.current?.click()}
            className="btn btn-secondary"
          >
            Change Photo
          </button>
          {settings.avatar && (
            <button
              onClick={handleRemoveAvatar}
              className="btn btn-subtle"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Name Section */}
      <div className="card mb-xl p-0 overflow-hidden">
        <div className="px-md py-sm bg-surface font-semibold text-sm text-secondary border-b border-border">Display Name</div>
        <div className="p-md">
          {editingName ? (
            <div className="flex gap-sm">
              <input
                ref={nameInputRef}
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="input flex-1"
                placeholder="Your name"
                autoFocus
              />
              <button onClick={handleSaveName} className="btn btn-primary">
                Save
              </button>
              <button onClick={() => { setEditingName(false); setNameInput(userName) }} className="btn btn-subtle">
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex-between">
              <span className="font-medium">{userName}</span>
              <button onClick={() => setEditingName(true)} className="btn btn-subtle">
                Edit
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}