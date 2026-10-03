"use client";

import { useEffect, useState } from "react";

function left(target) {
    const diff = new Date(target).getTime() - Date.now();
    if (diff <= 0) return "Time’s up!";
    const d = Math.floor(diff / 864e5);
    const h = Math.floor((diff % 864e5) / 36e5);
    const m = Math.floor((diff % 36e5) / 6e4);
    const s = Math.floor((diff % 6e4) / 1000);
    const ms = Math.floor((diff % 1000) / 10);
    return `${d}d ${h}h ${m}m ${s}s ${String(ms).padStart(2, "0")}ms`;
}

export default function AuthTimer({ target = "2027-02-01T00:00:00", className, style }) {
    const [timeLeft, setTimeLeft] = useState("");
    useEffect(() => {
        const update = () => setTimeLeft(left(target));
        update();
        const id = setInterval(update, 100);
        return () => clearInterval(id);
    }, [target]);
    return (
        <span className={className} style={style}>
            {timeLeft}
        </span>
    );
}
