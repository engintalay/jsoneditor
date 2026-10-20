import { useEffect } from 'react';
import EditorPane from './components/EditorPane';
import ErrorPanel from './components/ErrorPanel';
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
        <Sidebar />
        <div className="center">
          <TabBar />
          <EditorPane />
          <ErrorPanel />
        </div>
        {rightPanel === 'tree' && <TreePanel />}
        {rightPanel === 'schema' && <SchemaPanel />}
      </div>
      <StatusBar />
    </div>
  );
}
