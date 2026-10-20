import { confirmCloseTab } from '../lib/confirm';
import { useStore } from '../store/useStore';

export default function TabBar() {
  const { tabs, activeId, setActive, closeTab } = useStore();
  if (tabs.length === 0) return null;
  return (
    <div className="tabbar">
      {tabs.map((t) => (
        <div
          key={t.id}
          className={`tab ${t.id === activeId ? 'active' : ''}`}
          onClick={() => setActive(t.id)}
        >
          <span className="tab-label" title={t.name}>
            {t.dirty && <span className="dirty">● </span>}
            {t.name}
          </span>
          <span
            className="close"
            onClick={(e) => {
              e.stopPropagation();
              if (confirmCloseTab(t)) closeTab(t.id);
            }}
          >
            ×
          </span>
        </div>
      ))}
    </div>
  );
}
