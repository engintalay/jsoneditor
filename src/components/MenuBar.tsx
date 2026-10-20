import { formatJson, minifyJson, parseErrors, sortKeys } from '../lib/jsonUtils';
import {
  getServerUrl,
  isServerMode,
  isTauri,
  openServerFolder,
  pickAndReadFile,
  pickFolder,
  pingServer,
  setServerUrl,
  writeFile,
} from '../lib/fs';
import { useStore } from '../store/useStore';

export default function MenuBar() {
  const store = useStore();
  const tab = store.activeTab();
  const serverMode = isServerMode();

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
    if (isTauri) {
      const res = await pickFolder();
      if (res) store.setWorkspace(res.root, res.tree);
      return;
    }
    // Web: sunucu bagliysa kok klasor yolunu sor
    if (!isServerMode()) {
      alert('Klasör açmak için önce bir dosya sunucusuna bağlanın.');
      return;
    }
    const root = prompt('Sunucudaki klasör yolu (örn. /data/json veya /):', '/');
    if (root === null) return;
    const res = await openServerFolder(root.trim() || '/');
    if (res) store.setWorkspace(res.root, res.tree);
    else alert('Sunucudaki klasör açılamadı.');
  };

  const onConnectServer = async () => {
    const cur = getServerUrl() ?? '';
    const url = prompt(
      'Dosya sunucusu adresi (boş bırakıp onaylarsanız bağlantı kaldırılır):',
      cur || 'http://10.251.74.186:1422',
    );
    if (url === null) return;
    const trimmed = url.trim();
    if (!trimmed) {
      setServerUrl(null);
      alert('Sunucu bağlantısı kaldırıldı. Sayfa yenileniyor...');
      location.reload();
      return;
    }
    if (!(await pingServer(trimmed))) {
      alert('Sunucuya ulaşılamadı. Adresi ve ağ erişimini kontrol edin.');
      return;
    }
    setServerUrl(trimmed);
    alert('Sunucu bağlandı. Sayfa yenileniyor...');
    location.reload();
  };

  const themeLabel =
    store.theme === 'system' ? 'Sistem' : store.theme === 'dark' ? 'Koyu' : 'Açık';
  const onCycleTheme = () =>
    store.setTheme(
      store.theme === 'system' ? 'dark' : store.theme === 'dark' ? 'light' : 'system',
    );

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
        <button onClick={onCycleTheme} title="Tema değiştir: Sistem → Koyu → Açık">
          Tema: {themeLabel}
        </button>
        {!isTauri && (
          <button
            onClick={onConnectServer}
            title={serverMode ? `Sunucu: ${getServerUrl()}` : 'Dosya sunucusuna bağlan'}
            style={serverMode ? { color: 'var(--ok)' } : undefined}
          >
            Sunucu: {serverMode ? 'bağlı' : 'yok'}
          </button>
        )}
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
