// Where an account's money sits, for the net worth globe: the city of its bank, broker or fund
// house (a bank's headquarters when it's known here, else its region's money centre). Crypto has
// no city: wallets orbit instead. Also the globe's land, from lib/landDots.js.

import { BANKS, regionsOf } from "./cards";
import { LAND_BITS, LAND_N } from "./landDots";

// [latitude, longitude] in degrees
export const CITIES = {
    mumbai: { name: "Mumbai", at: [19.08, 72.88] },
    bengaluru: { name: "Bengaluru", at: [12.97, 77.59] },
    delhi: { name: "New Delhi", at: [28.61, 77.21] },
    chennai: { name: "Chennai", at: [13.08, 80.27] },
    kolkata: { name: "Kolkata", at: [22.57, 88.36] },
    kochi: { name: "Kochi", at: [9.93, 76.27] },
    newyork: { name: "New York", at: [40.71, -74.01] },
    charlotte: { name: "Charlotte", at: [35.23, -80.84] },
    sanfrancisco: { name: "San Francisco", at: [37.77, -122.42] },
    toronto: { name: "Toronto", at: [43.65, -79.38] },
    montreal: { name: "Montreal", at: [45.5, -73.57] },
    london: { name: "London", at: [51.51, -0.13] },
    paris: { name: "Paris", at: [48.86, 2.35] },
    frankfurt: { name: "Frankfurt", at: [50.11, 8.68] },
    amsterdam: { name: "Amsterdam", at: [52.37, 4.9] },
    madrid: { name: "Madrid", at: [40.42, -3.7] },
    milan: { name: "Milan", at: [45.46, 9.19] },
    zurich: { name: "Zurich", at: [47.37, 8.54] },
    stockholm: { name: "Stockholm", at: [59.33, 18.07] },
    copenhagen: { name: "Copenhagen", at: [55.68, 12.57] },
    vienna: { name: "Vienna", at: [48.21, 16.37] },
    brussels: { name: "Brussels", at: [50.85, 4.35] },
    oslo: { name: "Oslo", at: [59.91, 10.75] },
    helsinki: { name: "Helsinki", at: [60.17, 24.94] },
    singapore: { name: "Singapore", at: [1.35, 103.82] },
    kualalumpur: { name: "Kuala Lumpur", at: [3.14, 101.69] },
    jakarta: { name: "Jakarta", at: [-6.2, 106.85] },
    manila: { name: "Manila", at: [14.6, 120.98] },
    bangkok: { name: "Bangkok", at: [13.76, 100.5] },
    hanoi: { name: "Hanoi", at: [21.03, 105.85] },
    tokyo: { name: "Tokyo", at: [35.68, 139.69] },
    seoul: { name: "Seoul", at: [37.57, 126.98] },
    hongkong: { name: "Hong Kong", at: [22.32, 114.17] },
    sydney: { name: "Sydney", at: [-33.87, 151.21] },
    dubai: { name: "Dubai", at: [25.2, 55.27] },
    johannesburg: { name: "Johannesburg", at: [-26.2, 28.05] },
    saopaulo: { name: "São Paulo", at: [-23.55, -46.63] },
};

// a region's money centre, for a bank without its own city here
const REGION_CITY = { in: "mumbai", us: "newyork", gb: "london", eu: "frankfurt", ca: "toronto", apac: "singapore", me: "dubai", af: "johannesburg", latam: "saopaulo", digital: "london" };

