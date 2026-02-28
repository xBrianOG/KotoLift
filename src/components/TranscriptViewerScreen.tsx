import { useState, useMemo } from 'react';
import { createCard } from '../services/cards';

export interface TranscriptSegment {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
}

export interface TranscriptData {
  url: string;
  title: string;
  segments: TranscriptSegment[];
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function buildYouTubeTimestampUrl(url: string, startMs: number): string {
  const seconds = Math.floor(startMs / 1000);
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}t=${seconds}s`;
}

function extractVideoId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

interface TranscriptViewerScreenProps {
  data: TranscriptData;
  onBack: () => void;
}

export function TranscriptViewerScreen({ data, onBack }: TranscriptViewerScreenProps) {
  const [search, setSearch] = useState('');
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [savingAll, setSavingAll] = useState(false);

  const filteredSegments = useMemo(() => {
    if (!search.trim()) return data.segments;
    const q = search.toLowerCase();
    return data.segments.filter(s => s.text.toLowerCase().includes(q));
  }, [data.segments, search]);

  const handleSave = async (seg: TranscriptSegment) => {
    if (savingIds.has(seg.id)) return;
    
    setSavingIds(prev => new Set(prev).add(seg.id));
    
    try {
      await createCard(seg.text, '', '', ['imported'], `Video: ${data.title}`);
      setSavedIds(prev => new Set(prev).add(seg.id));
    } catch (err) {
      console.error('Failed to save card:', err);
    } finally {
      setSavingIds(prev => {
        const next = new Set(prev);
        next.delete(seg.id);
        return next;
      });
    }
  };

  const handleSaveSelected = async () => {
    setSavingAll(true);
    try {
      for (const id of selectedIds) {
        if (savedIds.has(id)) continue;
        const seg = data.segments.find(s => s.id === id);
        if (seg) {
          await createCard(seg.text, '', '', ['imported'], `Video: ${data.title}`);
          setSavedIds(prev => new Set(prev).add(id));
        }
      }
      setSelectMode(false);
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Failed to save cards:', err);
    } finally {
      setSavingAll(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredSegments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSegments.map(s => s.id)));
    }
  };

  const videoId = extractVideoId(data.url);

  return (
    <div className="screen" style={{ 
      padding: 'var(--space-xl)',
      paddingTop: 'calc(env(safe-area-inset-top) + var(--space-xl))',
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
        <button 
          onClick={onBack}
          style={{ 
            padding: 'var(--space-sm) var(--space-md)', 
            border: 'none', 
            background: 'transparent',
            color: 'var(--accent)',
            fontWeight: 600,
            fontSize: 'var(--font-base)'
          }}
        >
          ← Back
        </button>
        <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {data.title}
        </h2>
        <button
          onClick={() => setSelectMode(!selectMode)}
          style={{
            padding: 'var(--space-xs) var(--space-sm)',
            border: 'none',
            background: 'transparent',
            color: 'var(--accent)',
            fontSize: 'var(--font-sm)'
          }}
        >
          {selectMode ? 'Done' : 'Select'}
        </button>
      </div>

      {!selectMode && (
        <div style={{ marginBottom: 'var(--space-md)' }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search transcripts..."
            style={{ width: '100%' }}
          />
        </div>
      )}

      {selectMode && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: 'var(--space-md)',
          padding: 'var(--space-sm)',
          background: 'var(--bg-secondary)',
          borderRadius: 8
        }}>
          <button
            onClick={toggleSelectAll}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent)',
              fontSize: 'var(--font-sm)'
            }}
          >
            {selectedIds.size === filteredSegments.length ? 'Deselect all' : 'Select all'}
          </button>
          <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>
            {selectedIds.size} selected
          </span>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filteredSegments.map((seg) => {
          const isSaved = savedIds.has(seg.id);
          const isSaving = savingIds.has(seg.id);
          const isSelected = selectedIds.has(seg.id);
          
          return (
            <div
              key={seg.id}
              onClick={() => selectMode ? toggleSelect(seg.id) : handleSave(seg)}
              style={{
                padding: 'var(--space-md)',
                borderBottom: '1px solid var(--border)',
                background: isSelected ? 'var(--selected-bg, #f0f9ff)' : 'transparent',
                cursor: 'pointer',
                display: 'flex',
                gap: 'var(--space-sm)',
                alignItems: 'flex-start'
              }}
            >
              {selectMode && (
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelect(seg.id)}
                  style={{ marginTop: 4 }}
                  onClick={(e) => e.stopPropagation()}
                />
              )}
              
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                    {formatTime(seg.startMs)}
                  </span>
                  {videoId && (
                    <a
                      href={buildYouTubeTimestampUrl(data.url, seg.startMs)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        fontSize: 'var(--font-xs)',
                        color: 'var(--accent)',
                        textDecoration: 'none'
                      }}
                    >
                      ▶ YouTube
                    </a>
                  )}
                </div>
                <p style={{ fontSize: 'var(--font-sm)', lineHeight: 1.5, margin: 0 }}>
                  {seg.text}
                </p>
              </div>
              
              {!selectMode && (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  minWidth: 60,
                  justifyContent: 'flex-end'
                }}>
                  {isSaving ? (
                    <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>...</span>
                  ) : isSaved ? (
                    <span style={{ fontSize: 'var(--font-xs)', color: 'var(--success)' }}>✓ Saved</span>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSave(seg); }}
                      style={{
                        padding: '4px 8px',
                        fontSize: 'var(--font-xs)',
                        background: 'var(--accent)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer'
                      }}
                    >
                      Save
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        
        {filteredSegments.length === 0 && (
          <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-secondary)' }}>
            {search ? 'No matching segments' : 'No segments'}
          </div>
        )}
      </div>

      {selectMode && selectedIds.size > 0 && (
        <div style={{ 
          padding: 'var(--space-md)', 
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-primary)'
        }}>
          <button
            className="primaryButton"
            onClick={handleSaveSelected}
            disabled={savingAll}
            style={{ width: '100%' }}
          >
            {savingAll ? 'Saving...' : `Save ${selectedIds.size} card${selectedIds.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}
    </div>
  );
}
