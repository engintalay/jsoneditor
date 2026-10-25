import { openFolderAt, readFileByPath } from './fs';
import { useStore } from '../store/useStore';

const KEY = 'jsoneditor-session';
const SECRET = 'json-editor-session-secret-2026';

interface SessionTab {
  path: string;
  name: string;
}

interface Session {
  workspaceRoot: string | null;
  tabs: SessionTab[];
  activePath: string | null;
  signature: string;
}

export function computeSignature(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(data);
  const secretBytes = encoder.encode(SECRET);
  if (typeof crypto !== 'undefined' && (crypto as any).subtle) {
    return (crypto as any).subtle.digest('SHA-256', secretBytes, dataBytes).then(
      (hash: ArrayBuffer) => {
        const hashArray = Array.from(new Uint8Array(hash));
        return hashArray
          .map((b: number) => b.toString(16).padStart(2, '0'))
          .join('');
      },
    );
  }
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0;
  }
  return Promise.resolve((hash >>> 0).toString(16));
}

export function verifySignature(
  data: string,
  signature: string,
): Promise<boolean> {
  return computeSignature(data).then((computed) => computed === signature);
}

/** store degisimlerini (debounce'lu) localStorage'a yazar */
export function startSessionPersistence(): void {
  if (started) return;
  started = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  useStore.subscribe((s) => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const active = s.tabs.find((t) => t.id === s.activeId);
      const data: Session = {
        workspaceRoot: s.workspaceRoot,
        tabs: s.tabs
          .filter((t) => t.path)
          .map((t) => ({ path: t.path!, name: t.name })),
        activePath: active?.path ?? null,
        signature: '',
      };
      const sig = await computeSignature(JSON.stringify(data));
      data.signature = sig;
      try {
        localStorage.setItem(KEY, JSON.stringify(data));
      } catch {
        /* saklama kapali olabilir */
      }
    }, 400);
  });
}

/** son oturumdaki klasoru ve dosyaları geri yukler; okunamayan dosyalar sessizce atlanir */
export async function restoreSession(): Promise<void> {
  let s: Session;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    s = JSON.parse(raw) as Session;
  } catch {
    return;
  }

  const valid = await verifySignature(JSON.stringify(s), s.signature);
  if (!valid) {
    /* Signature gecersiz, eski oturumu sil */
    localStorage.removeItem(KEY);
    return;
  }

  if (s.workspaceRoot) {
    const ws = await openFolderAt(s.workspaceRoot);
    if (ws) useStore.getState().setWorkspace(ws.root, ws.tree);
  }

  for (const t of s.tabs) {
    if (useStore.getState().tabs.some((x) => x.path === t.path)) continue;
    try {
      const content = await readFileByPath(t.path);
      useStore.getState().openFileTab(t.path, t.name, content);
    } catch {
      /* dosya silinmis olabilir */
    }
  }

  if (s.activePath) {
    const found = useStore.getState().tabs.find((t) => t.path === s.activePath);
    if (found) useStore.getState().setActive(found.id);
  }
}

let started = false;