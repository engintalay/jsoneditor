import Editor, { type OnMount } from '@monaco-editor/react';
import { useEffect, useRef } from 'react';
import { parseErrors } from '../lib/jsonUtils';
import { useStore } from '../store/useStore';
import type { editor } from 'monaco-editor';

export default function EditorPane() {
  const { activeTab, updateContent, newTab, setErrors, jump } = useStore();
  const tab = activeTab();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);

  // canlı doğrulama (debounce)
  useEffect(() => {
    if (!tab) return;
    const t = setTimeout(() => setErrors(parseErrors(tab.content)), 250);
    return () => clearTimeout(t);
  }, [tab?.content, tab?.id, setErrors]);

  // hata marker'ları
  useEffect(() => {
    const ed = editorRef.current;
    const monaco = monacoRef.current;
    if (!ed || !monaco || !tab) return;
    const model = ed.getModel();
    if (!model) return;
    const errs = parseErrors(tab.content);
    monaco.editor.setModelMarkers(model, 'json', errs.map((e) => ({
      startLineNumber: e.line,
      startColumn: e.column,
      endLineNumber: e.endLine ?? e.line,
      endColumn: (e.endColumn ?? e.column) + 1,
      message: e.message,
      severity: monaco.MarkerSeverity.Error,
    })));
  }, [tab?.content, tab?.id]);

  // hataya tıkla -> git
  useEffect(() => {
    if (!jump || !editorRef.current) return;
    editorRef.current.setPosition({ lineNumber: jump.line, column: jump.column });
    editorRef.current.revealLineInCenter(jump.line);
    editorRef.current.focus();
  }, [jump]);

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

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
  };

  return (
    <div className="editor-wrap">
      <Editor
        height="100%"
        language="json"
        theme="vs-dark"
        path={tab.id}
        value={tab.content}
        onMount={onMount}
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
