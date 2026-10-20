import { useEffect, useMemo, useRef, useState } from 'react';
import { readFileByPath } from '../lib/fs';
import { useStore } from '../store/useStore';
import type { FileNode } from '../types';

interface Entry {
  name: string;
  path: string;
  /** kök-göreli görünen yol (dizin/dosya) */
  display: string;
}

/** ağacı dosyalara (yapraklara) indirger */
function flatten(nodes: FileNode[], out: FileNode[] = []): FileNode[] {
  for (const n of nodes) {
    if (n.isDir) flatten(n.children ?? [], out);
    else out.push(n);
  }
  return out;
}

/**
 * VS Code tarzı fuzzy puanlama: sorgu karakterleri sırayla geçmeli.
 * Ardışık eşleşme, kelime/parça başı eşleşmesi ve kısa yol ödüllendirilir.
 */
function fuzzyScore(query: string, target: string): number | null {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let score = 0;
  let ti = 0;
  let last = -2;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found === -1) return null;
    score += 1;
    if (found === last + 1) score += 3; // ardışık
    if (found === 0 || '/-_. '.includes(t[found - 1])) score += 2; // parça başı
    last = found;
    ti = found + 1;
  }
  return score - target.length * 0.05;
}

function splitHighlight(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  const parts: React.ReactNode[] = [];
  let ti = 0;
  let buf = '';
  let bufMatch = false;
  const flush = () => {
    if (!buf) return;
    parts.push(
      bufMatch ? (
        <b key={parts.length} style={{ color: 'var(--accent)' }}>
          {buf}
        </b>
      ) : (
        <span key={parts.length}>{buf}</span>
      ),
    );
    buf = '';
  };
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found === -1) break;
    buf += text.slice(ti, found);
    bufMatch = false;
    flush();
    bufMatch = true;
    buf = text.slice(found, found + 1);
    flush();
    ti = found + 1;
  }
  bufMatch = false;
  buf += text.slice(ti);
  flush();
  return parts;
}

export default function QuickOpen() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileTree = useStore((s) => s.fileTree);
  const openFileTab = useStore((s) => s.openFileTab);
  const setActive = useStore((s) => s.setActive);

  // Ctrl+P / Cmd+P ile aç, Escape ile kapat
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && !e.shiftKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        setOpen(true);
        setQuery('');
        setSel(0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const all = useMemo(() => {
    const map = new Map<string, Entry>();
    for (const f of flatten(fileTree)) {
      map.set(f.path, { name: f.name, path: f.path, display: f.path });
    }
    return [...map.values()];
  }, [fileTree]);

  const results = useMemo(() => {
    const scored = all
      .map((e) => ({ e, s: fuzzyScore(query, e.display) }))
      .filter((x): x is { e: Entry; s: number } => x.s !== null)
      .sort((a, b) => b.s - a.s);
    return scored.slice(0, 100).map((x) => x.e);
  }, [all, query]);

  if (!open) return null;

  const openEntry = async (entry: Entry) => {
    const st = useStore.getState();
    const existing = st.tabs.find((t) => t.path === entry.path);
    if (existing) {
      setActive(existing.id);
    } else {
      try {
        const content = await readFileByPath(entry.path);
        openFileTab(entry.path, entry.name, content);
      } catch {
        alert(`Dosya açılamadı: ${entry.path}`);
      }
    }
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[sel]) void openEntry(results[sel]);
    }
  };

  return (
    <div className="quickopen-overlay" onClick={() => setOpen(false)}>
      <div className="quickopen" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="quickopen-input"
          placeholder="Dosya adıyla ara… (Ctrl+P)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSel(0);
          }}
          onKeyDown={onKeyDown}
        />
        <ul className="quickopen-list">
          {results.length === 0 && (
            <li className="empty">
              {all.length === 0
                ? 'Workspace açık değil — önce Klasör Aç.'
                : 'Eşleşen dosya yok.'}
            </li>
          )}
          {results.map((r, i) => (
            <li
              key={r.path}
              className={i === sel ? 'sel' : ''}
              onMouseEnter={() => setSel(i)}
              onClick={() => void openEntry(r)}
            >
              <span className="qo-name">{splitHighlight(r.name, query)}</span>
              <span className="qo-path">{splitHighlight(r.display, query)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
