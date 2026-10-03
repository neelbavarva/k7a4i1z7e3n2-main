"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/** A password-style input with a show / hide eye inside it. */
export default function SecretInput({ id, value, onChange, placeholder, mono, autoFocus }) {
    const [shown, setShown] = useState(false);
    return (
        <div className="input-wrap">
            <input
                id={id}
                className={`input${mono && shown ? " mono" : ""}`}
                type={shown ? "text" : "password"}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                autoComplete="off"
                spellCheck="false"
                autoFocus={autoFocus}
            />
            <button
                type="button"
                className="input-eye"
                onClick={() => setShown((s) => !s)}
                aria-label={shown ? "Hide" : "Show"}
                aria-pressed={shown}
                title={shown ? "Hide" : "Show"}
            >
                {shown ? <EyeOff /> : <Eye />}
            </button>
        </div>
    );
}
