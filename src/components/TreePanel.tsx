import { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';

/** 500 KB üstü dosyalarda ağaç render'ı React'i kilitleyebilir */
const TREE_SIZE_LIMIT = 500 * 1024;
const TABLE_ROW_LIMIT = 200;

type Segments = (string | number)[];

function Value({ v }: { v: unknown }) {
  if (v === null) return <span className="null">null</span>;
  if (typeof v === 'string')
    return <span className="str">"{v.length > 120 ? `${v.slice(0, 120)}…` : v}"</span>;
  if (typeof v === 'number') return <span className="num">{v}</span>;
  if (typeof v === 'boolean') return <span className="bool">{String(v)}</span>;
  return null;
}

function segToPath(segments: Segments): string {
  let out = '$';
  for (const s of segments) {
    out += typeof s === 'number' ? `[${s}]` : `["${s.replace(/"/g, '\\"')}"]`;
  }
  return out;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      return true;
    } catch {
      return false;
    }
  }
}

/** "123" -> 123, '"abc"' -> abc, ham metin -> string olarak bırak */
function parseInput(raw: string): unknown {
  const t = raw.trim();
  if (t === '') return '';
  try {
    return JSON.parse(t);
  } catch {
    return raw;
  }
}

function setAt(root: unknown, segs: Segments, value: unknown): unknown {
  if (segs.length === 0) return value;
  const [head, ...rest] = segs;
  if (Array.isArray(root)) {
    const copy = [...root];
    copy[head as number] = setAt(copy[head as number], rest, value);
    return copy;
  }
  const copy = { ...(root as Record<string, unknown>) };
  copy[head as string] = setAt(copy[head as string], rest, value);
  return copy;
}

function deleteAt(root: unknown, segs: Segments): unknown {
  if (segs.length === 0) return undefined;
  const [head, ...rest] = segs;
  if (rest.length === 0) {
    if (Array.isArray(root)) return root.filter((_, i) => i !== (head as number));
    const copy = { ...(root as Record<string, unknown>) };
    delete copy[head as string];
    return copy;
  }
  if (Array.isArray(root)) {
    const copy = [...root];
    copy[head as number] = deleteAt(copy[head as number], rest);
    return copy;
  }
  const copy = { ...(root as Record<string, unknown>) };
  copy[head as string] = deleteAt(copy[head as string], rest);
  return copy;
}

const iconBtn: React.CSSProperties = {
  marginLeft: 4,
  padding: '0 6px',
  color: 'var(--text-dim)',
};

function Node({
  k,
  v,
  depth,
  segments,
  copied,
  onCopy,
  onEdit,
  onDelete,
}: {
  k: string;
  v: unknown;
  depth: number;
  segments: Segments;
  copied: string | null;
  onCopy: (path: string) => void;
  onEdit: (segments: Segments, raw: string) => void;
  onDelete: (segments: Segments) => void;
}) {
  const [open, setOpen] = useState(depth < 2);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const isObj = v !== null && typeof v === 'object';
  const entries = isObj ? Object.entries(v as Record<string, unknown>) : [];
  const label = Array.isArray(v) ? `Array(${entries.length})` : `Object(${entries.length})`;
  const path = segToPath(segments);

  const commit = () => {
    setEditing(false);
    onEdit(segments, draft);
  };

  if (!isObj) {
    return (
      <div className="tree-node">
        <div className="line" title={path}>
          <span className="key">{k}:</span>{' '}
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') setEditing(false);
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                flex: 1,
                background: 'var(--bg)',
                color: 'var(--text)',
                border: '1px solid var(--accent)',
                borderRadius: 3,
                fontFamily: 'var(--mono)',
                fontSize: 12,
              }}
            />
          ) : (
            <span
              onDoubleClick={() => {
                setDraft(typeof v === 'string' ? v : JSON.stringify(v));
                setEditing(true);
              }}
              title="Düzenlemek için çift tıkla"
              style={{ cursor: 'text' }}
            >
              <Value v={v} />
            </span>
          )}
          <span style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}>
            <button
              title={`JSON Path kopyala: ${path}`}
              style={iconBtn}
              onClick={(e) => {
                e.stopPropagation();
                copyText(path).then((ok) => ok && onCopy(path));
              }}
            >
              {copied === path ? '✓' : '⧉'}
            </button>
            <button
              title="Düğümü sil"
              style={iconBtn}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(segments);
              }}
            >
              🗑
            </button>
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className="tree-node">
      <div className="line" onClick={() => setOpen(!open)} title={path}>
        <span>{open ? '▾' : '▸'}</span>
        <span className="key">{k}</span>
        <span style={{ color: 'var(--text-dim)' }}>{label}</span>
        <span style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}>
          <button
            title={`JSON Path kopyala: ${path}`}
            style={iconBtn}
            onClick={(e) => {
              e.stopPropagation();
              copyText(path).then((ok) => ok && onCopy(path));
            }}
          >
            {copied === path ? '✓' : '⧉'}
          </button>
          <button
            title="Düğümü sil"
            style={iconBtn}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(segments);
            }}
          >
            🗑
          </button>
        </span>
      </div>
      {open &&
        entries.map(([ck, cv], i) => (
          <div key={ck} style={{ marginLeft: 14 }}>
            <Node
              k={Array.isArray(v) ? `[${ck}]` : ck}
              v={cv}
              depth={depth + 1}
              segments={[...segments, Array.isArray(v) ? i : ck]}
              copied={copied}
              onCopy={onCopy}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </div>
        ))}
    </div>
  );
}