// headquarters of the banks the vault knows best
const BANK_CITY = {
    hdfc: "mumbai", sbi: "mumbai", icici: "mumbai", axis: "mumbai", kotak: "mumbai", yes: "mumbai", idfc: "mumbai", indusind: "mumbai", rbl: "mumbai", idbi: "mumbai", dcb: "mumbai",
    iob: "chennai", cub: "chennai", tmb: "chennai", kvb: "chennai", pnb: "delhi", bandhan: "kolkata", federal: "kochi", sib: "kochi", csb: "kochi", dhanlaxmi: "kochi",
    chase: "newyork", citi: "newyork", goldman: "newyork", bofa: "charlotte", truist: "charlotte", wells: "sanfrancisco", schwab: "sanfrancisco",
    rbc: "toronto", td: "toronto", scotia: "toronto", bmo: "toronto", cibc: "toronto", nbc: "montreal", desjardins: "montreal",
    hsbc: "london", barclays: "london", lloyds: "london", natwest: "london", standardchartered: "london", wise: "london", revolut: "london", monzo: "london",
    bnp: "paris", cagricole: "paris", socgen: "paris", commerz: "frankfurt", deutsche: "frankfurt", ing: "amsterdam", rabo: "amsterdam", abn: "amsterdam",
    bbva: "madrid", santander: "madrid", caixabank: "madrid", intesa: "milan", unicredit: "milan", ubs: "zurich", kbc: "brussels",
    nordea: "helsinki", danske: "copenhagen", seb: "stockholm", swedbank: "stockholm", handels: "stockholm", dnb: "oslo", erste: "vienna", raiffeisen: "vienna",
    dbs: "singapore", ocbc: "singapore", uob: "singapore", maybank: "kualalumpur", cimb: "kualalumpur", publicbank: "kualalumpur",
    bca: "jakarta", mandiri: "jakarta", bri: "jakarta", bdo: "manila", bpi: "manila", kbank: "bangkok", bangkok: "bangkok", siam: "bangkok", vietcombank: "hanoi",
    mufg: "tokyo", smbc: "tokyo", mizuho: "tokyo", japanpost: "tokyo", rakuten: "tokyo", kb: "seoul", shinhan: "seoul", hana: "seoul", woori: "seoul",
};

// brokers and platforms
const BRAND_CITY = { zerodha: "bengaluru", groww: "bengaluru" };

const cityFor = (key) => (key && CITIES[key] ? { key, ...CITIES[key] } : null);

/** The city an account's mark puts it in, or null for one that has no place (a crypto wallet). */
export function placeOf(mark) {
    if (!mark) return null;
    if (mark.stack?.length) return placeOf(mark.stack[0]);
    if (mark.wallet) return null;
    if (mark.brand) return cityFor(BRAND_CITY[mark.brand]);
    if (mark.bank) {
        const b = typeof mark.bank === "string" ? BANKS.find((x) => x.id === mark.bank) : mark.bank;
        return cityFor(BANK_CITY[b?.id]) || cityFor(REGION_CITY[b ? regionsOf(b)[0] : "in"]);
    }
    return undefined; // a mark with no place of its own: it goes where most of the money is
}

/** A point on the unit sphere from latitude and longitude in degrees (longitude 0 faces you). */
export function toVec([lat, lon]) {
    const a = (lat * Math.PI) / 180;
    const o = (lon * Math.PI) / 180;
    return [Math.cos(a) * Math.sin(o), Math.sin(a), Math.cos(a) * Math.cos(o)];
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5));
let land = null;

/** The land's dots as unit vectors, unpacked once (about 4,600 of them). */
export function landPoints() {
    if (land) return land;
    const bytes = typeof atob === "function" ? atob(LAND_BITS) : Buffer.from(LAND_BITS, "base64").toString("binary");
    const out = [];
    for (let i = 0; i < LAND_N; i++) {
        if (!(bytes.charCodeAt(i >> 3) & (1 << (i & 7)))) continue;
        const y = 1 - (2 * (i + 0.5)) / LAND_N;
        const r = Math.sqrt(1 - y * y);
        const a = i * GOLDEN;
        out.push([Math.cos(a) * r, y, Math.sin(a) * r]);
    }
    land = out;
    return land;
}

/**
 * Where the sun is overhead right now, as a unit vector: its declination for the day of the year
 * and its longitude from the time of day (close enough for shading day and night on a globe).
 */
export function sunVec(now = new Date()) {
    const start = Date.UTC(now.getUTCFullYear(), 0, 0);
    const day = (now.getTime() - start) / 864e5;
    const decl = -23.44 * Math.cos(((2 * Math.PI) / 365) * (day + 10));
    const hours = now.getUTCHours() + now.getUTCMinutes() / 60;
    return toVec([decl, -15 * (hours - 12)]);
}
