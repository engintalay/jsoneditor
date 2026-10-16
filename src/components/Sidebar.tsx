import { useState } from 'react';
import { readFileByPath } from '../lib/fs';
import { useStore } from '../store/useStore';
import type { FileNode } from '../types';

function Node({ node, depth }: { node: FileNode; depth: number }) {
  const { openFileTab } = useStore();
  const [open, setOpen] = useState(depth < 1);

  if (node.isDir) {
    return (
      <div>
        <button
          className="row dir"
          style={{ paddingLeft: 12 + depth * 12 }}
          onClick={() => setOpen(!open)}
        >
          {open ? '▾' : '▸'} {node.name}
        </button>
        {open &&
          node.children?.map((c) => (
            <Node key={c.path} node={c} depth={depth + 1} />
          ))}
      </div>
    );
  }
  return (
    <button
      className="row"
      style={{ paddingLeft: 12 + depth * 12 }}
      onClick={async () => {
        const content = await readFileByPath(node.path);
        openFileTab(node.path, node.name, content);
      }}
    >
      <span>{node.name}</span>
    </button>
  );
}

export default function Sidebar() {
  const { workspaceRoot, fileTree } = useStore();
  const jsonCount = JSON.stringify(fileTree).split('.json').length - 1;
  return (
    <div className="sidebar">
      <h3>Explorer</h3>
      <div className="ws-root" title={workspaceRoot ?? ''}>
        {workspaceRoot ?? 'Workspace açık değil'}
      </div>
      <div className="filetree">
        {fileTree.length === 0 && (
          <div style={{ padding: '0 12px', color: 'var(--text-dim)' }}>
            Klasör açarak workspace başlatın. {jsonCount > 0 && `(${jsonCount} dosya)`}
          </div>
        )}
        {fileTree.map((n) => (
          <Node key={n.path} node={n} depth={0} />
        ))}
      </div>
    </div>
  );
}
