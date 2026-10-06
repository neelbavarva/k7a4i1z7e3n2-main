'use client';

import { useLayoutEffect, useRef } from 'react';
import { Check, Plus } from 'lucide-react';

/** The line that starts with "Prompt:", or -1. */
const lineOf = (lines: string[], prompt: string) =>
  lines.findIndex((l) => l.trimStart().toLowerCase().startsWith(`${prompt.toLowerCase()}:`));

/**
 * A notes box that grows with the text. The prompts under it add a heading line ("Setup: ")
 * to structure the note, or jump to it when it's already there. The count shows what's left.
 */
export default function Notes({
  id,
  value,
  onChange,
  placeholder,
  prompts = [],
  max,
  disabled,
  label,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  prompts?: string[];
  max?: number;
  disabled?: boolean;
  label?: string;
}) {
  const box = useRef<HTMLTextAreaElement>(null);

  // grow with the text, up to the max-height in CSS (then it scrolls)
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  const lines = value.split('\n');

  const add = (prompt: string) => {
    const at = lineOf(lines, prompt);
    let caret: number;
    if (at >= 0) {
      caret = lines.slice(0, at + 1).join('\n').length;
    } else {
      const base = value.replace(/\s+$/, '');
      const next = `${base}${base ? '\n' : ''}${prompt}: `;
      if (max && next.length > max) return;
      onChange(next);
      caret = next.length;
    }
    requestAnimationFrame(() => {
      box.current?.focus();
      box.current?.setSelectionRange(caret, caret);
    });
  };

  const near = max ? value.length > max * 0.9 : false;

  return (
    <div className={`notes${disabled ? ' is-disabled' : ''}`}>
      <textarea
        ref={box}
        id={id}
        className="notes-input"
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={max}
        aria-label={label}
        disabled={disabled}
      />
      <div className="notes-foot">
        {prompts.length > 0 && (
          <div className="notes-prompts" role="group" aria-label="Add a heading to the note">
            {prompts.map((p) => {
              const used = lineOf(lines, p) >= 0;
              return (
                <button
                  key={p}
                  type="button"
                  className={`notes-prompt${used ? ' is-used' : ''}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => add(p)}
                  disabled={disabled}
                  title={used ? `Go to “${p}”` : `Add “${p}:”`}
                >
                  {used ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
                  {p}
                </button>
              );
            })}
          </div>
        )}
        {max && value.length > 0 && (
          <span className={`notes-count${near ? ' is-near' : ''}`}>
            {value.length.toLocaleString()} / {max.toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}
