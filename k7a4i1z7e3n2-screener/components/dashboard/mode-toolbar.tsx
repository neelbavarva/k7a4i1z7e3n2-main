'use client';

import { useCallback, useRef } from 'react';

interface View {
  id: string;
  label: string;
}

/** View switcher as an FX segmented control. Several views can be layered at once. */
export function ModeToolbar({ views, selectedModes, onToggleMode }: { views: View[]; selectedModes: Set<string>; onToggleMode: (id: string) => void }) {
  const listRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('button');
    if (!buttons) return;
    let next = -1;
    if (event.key === 'ArrowRight') next = (currentIndex + 1) % buttons.length;
    if (event.key === 'ArrowLeft') next = (currentIndex - 1 + buttons.length) % buttons.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = buttons.length - 1;
    if (next >= 0) {
      event.preventDefault();
      buttons[next].focus();
    }
  }, []);

  return (
    <div ref={listRef} className="seg seg-wrap" role="group" aria-label="Chart views (several can be combined)">
      {views.map((view, index) => {
        const on = selectedModes.has(view.id);
        return (
          <button key={view.id} type="button" aria-pressed={on} onClick={() => onToggleMode(view.id)} onKeyDown={e => handleKeyDown(e, index)}>
            <span className="seg-dot" aria-hidden="true" />
            {view.label}
          </button>
        );
      })}
    </div>
  );
}
