function isMarketClosed(): boolean {
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentMinutes = hours * 60 + minutes;
    const marketOpenTime = 17 * 60; // 5:00 PM ET (17:00)

    // Market is closed on Saturday (all day)
    if (day === 6) return true;
    
    // Market is closed on Friday after 5:00 PM ET
    if (day === 5 && currentMinutes >= marketOpenTime) return true;
    
    // Market is closed on Sunday before 5:00 PM ET
    if (day === 0 && currentMinutes < marketOpenTime) return true;
    
    return false;
}

export function getCurrentSession(marketPointer?: any): string {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentMinutes = hours * 60 + minutes;

    if (marketPointer != null && marketPointer.currencies?.fx === "closed") {
        return "Market is Closed";
    }

    if (isMarketClosed()) {
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
    const day = now.getDay();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentMinutes = hours * 60 + minutes;

    if (marketPointer != null && marketPointer.currencies?.fx === "closed") {
        return "Analyze and mark you Zones";
    }

    if (isMarketClosed()) {
        // Calculate time until market opens (Sunday 5:00 PM ET)
        const marketOpenTime = 17 * 60; // 5:00 PM
        let minutesUntilOpen: number;

        if (day === 6) {
            // Saturday: calculate to Sunday 5:00 PM
            minutesUntilOpen = (24 * 60 - currentMinutes) + marketOpenTime;
        } else if (day === 5 && currentMinutes >= marketOpenTime) {
            // Friday after 5:00 PM: calculate to Sunday 5:00 PM
            const minutesUntilMidnight = 24 * 60 - currentMinutes;
            const saturdayMinutes = 24 * 60; // All of Saturday
            minutesUntilOpen = minutesUntilMidnight + saturdayMinutes + marketOpenTime;
        } else if (day === 0 && currentMinutes < marketOpenTime) {
            // Sunday before 5:00 PM
            minutesUntilOpen = marketOpenTime - currentMinutes;
        } else {
            minutesUntilOpen = 0;
        }

        const h = Math.floor(minutesUntilOpen / 60);
        const m = minutesUntilOpen % 60;
        return `Market will open in ${h}hrs ${m}min`;
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
