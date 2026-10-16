import { pickAndReadFile, pickFolder, writeFile } from '../lib/fs';
import { useStore } from '../store/useStore';

export default function MenuBar() {
  const store = useStore();

  const onOpenFile = async () => {
    const f = await pickAndReadFile();
    if (f) store.openFileTab(f.path, f.name, f.content);
  };

  const onOpenFolder = async () => {
    const res = await pickFolder();
    if (res) store.setWorkspace(res.root, res.tree);
    else if (!(window as unknown as { __TAURI__: unknown }).__TAURI__) {
      alert('Klasör açma yalnızca masaüstü uygulamasında desteklenir.');
    }
  };

  const onSave = async () => {
    const tab = store.activeTab();
    if (!tab) return;
    const res = await writeFile(tab.path, tab.name, tab.content);
    if (res) store.markSaved(tab.id, res.path, res.name);
  };

  return (
    <div className="menubar">
      <button onClick={() => store.newTab()}>+ Yeni</button>
      <button onClick={onOpenFile}>Dosya Aç</button>
      <button onClick={onOpenFolder}>Klasör Aç</button>
      <button onClick={onSave}>Kaydet</button>
      <div className="actions">
        <button data-act="format">Formatla</button>
        <button data-act="minify">Minify</button>
        <button data-act="sort">Key Sırala</button>
      </div>
      <div className="actions">
        <button
          onClick={() =>
            store.setRightPanel(store.rightPanel === 'tree' ? null : 'tree')
          }
        >
          Ağaç
        </button>
        <button
          onClick={() =>
            store.setRightPanel(store.rightPanel === 'schema' ? null : 'schema')
          }
        >
          Schema
        </button>
      </div>
      <span className="title">JSON Editor</span>
    </div>
  );
}
