"use client";

import { Dialog } from "radix-ui";
import { X } from "lucide-react";

/**
 * The one dialog shell: blurred backdrop, a card that drops in from above,
 * a bottom sheet on phones. Radix keeps focus inside and Esc closes it.
 */
export default function Modal({ open, onClose, title, sub, icon, wide, className = "", head = true, foot, children, label }) {
    return (
        <Dialog.Root open={open} onOpenChange={(o) => !o && onClose?.()}>
            <Dialog.Portal>
                <Dialog.Overlay className="modal-backdrop">
                    <Dialog.Content
                        className={`modal${wide ? " wide" : ""} ${className}`}
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
                                    <button type="button" className="btn btn-ghost btn-icon modal-close" aria-label="Close">
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
