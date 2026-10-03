import { Globe, KeyRound, Landmark, Lock, Mail } from "lucide-react";

// Round monogram for a saved login, in the spirit of the base site's market icons:
// a tinted coin with the first letter in the serif, and the category as a small badge
// overlapping its corner (where a market icon puts its second flag).
// No logos or favicons are fetched: that would tell a third party which accounts exist.

/** Muted tints that sit on the off-white page next to the bull blue and bear red. */
const TINTS = ["#2a78d6", "#d9731c", "#2c8a63", "#7b55b8", "#c8414f", "#14808f", "#a26a00", "#b0477f", "#4f68b0", "#6f8f2e"];

/** The same name always gets the same tint. */
export function tintFor(name = "") {
    let h = 0;
    for (const ch of String(name).toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return TINTS[h % TINTS.length];
}

export const CATEGORY_ICON = { "web-app": Globe, email: Mail, banking: Landmark };

export default function ServiceIcon({ name, category, locked, size = 34 }) {
    const tint = tintFor(name);
    const letter = (String(name).trim().match(/[\p{L}\p{N}]/u)?.[0] || "?").toUpperCase();
    const Badge = locked ? Lock : CATEGORY_ICON[category] || KeyRound;
    return (
        <span className={`svc${locked ? " is-locked" : ""}`} style={{ "--svc": `${size}px`, "--tint": tint }} aria-hidden="true">
            <span className="svc-coin">{letter}</span>
            <span className="svc-badge">
                <Badge />
            </span>
        </span>
    );
}
