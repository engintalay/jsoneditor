import { openFolderAt, readFileByPath } from './fs';
import { useStore } from '../store/useStore';

const KEY = 'jsoneditor-session';

interface SessionTab {
  path: string;
  name: string;
}

interface Session {
  workspaceRoot: string | null;
  tabs: SessionTab[];
  activePath: string | null;
}

let started = false;

/** store degisimlerini (debounce'lu) localStorage'a yazar */
export function startSessionPersistence(): void {
  if (started) return;
  started = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  useStore.subscribe((s) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const active = s.tabs.find((t) => t.id === s.activeId);
      const data: Session = {
        workspaceRoot: s.workspaceRoot,
        tabs: s.tabs
          .filter((t) => t.path)
          .map((t) => ({ path: t.path!, name: t.name })),
        activePath: active?.path ?? null,
      };
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
