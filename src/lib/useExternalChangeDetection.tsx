import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { clearExternalChangePolicy, getExternalChangePolicy, setExternalChangePolicy } from './externalChange';
import { isServerMode, isTauri, readFileByPath } from './fs';
import { useStore } from '../store/useStore';
import ExternalChangeModal from '../components/ExternalChangeModal';

const POLL_MS = 2000;

interface Pending {
  tab: { id: string; name: string; path: string; dirty: boolean };
  diskContent: string;
}

export function useExternalChangeDetection(): ReactElement | null {
  const tabs = useStore((s) => s.tabs);
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  const lastDiskRef = useRef<Record<string, string>>({});

  // pendingRef'i güncel tut
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useEffect(() => {
    if (!isTauri && !isServerMode()) return;
    if (!tabs.some((t) => t.path)) return;

    let cancelled = false;
    const id = setInterval(async () => {
      if (cancelled) return;
      if (getExternalChangePolicy() === 'never') return;
      if (pendingRef.current) return; // bir prompt açıkken tarama
      const pathTabs = useStore.getState().tabs.filter((t) => t.path);
      if (pathTabs.length === 0) return;
      for (const tab of pathTabs) {
        if (cancelled || pendingRef.current) return;
        const path = tab.path!;
        try {
          const disk = await readFileByPath(path);
          const prev = lastDiskRef.current[tab.id];
          if (prev === undefined) {
            lastDiskRef.current[tab.id] = disk;
          } else if (disk !== prev) {
            lastDiskRef.current[tab.id] = disk;
            const p: Pending = { tab: { id: tab.id, name: tab.name, path, dirty: tab.dirty }, diskContent: disk };
            pendingRef.current = p;
            setPending(p);
            return;
          }
        } catch {
          /* dosya okunamadıysa yoksay */
        }
      }
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs.map((t) => t.id).join(','), tabs.map((t) => t.path).join(',')]);

  const handleReload = () => {
    if (!pending) return;
    useStore.getState().reloadExternal(pending.tab.id, pending.diskContent);
    clearExternalChangePolicy();
    setPending(null);
  };

  const handleKeep = () => {
    if (pending) lastDiskRef.current[pending.tab.id] = pending.diskContent;
    setPending(null);
  };

  const handleNever = () => {
    setExternalChangePolicy('never');
    if (pending) lastDiskRef.current[pending.tab.id] = pending.diskContent;
    setPending(null);
  };

  if (!pending) return null;
  return (
    <ExternalChangeModal
      tab={pending.tab}
      onReload={handleReload}
      onKeep={handleKeep}
      onNever={handleNever}
    />
  );
}