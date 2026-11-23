import { useEffect, useState } from 'react';
import EditorPane from './components/EditorPane';
import ErrorPanel from './components/ErrorPanel';
import QuickOpen from './components/QuickOpen';
import ResizablePanel from './components/ResizablePanel';
import SchemaPanel from './components/SchemaPanel';
import TreePanel from './components/TreePanel';
import MenuBar from './components/MenuBar';
import Sidebar from './components/Sidebar';
import StatusBar from './components/StatusBar';
import TabBar from './components/TabBar';
import { confirmCloseTab } from './lib/confirm';
import { openFolderAt, writeFile } from './lib/fs';
import { restoreSession, startSessionPersistence } from './lib/session';
import { useTheme } from './lib/useTheme';
import { useExternalChangeDetection } from './lib/useExternalChangeDetection';
import { useWorkspaceRefresh } from './lib/useWorkspaceRefresh';
import { useStore } from './store/useStore';
import { APP_VERSION, APP_NAME } from './lib/version';

export default function App() {
  const rightPanel = useStore((s) => s.rightPanel);
  const [showVersionNotice, setShowVersionNotice] = useState(false);
  useTheme();
  useWorkspaceRefresh();
  const externalChangeModal = useExternalChangeDetection();

  useEffect(() => {
    startSessionPersistence();
    void restoreSession();
    // Versiyon bildirimini göster (sadece ilk açılışta)
    const shown = localStorage.getItem('jsoneditor-version-shown');
    if (shown !== APP_VERSION) {
      setShowVersionNotice(true);
      localStorage.setItem('jsoneditor-version-shown', APP_VERSION);
    }
  }, []);

  // Tauri'den gelen open events dinleyicisi
  useEffect(() => {
    let unlistenFn: (() => void) | undefined;
    let cancelled = false;

    const checkTauriAndListen = async () => {
      // Tauri kontrolu
      const isTauri = typeof window !== 'undefined' &&
        ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

      if (!isTauri) return;

      try {
        // Tauri IPC ile open event dinle
        const { invoke } = await import('@tauri-apps/api/core');
        const { listen } = await import('@tauri-apps/api/event');

        // Uygulama baslarken mevcut args'i kontrol et
        try {
          const args = await invoke<string[]>('get_args');
          if (!cancelled && args && args.length > 0) {
            // Dosya yollarini handle et
            const jsonFiles = args.filter(a => a.endsWith('.json') || a.endsWith('.jsonc'));
            if (jsonFiles.length > 0) {
              for (const file of jsonFiles) {
                try {
                  const content = await invoke<string>('read_file', { path: file });
                  const name = file.split(/[/\\]/).pop() || file;
                  useStore.getState().openFileTab(file, name, content);
                  // acilan dosyanin klasorunu workspace yap (yalnizca henuz workspace yoksa)
                  const st = useStore.getState();
                  if (!st.workspaceRoot) {
                    const dir = file.replace(/[/\\][^/\\]*$/, '');
                    if (dir) {
                      const r = await openFolderAt(dir);
                      if (r) st.setWorkspace(r.root, r.tree);
                    }
                  }
                } catch (e) {
                  console.error('Dosya acilamadi:', file, e);
                }
              }
            }
          }
        } catch (e) {
          // Args yoksa veya basarili olmazsa devam et
          console.log('Args okunamadi veya args yok:', e);
        }

        // Tauri'den gelen open event'leri dinle
        const unlisten = await listen('open-files', (event: any) => {
          const files = event.payload as string[];
          if (files && files.length > 0) {
            files.forEach(file => {
              try {
                invoke<string>('read_file', { path: file }).then(content => {
                  const name = file.split(/[/\\]/).pop() || file;
                  useStore.getState().openFileTab(file, name, content);
                  const st = useStore.getState();
                  if (!st.workspaceRoot) {
                    const dir = file.replace(/[/\\][^/\\]*$/, '');
                    if (dir) {
                      void openFolderAt(dir).then((r) => {
                        if (r) useStore.getState().setWorkspace(r.root, r.tree);
                      });
                    }
                  }
                }).catch(err => {
                  console.error('Dosya okunamadi:', file, err);
                });
              } catch (e) {
                console.error('Open file error:', e);
              }
            });
          }
        });

        if (cancelled) {
          unlisten();
        } else {
          unlistenFn = unlisten;
        }
      } catch (e) {
        console.error('Tauri open event setup error:', e);
      }
    };

    void checkTauriAndListen();

    return () => {
      cancelled = true;
      unlistenFn?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      // Inputlara odakli iken kısayolları engelle.
      // Monaco editörünün girdi alanı (.monaco-editor içindeki textarea/editcontext)
      // kaydetmenin editör içinde de çalışması için muaf tutulur.
      const el = e.target as HTMLElement | null;
      const inMonaco = !!el?.closest?.('.monaco-editor');
      if (!inMonaco) {
        if (el?.tagName === 'INPUT') return;
        if (el?.tagName === 'TEXTAREA' && !el.classList.contains('inputarea')) return;
      }
      const s = useStore.getState();
      const key = e.key.toLowerCase();
      if (key === 's') {
        e.preventDefault();
        e.stopPropagation();
        const tab = s.activeTab();
        if (!tab) return;
        void writeFile(tab.path, tab.name, tab.content).then((res) => {
          if (res) useStore.getState().markSaved(tab.id, res.path, res.name);
        });
      } else if (key === 'n') {
        e.preventDefault();
        s.newTab();
      } else if (key === 'w') {
        e.preventDefault();
        const tab = s.activeTab();
        if (tab && confirmCloseTab(tab)) s.closeTab(tab.id);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  return (
    <div className="app">
      <MenuBar />
      <div className="main">
        <ResizablePanel storageKey="jsoneditor-w-sidebar" defaultWidth={230} min={150} max={600} side="left">
          <Sidebar />
        </ResizablePanel>
        <div className="center">
          <TabBar />
          <EditorPane />
          <ErrorPanel />
        </div>
        {rightPanel === 'tree' && (
          <ResizablePanel storageKey="jsoneditor-w-right" defaultWidth={300} min={200} max={900} side="right">
            <TreePanel />
          </ResizablePanel>
        )}
        {rightPanel === 'schema' && (
          <ResizablePanel storageKey="jsoneditor-w-right" defaultWidth={300} min={200} max={900} side="right">
            <SchemaPanel />
          </ResizablePanel>
        )}
      </div>
      <StatusBar />
      <QuickOpen />
      {externalChangeModal}

      {/* Versiyon Bildirimi */}
      {showVersionNotice && (
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
            zIndex: 1000,
          }}
          onClick={() => setShowVersionNotice(false)}
        >
          <div
            className="modal"
            style={{
              background: 'var(--bg)',
              padding: '24px',
              borderRadius: 8,
              width: '300px',
              maxWidth: '90vw',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3>{APP_NAME}</h3>
            <p style={{ marginBottom: '16px', color: 'var(--text-dim)' }}>
              Versiyon {APP_VERSION} yüklendi!
            </p>
            <p style={{ marginBottom: '16px', color: 'var(--text-dim)' }}>
              Ağaç görünümünde node'lara tıklayarak doğrudan satıra geçebilirsiniz.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowVersionNotice(false)}
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
                Tamam
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}