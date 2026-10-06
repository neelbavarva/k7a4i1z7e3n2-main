'use client';

import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  wide?: boolean;
  busy?: boolean;
  className?: string;
  label?: string;
  head?: boolean;
  foot?: ReactNode;
  children?: ReactNode;
};

/**
 * The one dialog shell: a native <dialog> in the top layer (focus stays inside, Esc closes),
 * a card that drops in from above, a bottom sheet on phones. `busy` holds it open while
 * slow work runs. An element marked data-own-escape keeps Esc for itself.
 */
export default function Modal(props: Props) {
  if (!props.open) return null;
  return <Dialog {...props} />;
}

function Dialog({ onClose, title, sub, icon, wide, busy, className = '', label, head = true, foot, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const downOnBackdrop = useRef(false);
  const busyRef = useRef(busy);
  busyRef.current = busy;

  const returnFocus = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const d = ref.current;
    if (d && !d.open) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      d.showModal();
      // showModal focuses the first control (the close button); prefer the one marked for it
      d.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }
    // No close() here: a dialog leaves the top layer when it leaves the page, and closing and
    // reopening on an effect re-run would put it above dialogs opened from inside it.
    return () => {
      setTimeout(() => {
        if (d && !d.isConnected && returnFocus.current?.isConnected) returnFocus.current.focus();
      });
    };
  }, []);

  // Keep the page behind still. Switching the page's own scrolling off would repaint all of it on
  // every open and close (a blink inside the split view), so instead a wheel or swipe that nothing
  // in the dialog can scroll any further is stopped here, before it reaches the page.
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const canScroll = (from: EventTarget | null, dy: number) => {
      for (let el = from instanceof Element ? from : null; el; el = el.parentElement) {
        const oy = getComputedStyle(el).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1) {
          if (dy < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true;
        }
        if (el === d) break;
      }
      return false;
    };
    // over the dimmed backdrop the event comes from the dialog itself, but nothing there scrolls
    const onBackdrop = (x: number, y: number) => {
      const r = d.getBoundingClientRect();
      return x < r.left || x > r.right || y < r.top || y > r.bottom;
    };
    const mine = (t: EventTarget | null) => t instanceof Node && d.contains(t);
    const onWheel = (e: WheelEvent) => {
      if (!mine(e.target)) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // sideways: strips and switches scroll themselves
      if ((e.target === d && onBackdrop(e.clientX, e.clientY)) || !canScroll(e.target, e.deltaY)) e.preventDefault();
    };
    let lastY = 0;
    const onTouchStart = (e: TouchEvent) => {
      lastY = e.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!mine(e.target)) return;
      const y = e.touches[0]?.clientY ?? lastY;
      const dy = lastY - y;
      lastY = y;
      const t = e.touches[0];
      if (dy && ((e.target === d && t && onBackdrop(t.clientX, t.clientY)) || !canScroll(e.target, dy))) e.preventDefault();
    };
    // on the window, not the dialog: the browser only lets a listener stop scrolling where it
    // listens, and the backdrop lies outside the dialog's box
    addEventListener('wheel', onWheel, { passive: false });
    addEventListener('touchstart', onTouchStart, { passive: true });
    addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      removeEventListener('wheel', onWheel);
      removeEventListener('touchstart', onTouchStart);
      removeEventListener('touchmove', onTouchMove);
    };
  }, []);

  const close = () => {
    if (!busyRef.current) onClose();
  };

  return (
    <dialog
      ref={ref}
      className={`modal${wide ? ' wide' : ''} ${className}`}
      aria-busy={busy || undefined}
      aria-label={head ? undefined : label}
      onCancel={(e) => {
        // React passes a nested dialog's cancel up the component tree; only answer our own
        if (e.target !== e.currentTarget) return;
        e.preventDefault();
        if (document.activeElement?.closest('[data-own-escape]')) return;
        close();
      }}
      onMouseDown={(e) => {
        downOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && downOnBackdrop.current) close();
      }}
    >
      <div className="modal-in">
        {head && (
          <div className={`modal-head${icon ? ' has-icon' : ''}`}>
            {icon && <span className="modal-icon">{icon}</span>}
            <div>
              <h2 className="modal-title">{title}</h2>
              {sub && <div className="modal-sub">{sub}</div>}
            </div>
            <button type="button" className="btn btn-ghost btn-icon modal-close" aria-label="Close" onClick={close} disabled={busy}>
              <X />
            </button>
          </div>
        )}
        {children}
        {foot && <div className="modal-foot">{foot}</div>}
      </div>
    </dialog>
  );
}
