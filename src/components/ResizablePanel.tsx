import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  /** localStorage anahtarı (panel başına genişlik kalıcılığı) */
  storageKey: string;
  /** başlangıç genişliği (px) */
  defaultWidth: number;
  min?: number;
  max?: number;
  /** 'left': ayırıcı panelin sağında; 'right': solunda */
  side: 'left' | 'right';
  children: React.ReactNode;
}

/**
 * Sürüklenebilir ayırıcılı yeniden boyutlandırılabilir panel.
 * Genişlik localStorage'da saklanır; çift tıkla başlangıç genişliğine döner.
 */
export default function ResizablePanel({
  storageKey,
  defaultWidth,
  min = 150,
  max = 800,
  side,
  children,
}: Props) {
  const [width, setWidth] = useState(() => {
    const v = Number(localStorage.getItem(storageKey));
    return Number.isFinite(v) && v >= min && v <= max ? v : defaultWidth;
  });
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);
  const widthRef = useRef(width);
  widthRef.current = width;

  const clamp = (w: number) => Math.min(max, Math.max(min, w));

  const onMove = useCallback((e: MouseEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - startX.current;
    const next = clamp(startW.current + (side === 'left' ? dx : -dx));
    setWidth(next);
  }, [side, min, max]);

  const onUp = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    try {
      localStorage.setItem(storageKey, String(widthRef.current));
    } catch {
      /* saklama yoksa yoksay */
    }
  }, [storageKey]);

  useEffect(() => {
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [onMove, onUp]);

  const startDrag = (e: React.MouseEvent) => {
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = widthRef.current;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <>
      {side === 'left' ? (
        <>
          <div className="panel" style={{ width, minWidth: width }}>
            {children}
          </div>
          <div
            className="resizer"
            onMouseDown={startDrag}
            onDoubleClick={() => setWidth(defaultWidth)}
            title="Sürükleyerek genişlet/daralt"
          />
        </>
      ) : (
        <>
          <div
            className="resizer"
            onMouseDown={startDrag}
            onDoubleClick={() => setWidth(defaultWidth)}
            title="Sürükleyerek genişlet/daralt"
          />
          <div className="panel" style={{ width, minWidth: width }}>
            {children}
          </div>
        </>
      )}
    </>
  );
}
