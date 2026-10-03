/** The app mark: a rope with a knot on it, a sibling of the base site's favicon. */
export default function Mark({ className = "mark" }) {
    return (
        <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
            <rect className="mark-rope" x="2" y="15" width="28" height="2" rx="1" />
            <circle className="mark-knot" cx="16" cy="16" r="6" />
        </svg>
    );
}
