interface Props {
  tab: { name: string; dirty: boolean };
  onReload: () => void;
  onKeep: () => void;
  onNever: () => void;
}

export default function ExternalChangeModal({ tab, onReload, onKeep, onNever }: Props) {
  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
    >
      <div
        className="modal"
        style={{
          background: 'var(--bg)',
          padding: '24px',
          borderRadius: 8,
          width: '420px',
          maxWidth: '90vw',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}
      >
        <h3 style={{ marginTop: 0 }}>Dosya Dışarıdan Değiştirildi</h3>
        <p style={{ marginBottom: '12px', color: 'var(--text-dim)' }}>
          <strong>{tab.name}</strong> dosyası diskte değişti. Editör içeriği yeniden yüklensin mi?
        </p>
        {tab.dirty && (
          <p style={{ marginBottom: '16px', color: 'var(--danger, #c00)', fontSize: '13px' }}>
            Uyarı: Kaydedilmemiş değişiklikler kaybolabilir.
          </p>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            onClick={onNever}
            style={{
              cursor: 'pointer',
              padding: '4px 12px',
              border: '1px solid var(--border)',
              borderRadius: 4,
              background: 'var(--btn-bg)',
              color: 'var(--text)',
              fontSize: '14px',
            }}
          >
            Tekrar Sorma
          </button>
          <button
            onClick={onKeep}
            style={{
              cursor: 'pointer',
              padding: '4px 12px',
              border: '1px solid var(--border)',
              borderRadius: 4,
              background: 'var(--btn-bg)',
              color: 'var(--text)',
              fontSize: '14px',
            }}
          >
            Vazgeç
          </button>
          <button
            onClick={onReload}
            style={{
              cursor: 'pointer',
              padding: '4px 12px',
              border: '1px solid var(--accent)',
              borderRadius: 4,
              background: 'var(--accent)',
              color: 'var(--btn-text)',
              fontSize: '14px',
            }}
          >
            Yeniden Yükle
          </button>
        </div>
      </div>
    </div>
  );
}