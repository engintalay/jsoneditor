// Dışarıdan (harici editör / disk) değişen dosyalar için tercih yönetimi.
// Tercih localStorage'da tutulur; 'ask' (varsayılan) veya 'never' (bir daha sorma).
const KEY = 'jsoneditor-external-change-policy';

export type ExternalChangePolicy = 'ask' | 'never';

export function getExternalChangePolicy(): ExternalChangePolicy {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'never') return 'never';
  } catch {
    /* localStorage erişilemez */
  }
  return 'ask';
}

export function setExternalChangePolicy(p: ExternalChangePolicy): void {
  try {
    if (p === 'never') localStorage.setItem(KEY, 'never');
    else localStorage.removeItem(KEY);
  } catch {
    /* yoksay */
  }
}

/** Tercihi sıfırla (Kaydet / Yeniden Yükle sonrası). */
export function clearExternalChangePolicy(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* yoksay */
  }
}