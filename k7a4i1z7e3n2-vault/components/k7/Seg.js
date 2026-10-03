"use client";

/** Segmented control, same as the base site's asset-class switch. */
export default function Seg({ options, value, onChange, label, wide, className = "" }) {
    return (
        <div className={`seg${wide ? " seg-wide" : ""} ${className}`} role="group" aria-label={label}>
            {options.map((o) => {
                const opt = typeof o === "string" ? { value: o, label: o } : o;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        aria-pressed={value === opt.value}
                        onClick={() => onChange(opt.value)}
                        title={opt.title}
                    >
                        {opt.icon}
                        {opt.label}
                        {opt.count != null && <span className="seg-count">{opt.count}</span>}
                    </button>
                );
            })}
        </div>
    );
}
