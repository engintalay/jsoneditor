import { create } from 'zustand';
import type { FileNode, JsonError, Tab, ThemeMode } from '../types';

let seq = 0;
const nid = () => `tab-${Date.now()}-${seq++}`;

const readTheme = (): ThemeMode => {
  try {
    const v = localStorage.getItem('jsoneditor-theme');
    if (v === 'dark' || v === 'light' || v === 'system') return v;
  } catch {
    /* localStorage erisilemez */
  }
  return 'system';
};

interface State {
  tabs: Tab[];
  activeId: string | null;
  workspaceRoot: string | null;
  fileTree: FileNode[];
  errors: JsonError[];
  schemaErrors: JsonError[];
  rightPanel: 'tree' | 'schema' | null;
  jump: { line: number; column: number; nonce: number } | null;
  schemaText: string;
  theme: ThemeMode;
  resolvedTheme: 'dark' | 'light';

  newTab: () => void;
  openFileTab: (path: string, name: string, content: string) => void;
  closeTab: (id: string) => void;
  setActive: (id: string) => void;
  updateContent: (id: string, content: string) => void;
  markSaved: (id: string, path: string, name: string) => void;
  setWorkspace: (root: string | null, tree: FileNode[]) => void;
  setErrors: (errors: JsonError[]) => void;
  setSchemaErrors: (errors: JsonError[]) => void;
  setRightPanel: (p: State['rightPanel']) => void;
  jumpTo: (line: number, column: number) => void;
  setSchemaText: (t: string) => void;
  setTheme: (t: ThemeMode) => void;
  activeTab: () => Tab | undefined;
}

export const useStore = create<State>((set, get) => ({
  tabs: [],
  activeId: null,
  workspaceRoot: null,
  fileTree: [],
  errors: [],
  schemaErrors: [],
  rightPanel: 'tree',
  jump: null,
  schemaText: '',
  theme: readTheme(),
  resolvedTheme: 'dark',

  newTab: () => {
    const tab: Tab = {
      id: nid(),
      name: `Adsız-${get().tabs.length + 1}.json`,
      content: '{\n  \n}',
      dirty: false,
      language: 'json',
    };
    set((s) => ({ tabs: [...s.tabs, tab], activeId: tab.id }));
  },
  openFileTab: (path, name, content) => {
    const existing = get().tabs.find((t) => t.path === path);
    if (existing) {
      set({ activeId: existing.id });
      return;
    }
    const tab: Tab = { id: nid(), name, path, content, dirty: false, language: 'json' };
    set((s) => ({ tabs: [...s.tabs, tab], activeId: tab.id }));
  },
  closeTab: (id) =>
    set((s) => {
      const tabs = s.tabs.filter((t) => t.id !== id);
      const activeId =
        s.activeId === id
          ? (tabs[tabs.length - 1]?.id ?? null)
          : s.activeId;
      return { tabs, activeId };
    }),
  setActive: (id) => set({ activeId: id }),
  updateContent: (id, content) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === id ? { ...t, content, dirty: true } : t,
      ),
    })),
  markSaved: (id, path, name) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === id ? { ...t, path, name, dirty: false } : t,
      ),
    })),
  setWorkspace: (root, tree) =>
    set({ workspaceRoot: root, fileTree: tree }),
  setErrors: (errors) => set({ errors }),
  setSchemaErrors: (errors) => set({ schemaErrors: errors }),
  setRightPanel: (p) => set({ rightPanel: p }),
  jumpTo: (line, column) => set({ jump: { line, column, nonce: Date.now() } }),
  setSchemaText: (t) => set({ schemaText: t }),
  setTheme: (t) => set({ theme: t }),
  activeTab: () => {
    const { tabs, activeId } = get();
    return tabs.find((t) => t.id === activeId);
  },
}));
