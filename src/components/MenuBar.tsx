import { formatJson, minifyJson, parseErrors, sortKeys } from '../lib/jsonUtils';
import { pickAndReadFile, pickFolder, writeFile } from '../lib/fs';
import { useStore } from '../store/useStore';

export default function MenuBar() {
  const store = useStore();
  const tab = store.activeTab();

  const needValid = (): string | null => {
    if (!tab) return null;
    const errs = parseErrors(tab.content);
    if (errs.length > 0) {
      store.setErrors(errs);
      const first = errs[0];
      store.jumpTo(first.line, first.column);
      alert(
        `JSON hatalı — formatlanamadı.\nSatır ${first.line}, Sütun ${first.column}: ${first.message}`,
      );
      return null;
    }
    return tab.content;
  };

  const onFormat = () => {
    const src = needValid();
    if (src && tab) {
      try {
        store.updateContent(tab.id, formatJson(src));
      } catch (e) {
        alert(`Formatlama hatası: ${(e as Error).message}`);
      }
    }
  };
  const onMinify = () => {
    const src = needValid();
    if (src && tab) {
      try {
        store.updateContent(tab.id, minifyJson(src));
      } catch (e) {
        alert(`Minify hatası: ${(e as Error).message}`);
      }
    }
  };
  const onSort = () => {
    const src = needValid();
    if (src && tab) {
      try {
        store.updateContent(tab.id, sortKeys(src));
      } catch (e) {
        alert(`Sıralama hatası: ${(e as Error).message}`);
      }
    }
  };

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
    const t = store.activeTab();
    if (!t) return;
    const res = await writeFile(t.path, t.name, t.content);
    if (res) store.markSaved(t.id, res.path, res.name);
  };

  return (
    <div className="menubar">
      <button onClick={() => store.newTab()}>+ Yeni</button>
      <button onClick={onOpenFile}>Dosya Aç</button>
      <button onClick={onOpenFolder}>Klasör Aç</button>
      <button onClick={onSave}>Kaydet</button>
      <div className="actions">
        <button onClick={onFormat} disabled={!tab}>Formatla</button>
        <button onClick={onMinify} disabled={!tab}>Minify</button>
        <button onClick={onSort} disabled={!tab}>Key Sırala</button>
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
