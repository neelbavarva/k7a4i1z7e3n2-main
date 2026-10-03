// Forex trading sessions, in New York time (ET).
// While the market is shut (Friday 5pm ET to Sunday 5pm ET) there is no
// session to show, so getMarketSession() returns null and the UI shows nothing.

type Session = { name: string; start: number; end: number };

const SESSIONS: Session[] = [
    { name: "New York session", start: 17 * 60 + 30, end: 2 * 60 + 30 },
    { name: "London session", start: 14 * 60 + 30, end: 21 * 60 + 30 },
    { name: "Asian session", start: 5 * 60 + 30, end: 14 * 60 + 30 },
];

const WEEK_OPEN = 17 * 60; // 5:00 pm ET

function etNow() {
    const et = new Date(
        new Date().toLocaleString("en-US", { timeZone: "America/New_York" })
    );
    return { day: et.getDay(), minutes: et.getHours() * 60 + et.getMinutes() };
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

const inside = (s: Session, m: number) =>
    s.start < s.end ? m >= s.start && m < s.end : m >= s.start || m < s.end;

export type MarketSession = { name: string; detail: string; active: boolean };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getMarketSession(marketPointer?: any): MarketSession | null {
    if (marketPointer?.currencies?.fx === "closed") return null;
    const { day, minutes } = etNow();
    if (isWeekend(day, minutes)) return null;

    for (const s of SESSIONS) {
        if (inside(s, minutes)) {
            const left =
                s.start < s.end || minutes < s.end
                    ? s.end - minutes
                    : 24 * 60 - minutes + s.end;
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
