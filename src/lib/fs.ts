import { open, save } from '@tauri-apps/plugin-dialog';
import { readDir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import type { FileNode } from '../types';

// Tauri v2'de window.__TAURI__ yalnizca withGlobalTauri acikken enjekte
// edilir; IPC'nin her zaman var olan global'i __TAURI_INTERNALS__'dir.
export const isTauri =
  typeof window !== 'undefined' &&
  ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

// --- Uzak fs sunucusu (web modu) ---------------------------------------
// Web tarayicisindan sabit bir sunucudaki klasore erisim icin Tauri
// tarafindaki HTTP dosya sunucusuna baglanilir. Adres localStorage'da
// tutulur; kullanici MenuBar'dan ayarlar.
const SRV_KEY = 'jsoneditor-fs-server';

export function getServerUrl(): string | null {
  try {
    const v = localStorage.getItem(SRV_KEY);
    return v && v.trim() ? v.replace(/\/+$/, '') : null;
  } catch {
    return null;
  }
}

export function setServerUrl(url: string | null): void {
  try {
    if (url) localStorage.setItem(SRV_KEY, url.replace(/\/+$/, ''));
    else localStorage.removeItem(SRV_KEY);
  } catch {
    /* saklama yoksa yoksay */
  }
}

export const isServerMode = (): boolean => !isTauri && !!getServerUrl();

async function srv(route: string, path: string, init?: RequestInit): Promise<Response> {
  const base = getServerUrl();
  if (!base) throw new Error('Sunucu adresi ayarlanmadı');
  const res = await fetch(`${base}${route}?path=${encodeURIComponent(path)}`, init);
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`${res.status}: ${msg || res.statusText}`);
  }
  return res;
}

async function buildServerTree(rel: string, depth = 0): Promise<FileNode[]> {
  if (depth > 6) return [];
  const res = await srv('/fs/list', rel);
  const { entries } = (await res.json()) as {
    entries: { name: string; path: string; isDir: boolean }[];
  };
  const nodes: FileNode[] = [];
  const sorted = [...entries].sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const e of sorted) {
    const full = rel === '/' ? `/${e.name}` : `${rel.replace(/\/$/, '')}/${e.name}`;
    if (e.isDir) {
      nodes.push({ name: e.name, path: full, isDir: true, children: await buildServerTree(full, depth + 1) });
    } else if (/\.jsonc?$|\.txt$/i.test(e.name)) {
      nodes.push({ name: e.name, path: full, isDir: false });
    }
  }
  return nodes;
}

/** Sunucudaki kok klasoru (verilen yol) tarayip agac dondurur. */
export async function openServerFolder(root: string): Promise<{
  root: string;
  tree: FileNode[];
} | null> {
  try {
    const tree = await buildServerTree(root);
    return { root, tree };
  } catch {
    return null;
  }
}

/** Sunucu ile baglanti testi. */
export async function pingServer(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url.replace(/\/+$/, '')}/fs/health`, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

async function buildTree(dir: string, depth = 0): Promise<FileNode[]> {
  if (depth > 6) return [];
  const entries = await readDir(dir);
  const nodes: FileNode[] = [];
  const sorted = [...entries].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name!.localeCompare(b.name!);
  });
  for (const e of sorted) {
    if (!e.name || e.name.startsWith('.')) continue;
    const path = `${dir}/${e.name}`;
    if (e.isDirectory) {
      nodes.push({
        name: e.name,
        path,
        isDir: true,
        children: await buildTree(path, depth + 1),
      });
    } else if (/\.jsonc?$|\.txt$/i.test(e.name)) {
      nodes.push({ name: e.name, path, isDir: false });
    }
  }
  return nodes;
}

export async function openFolderAt(dir: string): Promise<{
  root: string;
  tree: FileNode[];
} | null> {
  if (!isTauri) {
    if (isServerMode()) return openServerFolder(dir);
    return null;
  }
  try {
    const tree = await buildTree(dir);
    return { root: dir, tree };
  } catch {
    return null;
  }
}

export async function pickFolder(): Promise<{
  root: string;
  tree: FileNode[];
} | null> {
  if (!isTauri) return null;
  const dir = await open({ directory: true, multiple: false });
  if (typeof dir !== 'string' || !dir) return null;
  return openFolderAt(dir);
}

export async function pickAndReadFile(): Promise<{
  path: string;
  name: string;
  content: string;
} | null> {
  if (isServerMode()) {
    const p = prompt('Sunucudaki dosya yolu (örn. /data/json/a.json):', '/');
    if (p === null) return null;
    const path = p.trim();
    if (!path) return null;
    const content = await readFileByPath(path);
    return { path, name: path.split('/').pop() ?? path, content };
  }
  if (isTauri) {
    const file = await open({
      multiple: false,
      filters: [{ name: 'JSON', extensions: ['json', 'jsonc', 'txt'] }],
    });
    if (typeof file !== 'string' || !file) return null;
    const content = await readTextFile(file);
    const name = file.split('/').pop() ?? file;
    return { path: file, name, content };
  }
  // tarayıcı fallback
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.jsonc,.txt,application/json';
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      const r = new FileReader();
      r.onload = () =>
        resolve({ path: f.name, name: f.name, content: String(r.result ?? '') });
      r.readAsText(f);
    };
    input.click();
  });
}

export async function writeFile(
  currentPath: string | undefined,
  suggestedName: string,
  content: string,
): Promise<{ path: string; name: string } | null> {
  if (isServerMode()) {
    const targetPath = currentPath ?? `/${suggestedName}`;
    await srv('/fs/write', targetPath, { method: 'POST', body: content });
    return { path: targetPath, name: targetPath.split('/').pop() ?? suggestedName };
  }
  if (isTauri) {
    let target = currentPath;
    if (!target) {
      const picked = await save({
        defaultPath: suggestedName,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (!picked) return null;
      target = picked;
    }
    await writeTextFile(target, content);
    const name = target.split('/').pop() ?? target;
    return { path: target, name };
  }
  const blob = new Blob([content], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = suggestedName;
  a.click();
  URL.revokeObjectURL(a.href);
  return { path: suggestedName, name: suggestedName };
}

export async function readFileByPath(path: string): Promise<string> {
  if (isServerMode()) return (await srv('/fs/read', path)).text();
  if (!isTauri) throw new Error('Tauri dışında yoldan okuma desteklenmiyor');
  return readTextFile(path);
}
