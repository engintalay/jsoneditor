import { useStore } from '../store/useStore';

export default function Sidebar() {
  const { workspaceRoot, fileTree } = useStore();
  return (
    <div className="sidebar">
      <h3>Explorer</h3>
      <div className="ws-root">{workspaceRoot ?? 'Workspace açık değil'}</div>
      <div className="filetree">
        {fileTree.length === 0 && (
          <div style={{ padding: '0 12px', color: 'var(--text-dim)' }}>
            Klasör açarak workspace başlatın.
          </div>
        )}
      </div>
    </div>
  );
}
