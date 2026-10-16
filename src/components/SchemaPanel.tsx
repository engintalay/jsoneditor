import Ajv from 'ajv';
import { useEffect } from 'react';
import { useStore } from '../store/useStore';

const ajv = new Ajv({ allErrors: true, strict: false });

export default function SchemaPanel() {
  const { schemaText, setSchemaText, activeTab, setSchemaErrors } = useStore();
  const tab = activeTab();

  useEffect(() => {
    if (!tab || !schemaText.trim()) {
      setSchemaErrors([]);
      return;
    }
    const t = setTimeout(() => {
      try {
        const schema = JSON.parse(schemaText);
        const data = JSON.parse(tab.content);
        const validate = ajv.compile(schema);
        const ok = validate(data);
        if (ok) {
          setSchemaErrors([]);
        } else {
          setSchemaErrors(
            (validate.errors ?? []).map((e) => ({
              message: `${e.instancePath || '/'} ${e.message}`,
              line: 1,
              column: 1,
            })),
          );
        }
      } catch (e) {
        setSchemaErrors([
          { message: `Schema/JSON hatası: ${(e as Error).message}`, line: 1, column: 1 },
        ]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [schemaText, tab?.content, tab?.id, setSchemaErrors]);

  return (
    <div className="right-panel">
      <h3>JSON Schema</h3>
      <div className="schema-box">
        <textarea
          placeholder='Örn: {"type":"object","properties":{"ad":{"type":"string"}},"required":["ad"]}'
          value={schemaText}
          onChange={(e) => setSchemaText(e.target.value)}
        />
        <button onClick={() => setSchemaText('')}>Temizle</button>
      </div>
    </div>
  );
}
