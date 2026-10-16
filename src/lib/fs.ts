import { open, save } from '@tauri-apps/plugin-dialog';
import { readDir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import type { FileNode } from '../types';

export const isTauri =
  typeof window !== 'undefined' && '__TAURI__' in window;

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

export async function pickFolder(): Promise<{
  root: string;
  tree: FileNode[];
} | null> {
  if (!isTauri) return null;
  const dir = await open({ directory: true, multiple: false });
  if (typeof dir !== 'string' || !dir) return null;
  const tree = await buildTree(dir);
  return { root: dir, tree };
}

export async function pickAndReadFile(): Promise<{
  path: string;
  name: string;
  content: string;
} | null> {
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
  if (!isTauri) throw new Error('Tauri dışında yoldan okuma desteklenmiyor');
  return readTextFile(path);
}
