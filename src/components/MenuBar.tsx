import { useStore } from '../store/useStore';

export default function MenuBar() {
  const { newTab, rightPanel, setRightPanel } = useStore();
  return (
    <div className="menubar">
      <button onClick={newTab}>+ Yeni</button>
      <button data-act="open-file">Dosya Aç</button>
      <button data-act="open-folder">Klasör Aç</button>
      <button data-act="save">Kaydet</button>
      <div className="actions">
        <button data-act="format">Formatla</button>
        <button data-act="minify">Minify</button>
        <button data-act="sort">Key Sırala</button>
      </div>
      <div className="actions">
        <button onClick={() => setRightPanel(rightPanel === 'tree' ? null : 'tree')}>
          Ağaç
        </button>
        <button onClick={() => setRightPanel(rightPanel === 'schema' ? null : 'schema')}>
          Schema
        </button>
      </div>
      <span className="title">JSON Editor</span>
    </div>
  );
}
