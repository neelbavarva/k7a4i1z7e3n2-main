export function getCurrentSession(marketPointer?: any): string {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentMinutes = hours * 60 + minutes;

    if (marketPointer != null && marketPointer.currencies?.fx === "closed") {
        return "Market is Closed";
    }

    const sessions = [
        { name: "New York Session", start: 17 * 60 + 30, end: 2 * 60 + 30 },
        { name: "London Session", start: 14 * 60 + 30, end: 21 * 60 + 30 },
        { name: "Asian Session", start: 5 * 60 + 30, end: 14 * 60 + 30 },
    ];

    for (let session of sessions) {
        if (session.start < session.end) {
            if (
                currentMinutes >= session.start &&
                currentMinutes < session.end
            ) {
                return session.name;
            }
        } else {
            if (
                currentMinutes >= session.start ||
                currentMinutes < session.end
            ) {
                return session.name;
            }
        }
    }

    return "No Active Sessions";
}

export function getSessionTiming(marketPointer?: any): string {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentMinutes = hours * 60 + minutes;

    if (marketPointer != null && marketPointer.currencies?.fx === "closed") {
        return "Analyze and mark you Zones";
    }

    const sessions = [
        { name: "New York Session", start: 17 * 60 + 30, end: 2 * 60 + 30 },
        { name: "London Session", start: 14 * 60 + 30, end: 21 * 60 + 30 },
        { name: "Asian Session", start: 5 * 60 + 30, end: 14 * 60 + 30 },
    ];

    function formatTime(minutes: number) {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${h > 0 ? h + "hr " : ""}${m}min`;
    }

    for (let session of sessions) {
        if (session.start < session.end) {
            if (
                currentMinutes >= session.start &&
                currentMinutes < session.end
            ) {
                const remaining = session.end - currentMinutes;
                return `This session ends in ${formatTime(remaining)}`;
            }
        } else {
            if (
                currentMinutes >= session.start ||
                currentMinutes < session.end
            ) {
                const remaining =
                    currentMinutes >= session.start
                        ? 24 * 60 - currentMinutes + session.end
                        : session.end - currentMinutes;
                return `This session ends in ${formatTime(remaining)}`;
            }
        }
    }

    let minWait = Infinity;
    let nextSession: { name: string; start: number } | null = null;
    for (let session of sessions) {
        let waitTime: number;
        if (currentMinutes <= session.start) {
            waitTime = session.start - currentMinutes;
        } else {
            waitTime = 24 * 60 - currentMinutes + session.start;
        }
        if (waitTime < minWait) {
            minWait = waitTime;
            nextSession = session;
        }
    }
    if (!nextSession) return "No Active Sessions";
    return `${nextSession.name} starts in ${formatTime(minWait)}`;
}
