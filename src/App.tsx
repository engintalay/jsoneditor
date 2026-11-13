import { useEffect } from 'react';
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
import { writeFile } from './lib/fs';
import { restoreSession, startSessionPersistence } from './lib/session';
import { useTheme } from './lib/useTheme';
import { useWorkspaceRefresh } from './lib/useWorkspaceRefresh';
import { useStore } from './store/useStore';

export default function App() {
  const rightPanel = useStore((s) => s.rightPanel);
  useTheme();
  useWorkspaceRefresh();
  
  useEffect(() => {
    startSessionPersistence();
    void restoreSession();
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
    </div>
  );
}
