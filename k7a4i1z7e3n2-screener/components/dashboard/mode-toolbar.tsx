'use client';

import { useCallback, useRef } from 'react';

interface View {
  id: string;
  label: string;
}

interface ModeToolbarProps {
  views: View[];
  selectedModes: Set<string>;
  onToggleMode: (id: string) => void;
}

export function ModeToolbar({ views, selectedModes, onToggleMode }: ModeToolbarProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Arrow-key navigation across tabs
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
      const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      if (!buttons) return;
      let next = -1;
      if (event.key === 'ArrowRight') next = (currentIndex + 1) % buttons.length;
      if (event.key === 'ArrowLeft')  next = (currentIndex - 1 + buttons.length) % buttons.length;
      if (event.key === 'Home')       next = 0;
      if (event.key === 'End')        next = buttons.length - 1;
      if (next >= 0) {
        event.preventDefault();
        buttons[next].focus();
      }
    },
    [],
  );

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label="Chart view modes"
      className="flex max-w-full items-center gap-1.5 overflow-x-auto no-scrollbar rounded-lg p-1"
      style={{
        background: 'var(--surface-subtle)',
        border: '1px solid var(--border-base)',
      }}
    >
      {views.map((view, index) => {
        const isActive = selectedModes.has(view.id);
        return (
          <button
            key={view.id}
            id={`mode-tab-${view.id}`}
            role="tab"
            aria-selected={isActive}
            aria-label={`${view.label} view${isActive ? ' (active)' : ''}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onToggleMode(view.id)}
            onKeyDown={e => handleKeyDown(e, index)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[10.5px] font-medium transition-all duration-150 ${
              isActive
                ? 'bg-white text-indigo-600 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_0_0_1px_rgba(99,102,241,0.2)]'
                : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full transition-all duration-150 ${
                isActive ? 'bg-indigo-500 shadow-[0_0_5px_rgba(99,102,241,0.7)]' : 'bg-slate-300'
              }`}
            />
            {view.label}
          </button>
        );
      })}
    </div>
  );
}
