'use client';

import { useEffect, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { toPending, type Pending } from '@/lib/images';
import { IMAGES_PER_UPLOAD, NAME_MAX } from '@/lib/validate';

/**
 * Pick, drop or paste up to five screenshots. Pasting works anywhere in the open dialog.
 * The parent owns the list so it can upload it when it's ready.
 */
export default function Dropzone({
  items,
  onChange,
  disabled,
  onProblem,
}: {
  items: Pending[];
  onChange: (next: Pending[]) => void;
  disabled?: boolean;
  onProblem?: (msg: string | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const add = (files: File[]) => {
    if (disabled || !files.length) return;
    const { items: next, problems } = toPending(files, itemsRef.current.length);
    onProblem?.(problems[0] || null);
    if (next.length) onChange([...itemsRef.current, ...next]);
  };
  const addRef = useRef(add);
  addRef.current = add;

  // paste screenshots straight from the clipboard while the dialog is open
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files || [])];
      if (!files.length) return;
      const t = e.target;
      if (t instanceof HTMLElement && /^(INPUT|TEXTAREA)$/.test(t.tagName) && !files.some((f) => f.type.startsWith('image/'))) return;
      e.preventDefault();
      addRef.current(files);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, []);

  // previews are object URLs: free them when they leave the list
  useEffect(() => {
    return () => itemsRef.current.forEach((p) => URL.revokeObjectURL(p.preview));
  }, []);

  const remove = (id: string) => {
    const gone = items.find((p) => p.id === id);
    if (gone) URL.revokeObjectURL(gone.preview);
    onChange(items.filter((p) => p.id !== id));
  };
  const rename = (id: string, name: string) => onChange(items.map((p) => (p.id === id ? { ...p, name: name.slice(0, NAME_MAX) } : p)));

  const full = items.length >= IMAGES_PER_UPLOAD;

  return (
    <div className="dropzone-wrap">
      {!full && (
        <button
          type="button"
          className={`dropzone${over ? ' is-over' : ''}`}
          disabled={disabled}
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            add([...e.dataTransfer.files]);
          }}
        >
          <ImagePlus aria-hidden="true" />
          <span>
            <b>Drop, paste or choose screenshots</b>
            <span className="muted">
              Up to {IMAGES_PER_UPLOAD - items.length} more · images only · 10 MB each
            </span>
          </span>
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          add([...(e.target.files || [])]);
          e.target.value = '';
        }}
      />
      {items.length > 0 && (
        <ul className="pending">
          {items.map((p) => (
            <li key={p.id} className="pending-item fade-in">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.preview} alt="" />
              <input
                className="input input-sm"
                value={p.name}
                onChange={(e) => rename(p.id, e.target.value)}
                aria-label="Screenshot name"
                disabled={disabled}
                maxLength={NAME_MAX}
              />
              <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => remove(p.id)} aria-label={`Remove ${p.name}`} disabled={disabled}>
                <X />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
