"use client";

import { useRef } from "react";
import { Ellipsis } from "lucide-react";
import { DropdownMenu } from "radix-ui";

/**
 * An account's few actions behind one "more" button, so they don't sit apart on a line of their
 * own. What's picked runs once the menu has closed: a dialog opened while the menu still hands
 * focus back to its button would close straight away.
 * items: { label, hint, icon, run, disabled, danger }, or "-" for a line between.
 */
export default function MoreMenu({ label, items }) {
    const next = useRef(null);
    return (
        <DropdownMenu.Root modal={false}>
            <DropdownMenu.Trigger asChild>
                <button type="button" className="nw-more" aria-label={label} title="More">
                    <Ellipsis aria-hidden="true" />
                </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    className="menu"
                    align="end"
                    sideOffset={6}
                    collisionPadding={16}
                    onCloseAutoFocus={(e) => {
                        const fn = next.current;
                        if (!fn) return;
                        next.current = null;
                        e.preventDefault();
                        fn();
                    }}
                >
                    {items.map((it, i) =>
                        it === "-" ? (
                            <DropdownMenu.Separator key={i} className="menu-sep" />
                        ) : (
                            <DropdownMenu.Item
                                key={it.label}
                                className={`menu-item${it.danger ? " is-danger" : ""}`}
                                disabled={it.disabled}
                                onSelect={() => {
                                    next.current = it.run;
                                }}
                            >
                                <it.icon aria-hidden="true" />
                                <span>
                                    {it.label}
                                    {it.hint && <small>{it.hint}</small>}
                                </span>
                            </DropdownMenu.Item>
                        )
                    )}
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    );
}
