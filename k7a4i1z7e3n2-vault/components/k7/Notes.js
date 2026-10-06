"use client";

import { useLayoutEffect, useRef } from "react";
import { Check, Plus } from "lucide-react";

/** The line that starts with "Prompt:", or -1. */
const lineOf = (lines, prompt) => lines.findIndex((l) => l.trimStart().toLowerCase().startsWith(`${prompt.toLowerCase()}:`));

const wordsIn = (text) => (text.trim() ? text.trim().split(/\s+/).length : 0);

/**
 * A notes box that grows with the text. The prompts under it add a heading line ("Setup: ")
 * to structure the note, or jump to it when it's already there.
 */
export default function Notes({ id, value, onChange, placeholder, prompts = [], label }) {
    const box = useRef(null);

    // grow with the text, up to the max-height in CSS (then it scrolls)
    useLayoutEffect(() => {
        const el = box.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
    }, [value]);

    const lines = value.split("\n");
    const words = wordsIn(value);

    const add = (prompt) => {
        const at = lineOf(lines, prompt);
        let caret;
        if (at >= 0) {
            caret = lines.slice(0, at + 1).join("\n").length;
        } else {
            const base = value.replace(/\s+$/, "");
            const next = `${base}${base ? "\n" : ""}${prompt}: `;
            onChange(next);
            caret = next.length;
        }
        requestAnimationFrame(() => {
            box.current?.focus();
            box.current?.setSelectionRange(caret, caret);
        });
    };

    return (
        <div className="notes">
            <textarea ref={box} id={id} className="notes-input" rows={3} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} />
            <div className="notes-foot">
                {prompts.length > 0 && (
                    <div className="notes-prompts" role="group" aria-label="Add a heading to the note">
                        {prompts.map((p) => {
                            const used = lineOf(lines, p) >= 0;
                            return (
                                <button
                                    key={p}
                                    type="button"
                                    className={`notes-prompt${used ? " is-used" : ""}`}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => add(p)}
                                    title={used ? `Go to “${p}”` : `Add “${p}:”`}
                                >
                                    {used ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
                                    {p}
                                </button>
                            );
                        })}
                    </div>
                )}
                {words > 0 && (
                    <span className="notes-count">
                        {words} {words === 1 ? "word" : "words"}
                    </span>
                )}
            </div>
        </div>
    );
}
