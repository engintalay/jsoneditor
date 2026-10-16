import { useEffect } from 'react';
import EditorPane from './components/EditorPane';
import ErrorPanel from './components/ErrorPanel';
import MenuBar from './components/MenuBar';
import Sidebar from './components/Sidebar';
import StatusBar from './components/StatusBar';
import TabBar from './components/TabBar';
import { writeFile } from './lib/fs';
import { useStore } from './store/useStore';

export default function App() {
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
        if (s.activeId) s.closeTab(s.activeId);
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
      </div>
      <StatusBar />
    </div>
  );
}
