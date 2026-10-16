import { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';

/** 500 KB üstü dosyalarda ağaç render'ı React'i kilitleyebilir */
const TREE_SIZE_LIMIT = 500 * 1024;

function Value({ v }: { v: unknown }) {
  if (v === null) return <span className="null">null</span>;
  if (typeof v === 'string')
    return <span className="str">"{v.length > 120 ? `${v.slice(0, 120)}…` : v}"</span>;
  if (typeof v === 'number') return <span className="num">{v}</span>;
  if (typeof v === 'boolean') return <span className="bool">{String(v)}</span>;
  return null;
}

function segToPath(segments: (string | number)[]): string {
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

function Node({
  k,
  v,
  depth,
  segments,
  copied,
  onCopy,
}: {
  k: string;
  v: unknown;
  depth: number;
  segments: (string | number)[];
  copied: string | null;
  onCopy: (path: string) => void;
}) {
  const [open, setOpen] = useState(depth < 2);
  const isObj = v !== null && typeof v === 'object';
  const entries = isObj ? Object.entries(v as Record<string, unknown>) : [];
  const label = Array.isArray(v) ? `Array(${entries.length})` : `Object(${entries.length})`;

  if (!isObj) {
    const path = segToPath(segments);
    return (
      <div className="tree-node">
        <div className="line" title={path}>
          <span className="key">{k}:</span> <Value v={v} />
          <button
            title={`JSON Path kopyala: ${path}`}
            style={{ marginLeft: 'auto', padding: '0 6px', color: 'var(--text-dim)' }}
            onClick={(e) => {
              e.stopPropagation();
              copyText(path).then((ok) => ok && onCopy(path));
            }}
          >
            {copied === path ? '✓' : '⧉'}
          </button>
        </div>
      </div>
    );
  }
  const path = segToPath(segments);
  return (
    <div className="tree-node">
      <div className="line" onClick={() => setOpen(!open)} title={path}>
        <span>{open ? '▾' : '▸'}</span>
        <span className="key">{k}</span>
        <span style={{ color: 'var(--text-dim)' }}>{label}</span>
        <button
          title={`JSON Path kopyala: ${path}`}
          style={{ marginLeft: 'auto', padding: '0 6px', color: 'var(--text-dim)' }}
          onClick={(e) => {
            e.stopPropagation();
            copyText(path).then((ok) => ok && onCopy(path));
          }}
        >
          {copied === path ? '✓' : '⧉'}
        </button>
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
            />
          </div>
        ))}
    </div>
  );
}

export default function TreePanel() {
  const { activeTab } = useStore();
  const tab = activeTab();
  const [copied, setCopied] = useState<string | null>(null);
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
        {tab && data.ok && tab.content.length > TREE_SIZE_LIMIT && (
          <p style={{ color: 'var(--text-dim)' }}>
            Dosya büyük ({(tab.content.length / 1024).toFixed(0)} KB) — ağaç
            görünümü kapalı, editörden devam edin.
          </p>
        )}
        {tab &&
          data.ok &&
          tab.content.length <= TREE_SIZE_LIMIT &&
          typeof data.value === 'object' &&
          data.value !== null
          ? Object.entries(data.value as Record<string, unknown>).map(([k, v]) => (
              <Node
                key={k}
                k={k}
                v={v}
                depth={0}
                segments={[k]}
                copied={copied}
                onCopy={(p) => {
                  setCopied(p);
                  setTimeout(() => setCopied(null), 1500);
                }}
              />
            ))
          : tab && data.ok && tab.content.length <= TREE_SIZE_LIMIT ? (
              <Value v={data.value} />
            ) : null}
      </div>
    </div>
  );
}
