import { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';

function Value({ v }: { v: unknown }) {
  if (v === null) return <span className="null">null</span>;
  if (typeof v === 'string') return <span className="str">"{v}"</span>;
  if (typeof v === 'number') return <span className="num">{v}</span>;
  if (typeof v === 'boolean') return <span className="bool">{String(v)}</span>;
  return null;
}

function Node({ k, v, depth }: { k: string; v: unknown; depth: number }) {
  const [open, setOpen] = useState(depth < 2);
  const isObj = v !== null && typeof v === 'object';
  const entries = isObj ? Object.entries(v as Record<string, unknown>) : [];
  const label = Array.isArray(v) ? `Array(${entries.length})` : `Object(${entries.length})`;

  if (!isObj) {
    return (
      <div className="tree-node">
        <div className="line">
          <span className="key">{k}:</span> <Value v={v} />
        </div>
      </div>
    );
  }
  return (
    <div className="tree-node">
      <div className="line" onClick={() => setOpen(!open)}>
        <span>{open ? '▾' : '▸'}</span>
        <span className="key">{k}</span>
        <span style={{ color: 'var(--text-dim)' }}>{label}</span>
      </div>
      {open &&
        entries.map(([ck, cv]) => (
          <div key={ck} style={{ marginLeft: 14 }}>
            <Node k={Array.isArray(v) ? `[${ck}]` : ck} v={cv} depth={depth + 1} />
          </div>
        ))}
    </div>
  );
}

export default function TreePanel() {
  const { activeTab } = useStore();
  const tab = activeTab();
  const data = useMemo(() => {
    if (!tab) return { ok: false as const };
    try {
      return { ok: true as const, value: JSON.parse(tab.content) as unknown };
    } catch {
      return { ok: false as const };
    }
  }, [tab?.content, tab?.id]);

  return (
    <div className="right-panel">
      <h3>Ağaç Görünümü</h3>
      <div className="tree-view">
        {!tab && <p style={{ color: 'var(--text-dim)' }}>Dosya açın.</p>}
        {tab && !data.ok && (
          <p style={{ color: 'var(--error)' }}>
            JSON hatalı — ağaç gösterilemiyor. Önce hatayı düzeltin.
          </p>
        )}
        {tab && data.ok && typeof data.value === 'object' && data.value !== null ? (
          Object.entries(data.value as Record<string, unknown>).map(([k, v]) => (
            <Node key={k} k={k} v={v} depth={0} />
          ))
        ) : tab && data.ok ? (
          <Value v={data.value} />
        ) : null}
      </div>
    </div>
  );
}
