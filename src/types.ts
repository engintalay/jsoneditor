export interface Tab {
  id: string;
  /** görünen ad (dosya adı ya da "Adsız") */
  name: string;
  /** tam dosya yolu, henüz kaydedilmediyse undefined */
  path?: string;
  content: string;
  dirty: boolean;
  language: 'json';
}

export interface JsonError {
  message: string;
  /** 1-tabanlı */
  line: number;
  /** 1-tabanlı */
  column: number;
  endLine?: number;
  endColumn?: number;
}

export interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileNode[];
}

/** 'system' işletim sistemi tercihini takip eder */
export type ThemeMode = 'dark' | 'light' | 'system';
