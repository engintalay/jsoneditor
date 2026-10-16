import Editor from '@monaco-editor/react';
import { useStore } from '../store/useStore';

export default function EditorPane() {
  const { activeTab, updateContent, newTab } = useStore();
  const tab = activeTab();

  if (!tab) {
    return (
      <div className="editor-wrap">
        <div className="empty">
          <p>Henüz dosya açık değil.</p>
          <button className="primary" onClick={newTab}>
            Yeni JSON oluştur
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-wrap">
      <Editor
        height="100%"
        language="json"
        theme="vs-dark"
        path={tab.id}
        value={tab.content}
        onChange={(v) => updateContent(tab.id, v ?? '')}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          tabSize: 2,
          formatOnPaste: true,
          automaticLayout: true,
          scrollBeyondLastLine: false,
        }}
      />
    </div>
  );
}
