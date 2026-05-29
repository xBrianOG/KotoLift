import { useState, useRef } from 'react'
import { parseCSV, importCards, parseAPKG, importAPKG, type ImportPreview, type APKGPreview } from '../services/decks'

type Preview = ImportPreview | APKGPreview;
type FileType = 'csv' | 'apkg' | null;

export function ImportScreen({ onBack, onComplete }: { onBack?: () => void; onComplete?: (deckName: string, cardCount: number) => void } = {}) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [fileType, setFileType] = useState<FileType>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setSelectedFile(file)
    setError(null)
    setProgress({ current: 0, total: 0 })
    
    try {
      const isAPKG = file.name.toLowerCase().endsWith('.apkg');
      const isCSV = file.name.toLowerCase().endsWith('.csv') || file.name.toLowerCase().endsWith('.txt');
      
      if (!isAPKG && !isCSV) {
        setError('Please upload a .csv or .apkg file')
        return
      }
      
      if (isAPKG) {
        setFileType('apkg')
        console.log('Parsing APKG file:', file.name)
        const parsed = await parseAPKG(file)
        console.log('APKG parsed, cards:', parsed.cards.length)
        
        if (parsed.cards.length === 0) {
          setError('No valid cards found in the APKG file.')
          return
        }
        
        setPreview(parsed)
      } else {
        setFileType('csv')
        const text = await file.text()
        const parsed = parseCSV(text)
        
        if (parsed.cards.length === 0) {
          setError('No valid cards found in the file. Make sure the CSV has "front,back" format.')
          return
        }
        
        setPreview(parsed)
      }
    } catch (err) {
      setError('Failed to parse file. Please use a valid CSV or APKG file.')
      console.error(err)
    }
  }

  const handleImport = async () => {
    console.log('handleImport called', { preview: !!preview, fileType, selectedFile: !!selectedFile })
    if (!preview || !fileType || !selectedFile) {
      setError('Please select a file first')
      return
    }

    setImporting(true)
    setError(null)

    try {
      let deck, importedCount;
      
      if (fileType === 'apkg') {
        console.log('Importing APKG, file:', selectedFile.name)
        const apkgPreview = preview as APKGPreview;
        const result = await importAPKG(
          selectedFile,
          apkgPreview,
          (current, total) => setProgress({ current, total })
        );
        deck = result.deck;
        importedCount = result.importedCount;
      } else {
        const csvPreview = preview as ImportPreview;
        const result = await importCards(csvPreview.deckName, csvPreview.cards);
        deck = result.deck;
        importedCount = result.importedCount;
      }
      
      onComplete?.(deck.name, importedCount)
    } catch (err) {
      console.error('Import failed:', err)
      setError('Failed to import cards. Please try again.')
    } finally {
      setImporting(false)
      setProgress({ current: 0, total: 0 })
    }
  }

  const handleReset = () => {
    setPreview(null)
    setFileType(null)
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const hasAudio = fileType === 'apkg' && (preview as APKGPreview)?.totalMedia > 0;

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
        <h1 className="text-2xl font-bold">Import Deck</h1>
      </div>

      {/* Error */}
      {error && (
        <div className="card mb-lg p-md" style={{ background: 'var(--danger-light)', borderColor: 'var(--danger)' }}>
          <p className="text-danger">{error}</p>
        </div>
      )}

      {/* Progress */}
      {importing && progress.total > 0 && (
        <div className="card mb-lg p-md">
          <div className="flex-between mb-sm">
            <span className="text-sm">Importing cards...</span>
            <span className="text-sm font-medium">{progress.current} / {progress.total}</span>
          </div>
          <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
            <div 
              style={{ 
                height: '100%', 
                width: `${(progress.current / progress.total) * 100}%`,
                background: 'var(--accent)',
                transition: 'width 0.2s'
              }} 
            />
          </div>
        </div>
      )}

      {!preview ? (
        /* Upload Section */
        <div className="card p-xl flex-center flex-col text-center">
          <div className="mb-lg">
            <div className="flex-center mb-md">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <h3 className="font-semibold mb-sm">Import CSV or APKG File</h3>
            <p className="text-secondary text-sm">
              Upload a CSV file or Anki deck (.apkg)<br />
              CSV format: front,back,tags (optional)
            </p>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            accept=".csv,.txt,.apkg"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-primary"
          >
            Choose File
          </button>

          <div className="mt-lg text-left w-full">
            <p className="text-xs text-secondary mb-sm">CSV format:</p>
            <code className="block p-sm bg-surface rounded text-xs" style={{ fontSize: 11 }}>
              front,back,tags<br />
              Hello,こんにちは,greeting<br />
              Thank you,ありがとう,polite
            </code>
            <p className="text-xs text-secondary mt-md mb-sm">APKG format:</p>
            <p className="text-xs text-secondary">
              Export from Anki as .apkg and upload.<br />
              Audio is supported!
            </p>
          </div>
        </div>
      ) : (
        /* Preview Section */
        <div>
          <div className="card mb-lg p-0 overflow-hidden">
            <div className="px-md py-sm bg-surface font-semibold text-sm text-secondary border-b border-border">
              Import Preview
            </div>
            <div className="p-md flex-col gap-sm">
              <div className="flex-between">
                <span className="text-secondary">Deck Name</span>
                <span className="font-medium">{preview.deckName}</span>
              </div>
              <div className="flex-between">
                <span className="text-secondary">Cards Found</span>
                <span className="font-medium">{preview.cards.length}</span>
              </div>
              <div className="flex-between">
                <span className="text-secondary">Detected Language</span>
                <span className="font-medium uppercase">{preview.detectedLang}</span>
              </div>
              {hasAudio && (
                <div className="flex-between">
                  <span className="text-secondary">Audio Files</span>
                  <span className="font-medium flex-center gap-xs">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                    </svg>
                    {(preview as APKGPreview).totalMedia}
                  </span>
                </div>
              )}
              <div className="flex-between">
                <span className="text-secondary">File Type</span>
                <span className="font-medium uppercase">{fileType}</span>
              </div>
            </div>
          </div>

          {/* Card Preview */}
          <div className="card mb-lg p-0 overflow-hidden">
            <div className="px-md py-sm bg-surface font-semibold text-sm text-secondary border-b border-border">
              Sample Cards
            </div>
            <div className="flex-col">
              {preview.cards.slice(0, 5).map((card, i) => (
                <div key={i} className="p-md border-b border-border-last">
                  <div className="font-medium flex-center gap-xs">
                    {card.audioFilename && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                      </svg>
                    )}
                    {card.front}
                  </div>
                  <div className="text-secondary text-sm">{card.back}</div>
                </div>
              ))}
              {preview.cards.length > 5 && (
                <div className="p-md text-secondary text-sm text-center">
                  + {preview.cards.length - 5} more cards
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-md">
            <button
              onClick={handleReset}
              className="btn btn-secondary flex-1"
              disabled={importing}
            >
              Choose Different File
            </button>
            <button
              onClick={handleImport}
              className="btn btn-primary flex-1"
              disabled={importing}
            >
              {importing ? 'Importing...' : `Import ${preview.cards.length} Cards`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}