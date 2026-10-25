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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      // Inputlara odakli iken kısayolları engelle
      if (e.target && (e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.target && (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      const s = useStore.getState();
      if (e.key === 's') {
        e.preventDefault();
        const tab = s.activeTab();
        if (!tab) return;
        writeFile(tab.path, tab.name, tab.content).then((res) => {
          if (res) s.markSaved(tab.id, res.path, res.name);
        });
      } else if (e.key === 'n') {
        e.preventDefault();
        s.newTab();
      } else if (e.key === 'w') {
        e.preventDefault();
        const tab = s.activeTab();
        if (tab && confirmCloseTab(tab)) s.closeTab(tab.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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
