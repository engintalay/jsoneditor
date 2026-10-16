import type { Tab } from '../types';

/** Dirty sekmeyi kapatmadan önce kullanıcıdan onay alır. true dönerse kapatılabilir. */
export function confirmCloseTab(tab: Tab): boolean {
  if (!tab.dirty) return true;
  return window.confirm(
    `"${tab.name}" kaydedilmedi.\nKaydedilmemiş değişiklikler kaybolacak. Yine de kapatılsın mı?`,
  );
}
