import { useEffect } from 'react';
import { useStore } from '../store/useStore';

/**
 * tema tercihini <html> uzerine uygular; 'system' seciliyken isletim
 * sistemi renk semasini canli olarak takip eder ve tercihi kalici saklar.
 */
export function useTheme() {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');

    const apply = () => {
      const { theme } = useStore.getState();
      const resolved =
        theme === 'system' ? (mq.matches ? 'dark' : 'light') : theme;
      const root = document.documentElement;
      root.dataset.theme = resolved;
      root.style.colorScheme = resolved;
      useStore.setState({ resolvedTheme: resolved });
      try {
        localStorage.setItem('jsoneditor-theme', theme);
      } catch {
        /* kalici saklama yoksa sessizce devam */
      }
    };

    apply();
    mq.addEventListener('change', apply);
    const unsub = useStore.subscribe((s, prev) => {
      if (s.theme !== prev.theme) apply();
    });
    return () => {
      mq.removeEventListener('change', apply);
      unsub();
    };
  }, []);
}
