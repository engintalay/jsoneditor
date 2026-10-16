import { parse, printParseErrorCode } from 'jsonc-parser';
import type { JsonError } from '../types';

function offsetToLineCol(text: string, offset: number): { line: number; column: number } {
  let line = 1;
  let col = 1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === '\n') {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return { line, column: col };
}

/** Metni parse eder, bulduğu tüm sözdizimi hatalarını satır/sütun ile döner. */
export function parseErrors(text: string): JsonError[] {
  if (!text.trim()) return [];
  const errors: { error: number; offset: number; length: number }[] = [];
  parse(text, errors as never, { allowTrailingComma: false });
  return errors.map((e) => {
    const start = offsetToLineCol(text, e.offset);
    const end = offsetToLineCol(text, e.offset + e.length);
    return {
      message: printParseErrorCode(e.error),
      line: start.line,
      column: start.column,
      endLine: end.line,
      endColumn: end.column,
    };
  });
}

export function formatJson(text: string, tabSize = 2): string {
  const value = JSON.parse(text);
  return JSON.stringify(value, null, tabSize);
}

export function minifyJson(text: string): string {
  return JSON.stringify(JSON.parse(text));
}

function sortValue(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortValue);
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.keys(v as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortValue((v as Record<string, unknown>)[k])]),
    );
  }
  return v;
}

export function sortKeys(text: string, tabSize = 2): string {
  return JSON.stringify(sortValue(JSON.parse(text)), null, tabSize);
}
