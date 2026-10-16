import { useStore } from '../store/useStore';

export default function ErrorPanel() {
  const { errors, schemaErrors, jumpTo } = useStore();
  if (errors.length === 0 && schemaErrors.length === 0) return null;
  return (
    <div className="error-panel">
      <header>
        Sorunlar: {errors.length} sözdizimi, {schemaErrors.length} schema
      </header>
      <ul>
        {errors.map((e, i) => (
          <li
            key={`s-${i}`}
            className="err"
            onClick={() => jumpTo(e.line, e.column)}
          >
            ✕ Satır {e.line}, Sütun {e.column}: {e.message}
          </li>
        ))}
        {schemaErrors.map((e, i) => (
          <li
            key={`c-${i}`}
            className="warn"
            onClick={() => jumpTo(e.line, e.column)}
          >
            ⚠ Satır {e.line}: {e.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
