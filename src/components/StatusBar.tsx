import { useStore } from '../store/useStore';

export default function StatusBar() {
  const { errors, schemaErrors, activeTab } = useStore();
  const tab = activeTab();
  const total = errors.length + schemaErrors.length;
  return (
    <div className={`statusbar ${total > 0 ? 'has-errors' : ''}`}>
      {total === 0 ? (
        <span>✓ Geçerli JSON</span>
      ) : (
        <span>
          ● {total} sorun ({errors.length} sözdizimi, {schemaErrors.length} schema)
        </span>
      )}
      <span className="spacer" />
      <span>{tab?.name ?? 'dosya yok'}</span>
      <span>JSON</span>
      <span>UTF-8</span>
    </div>
  );
}