function cellText(v: unknown): string {
  if (v === null) return 'null';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/** Obje dizisini tablo olarak gösterir */
function TableView({
  rows,
  base,
  onCopy,
  copied,
}: {
  rows: Record<string, unknown>[];
  base: Segments;
  onCopy: (p: string) => void;
  copied: string | null;
}) {
  const cols = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows.slice(0, 50)) Object.keys(r).forEach((k) => set.add(k));
    return [...set].slice(0, 20);
  }, [rows]);
  const shown = rows.slice(0, TABLE_ROW_LIMIT);
  return (
    <div className="tree-view">
      <p style={{ color: 'var(--text-dim)', padding: '0 4px' }}>
        {rows.length} satır{rows.length > TABLE_ROW_LIMIT && ` (ilk ${TABLE_ROW_LIMIT} gösteriliyor)`} — hücreye tıkla, path kopyalanır.
      </p>
      <table className="json-table">
        <thead>
          <tr>
            <th>#</th>
            {cols.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
            <tr key={i}>
              <td style={{ color: 'var(--text-dim)' }}>{i}</td>
              {cols.map((c) => {
                const p = segToPath([...base, i, c]);
                return (
                  <td
                    key={c}
                    title={p}
                    onClick={() => copyText(cellText(r[c])).then((ok) => ok && onCopy(p))}
                    style={{ cursor: 'copy' }}
                  >
                    {copied === p ? '✓ ' : ''}
                    {cellText(r[c]).slice(0, 60)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function findTable(value: unknown): { rows: Record<string, unknown>[]; base: Segments } | null {
  if (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((r) => r !== null && typeof r === 'object' && !Array.isArray(r))
  ) {
    return { rows: value as Record<string, unknown>[], base: [] };
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const found = findTable(v);
      if (found) return { rows: found.rows, base: [k, ...found.base] };
    }
  }
  return null;
}

export default function TreePanel() {
  const { activeTab, updateContent } = useStore();
  const tab = activeTab();
  const [copied, setCopied] = useState<string | null>(null);
  const [view, setView] = useState<'tree' | 'table'>('tree');
  const data = useMemo(() => {
    if (!tab) return { ok: false as const };
    try {
      return { ok: true as const, value: JSON.parse(tab.content) as unknown };
    } catch {
      return { ok: false as const };
    }
  }, [tab?.content, tab?.id]);

  const flagCopied = (p: string) => {
    setCopied(p);
    setTimeout(() => setCopied(null), 1500);
  };

  const commitEdit = (segments: Segments, raw: string) => {
    if (!tab || !data.ok) return;
    try {
      const next = setAt(data.value, segments, parseInput(raw));
      updateContent(tab.id, JSON.stringify(next, null, 2));
    } catch {
      /* geçersiz kök durumu; editörden devam */
    }
  };

  const commitDelete = (segments: Segments) => {
    if (!tab || !data.ok) return;
    if (!window.confirm(`"${segToPath(segments)}" silinsin mi?`)) return;
    const next = deleteAt(data.value, segments);
    updateContent(tab.id, JSON.stringify(next === undefined ? null : next, null, 2));
  };

  const table = data.ok ? findTable(data.value) : null;
  const tooBig = !!tab && tab.content.length > TREE_SIZE_LIMIT;

  return (
    <div className="right-panel">
      <h3>
        Ağaç Görünümü
        <span style={{ marginLeft: 8 }}>
          <button
            onClick={() => setView('tree')}
            style={view === 'tree' ? { background: 'var(--bg-hover)' } : undefined}
          >
            Ağaç
          </button>
          <button
            onClick={() => setView('table')}
            style={view === 'table' ? { background: 'var(--bg-hover)' } : undefined}
          >
            Tablo
          </button>
        </span>
      </h3>
      {!tab && (
        <div className="tree-view">
          <p style={{ color: 'var(--text-dim)' }}>Dosya açın.</p>
        </div>
      )}
      {tab && !data.ok && (
        <div className="tree-view">
          <p style={{ color: 'var(--error)' }}>
            JSON hatalı — ağaç gösterilemiyor. Önce hatayı düzeltin.
          </p>
        </div>
      )}
      {tab && data.ok && tooBig && (
        <div className="tree-view">
          <p style={{ color: 'var(--text-dim)' }}>
            Dosya büyük ({(tab.content.length / 1024).toFixed(0)} KB) — ağaç/tablo
            görünümü kapalı, editörden devam edin.
          </p>
        </div>
      )}
      {tab && data.ok && !tooBig && view === 'table' && !table && (
        <div className="tree-view">
          <p style={{ color: 'var(--text-dim)' }}>
            Tabloluk veri yok — obje dizisi içeren bir JSON açın.
          </p>
        </div>
      )}
      {tab && data.ok && !tooBig && view === 'table' && table && (
        <TableView rows={table.rows} base={table.base} onCopy={flagCopied} copied={copied} />
      )}
      {tab && data.ok && !tooBig && view === 'tree' && (
        <div className="tree-view">
          {typeof data.value === 'object' && data.value !== null ? (
            Object.entries(data.value as Record<string, unknown>).map(([k, v]) => (
              <Node
                key={k}
                k={k}
                v={v}
                depth={0}
                segments={[k]}
                copied={copied}
                onCopy={flagCopied}
                onEdit={commitEdit}
                onDelete={commitDelete}
              />
            ))
          ) : (
            <Value v={data.value} />
          )}
        </div>
      )}
    </div>
  );
}
