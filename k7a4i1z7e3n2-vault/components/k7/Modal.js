"use client";

import { Dialog } from "radix-ui";
import { X } from "lucide-react";

/**
 * The one dialog shell: blurred backdrop, a card that drops in from above,
 * a bottom sheet on phones. Radix keeps focus inside and Esc closes it.
 * `busy` holds it open while slow work runs: Esc, clicks outside and the close
 * button do nothing, and the page behind dims further. An element marked
 * data-own-escape (a search list, say) gets Esc for itself instead.
 */
export default function Modal({ open, onClose, title, sub, icon, wide, busy, className = "", head = true, foot, children, label }) {
    return (
        <Dialog.Root open={open} onOpenChange={(o) => !o && !busy && onClose?.()}>
            <Dialog.Portal>
                <Dialog.Overlay className={`modal-backdrop${busy ? " is-busy" : ""}`}>
                    <Dialog.Content
                        className={`modal${wide ? " wide" : ""} ${className}`}
                        aria-busy={busy || undefined}
                        onEscapeKeyDown={(e) => {
                            if (busy || (e.target instanceof Element && e.target.closest("[data-own-escape]"))) e.preventDefault();
                        }}
                        onPointerDownOutside={(e) => busy && e.preventDefault()}
                        {...(sub ? {} : { "aria-describedby": undefined })}
                    >
                        {head ? (
                            <div className={`modal-head${icon ? " has-icon" : ""}`}>
                                {icon && <span className="modal-icon">{icon}</span>}
                                <div>
                                    <Dialog.Title className="modal-title">{title}</Dialog.Title>
                                    {sub && <Dialog.Description className="modal-sub">{sub}</Dialog.Description>}
                                </div>
                                <Dialog.Close asChild>
                                    <button type="button" className="btn btn-ghost btn-icon modal-close" aria-label="Close" disabled={busy}>
                                        <X />
                                    </button>
                                </Dialog.Close>
                            </div>
                        ) : (
                            <Dialog.Title className="visually-hidden">{label || title}</Dialog.Title>
                        )}
                        {children}
                        {foot && <div className="modal-foot">{foot}</div>}
                    </Dialog.Content>
                </Dialog.Overlay>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
