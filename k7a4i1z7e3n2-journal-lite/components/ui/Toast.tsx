'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, X } from 'lucide-react';

type Toast = { id: number; kind: 'success' | 'error'; title: string; desc?: string };
type Push = (kind: Toast['kind'], title: string, desc?: string) => void;

const Ctx = createContext<Push>(() => {});

export const useToast = () => useContext(Ctx);

/** Quiet confirmations in the corner; errors stay a little longer. */
export function Toaster({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setList((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback<Push>(
    (kind, title, desc) => {
      const id = ++seq.current;
      setList((l) => [...l.slice(-3), { id, kind, title, desc }]);
      setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 3800);
    },
    [dismiss],
  );
  const value = useMemo(() => push, [push]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite" role="status">
        {list.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            <span data-icon aria-hidden="true">
              {t.kind === 'success' ? <Check /> : <X />}
            </span>
            <div className="toast-text">
              <div className="toast-title">{t.title}</div>
              {t.desc && <div className="toast-desc">{t.desc}</div>}
            </div>
            <button type="button" className="toast-x" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
              <X />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
