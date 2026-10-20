import { useEffect } from 'react';
import { openFolderAt } from './fs';
import { useStore } from '../store/useStore';

/** acik klasorun icerigini (yeni/silinmis dosyalar) belirli aralikla tazeler */
const REFRESH_MS = 5000;

/** ağaçi verilen klasorden yeniden okur; hata alirsa (klasor tasinmis) sessizce birakir */
export async function refreshWorkspace(root: string): Promise<void> {
  const res = await openFolderAt(root);
  const cur = useStore.getState();
  if (res && cur.workspaceRoot === root) cur.setWorkspace(res.root, res.tree);
}

export function useWorkspaceRefresh(): void {
  const root = useStore((s) => s.workspaceRoot);
  useEffect(() => {
    if (!root) return;
    let busy = false;
    const id = setInterval(() => {
      if (busy) return;
      busy = true;
      refreshWorkspace(root).finally(() => {
        busy = false;
      });
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [root]);
}
