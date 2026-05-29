interface VideoImportScreenProps {
  onComplete?: (createdCount: number) => void;
  onCancel?: () => void;
  onViewTranscript?: (data: { url: string; title: string; segments: any[]; sourceLang: string }) => void;
  onOpenPlayer?: (data: { url: string; title: string; segments: any[]; sourceLang: string }) => void;
}

export function VideoImportScreen({ onCancel }: VideoImportScreenProps) {
  return (
    <div className="screen" style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center',
      padding: 'var(--space-xl)',
      textAlign: 'center'
    }}>
      <h1 style={{ 
        fontSize: 'var(--font-2xl)', 
        fontWeight: 700, 
        marginBottom: 'var(--space-md)',
        color: 'var(--text)'
      }}>
        Coming Soon
      </h1>
      <p style={{ 
        fontSize: 'var(--font-base)', 
        color: 'var(--text-secondary)',
        maxWidth: 300,
        marginBottom: 'var(--space-xl)'
      }}>
        We're working on bringing you video import functionality. Stay tuned!
      </p>
      {onCancel && (
        <button className="btn btn-primary" onClick={onCancel}>
          Go Back
        </button>
      )}
    </div>
  )
}