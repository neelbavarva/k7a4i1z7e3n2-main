// Forex trading sessions. Their hours are fixed in UTC; in India time they are
// Asian 5:30am to 2:30pm, London 2:30pm to 9:30pm and New York 5:30pm to 2:30am,
// as the journal has always used them. The trading week follows New York: the
// market shuts Friday 5pm ET and opens again Sunday 5pm ET, and while it is shut
// there is no session to show, so getMarketSession() returns null.

type Session = { name: string; start: number; end: number }; // minutes after midnight UTC

// first match wins, so New York shows while it overlaps London
const SESSIONS: Session[] = [
    { name: "New York session", start: 12 * 60, end: 21 * 60 },
    { name: "London session", start: 9 * 60, end: 16 * 60 },
    { name: "Asian session", start: 0, end: 9 * 60 },
];

const WEEK_OPEN = 17 * 60; // 5:00 pm ET
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const etFormat = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
});

/** Day of the week and minutes after midnight in New York, daylight saving included. */
function etClock(now: Date) {
    const part = (type: string) => etFormat.formatToParts(now).find((p) => p.type === type)?.value || "";
    return { day: DAYS.indexOf(part("weekday")), minutes: Number(part("hour")) * 60 + Number(part("minute")) };
}

function isWeekend(day: number, minutes: number) {
    if (day === 6) return true;
    if (day === 5 && minutes >= WEEK_OPEN) return true;
    if (day === 0 && minutes < WEEK_OPEN) return true;
    return false;
}

function span(mins: number) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h > 0 ? h + "hr " : ""}${m}min`;
}

const inside = (s: Session, m: number) => (s.start < s.end ? m >= s.start && m < s.end : m >= s.start || m < s.end);

export type MarketSession = { name: string; detail: string; active: boolean };

export function getMarketSession(now: Date = new Date()): MarketSession | null {
    const { day, minutes: et } = etClock(now);
    if (isWeekend(day, et)) return null;
    const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();

    for (const s of SESSIONS) {
        if (inside(s, minutes)) {
            const left = s.start < s.end || minutes < s.end ? s.end - minutes : 24 * 60 - minutes + s.end;
            return { name: s.name, detail: `ends in ${span(left)}`, active: true };
        }
    }

    let wait = Infinity;
    let next: Session | null = null;
    for (const s of SESSIONS) {
        const w = minutes <= s.start ? s.start - minutes : 24 * 60 - minutes + s.start;
        if (w < wait) {
            wait = w;
            next = s;
        }
    }
    if (!next) return null;
    return { name: "Between sessions", detail: `${next.name} starts in ${span(wait)}`, active: false };
}
