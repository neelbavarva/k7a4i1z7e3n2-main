// Banks, card types and payment networks.
//
// Only the last 4 digits of a card are stored readable, and they can't identify a network,
// so the network is detected from the full number when a card is added and kept, by name
// only, in the card's bankName together with the bank and the type:
//     "HDFC Bank · Credit · Visa"
// Older cards with just a bank name keep working: type and network are simply unknown
// until the card is revealed.

/** How the bank list is grouped when browsing it. */
export const BANK_GROUPS = [
    { id: "private", label: "Private banks" },
    { id: "public", label: "Public sector banks" },
    { id: "small", label: "Small finance banks" },
    { id: "foreign", label: "Foreign banks" },
    { id: "payments", label: "Payments banks" },
];

/** Where banks are listed when browsing beyond India. A bank can sit in more than one. */
export const REGIONS = [
    { id: "in", label: "India" },
    { id: "us", label: "United States", short: "US" },
    { id: "gb", label: "United Kingdom", short: "UK" },
    { id: "eu", label: "Europe" },
    { id: "ca", label: "Canada" },
    { id: "apac", label: "Asia-Pacific", short: "Asia" },
    { id: "me", label: "Middle East" },
    { id: "af", label: "Africa" },
    { id: "latam", label: "Latin America" },
    { id: "digital", label: "Digital banks", short: "Digital" },
];

/** A bank's regions: India unless it says otherwise, plus any home regions it also belongs to. */
export const regionsOf = (b) => [b.region || "in", ...(b.also || [])];

/**
 * Banks that issue cards: India's first (grouped as Indian banks are), then well-known banks
 * around the world by region. New banks always go at the end: a card's face colours follow
 * its bank's place in this list. `top` ones are the default tiles.
 * `color` is the bank's tile tint: its brand colour, taken darker and a little quieter so white
 * reads on it and it sits with the site's inks.
 * Logos are in public/logos, measured in lib/logos.js. `mark` is how a bank without a logo
 * file prints its name, when that isn't its plain name.
 */
export const BANKS = [
    { id: "hdfc", name: "HDFC Bank", short: "HDFC", color: "#074b8a", group: "private", top: true },
    { id: "sbi", name: "State Bank of India", short: "SBI", color: "#292075", group: "public", top: true, aliases: ["state bank"] },
    { id: "iob", name: "Indian Overseas Bank", short: "IOB", color: "#1e469d", group: "public", top: true },
    { id: "axis", name: "Axis Bank", short: "Axis", color: "#891846", group: "private", top: true },

    { id: "icici", name: "ICICI Bank", short: "ICICI", color: "#a12f31", group: "private" },
    { id: "kotak", name: "Kotak Mahindra Bank", short: "Kotak", color: "#a1302b", group: "private" },
    { id: "indusind", name: "IndusInd Bank", short: "IndusInd", color: "#98272a", group: "private" },
    { id: "yes", name: "Yes Bank", short: "Yes", color: "#034e8c", group: "private" },
    { id: "idfc", name: "IDFC FIRST Bank", short: "IDFC FIRST", color: "#98262b", group: "private" },
    { id: "federal", name: "Federal Bank", short: "Federal", color: "#14479d", group: "private" },
    { id: "rbl", name: "RBL Bank", short: "RBL", color: "#214099", group: "private", aliases: ["ratnakar"] },
    { id: "bandhan", name: "Bandhan Bank", short: "Bandhan", color: "#a13029", group: "private" },
    { id: "idbi", name: "IDBI Bank", short: "IDBI", color: "#045b4a", group: "private" },
    { id: "sib", name: "South Indian Bank", short: "SIB", color: "#9b2b21", group: "private" },
    { id: "kvb", name: "Karur Vysya Bank", short: "KVB", color: "#0b5c33", group: "private" },
    { id: "cub", name: "City Union Bank", short: "CUB", color: "#2e328f", group: "private" },
    { id: "karnataka", name: "Karnataka Bank", short: "Karnataka", color: "#70287d", group: "private" },
    { id: "tmb", name: "Tamilnad Mercantile Bank", short: "TMB", color: "#2c3f8f", group: "private" },
    { id: "dcb", name: "DCB Bank", short: "DCB", color: "#26358f", group: "private" },
    { id: "jk", name: "J&K Bank", short: "J&K", color: "#03527c", group: "private", aliases: ["jammu", "kashmir"] },
    { id: "csb", name: "CSB Bank", short: "CSB", color: "#03428e", group: "private", aliases: ["catholic syrian"] },
    { id: "dhanlaxmi", name: "Dhanlaxmi Bank", short: "Dhanlaxmi", color: "#540443", group: "private" },

    { id: "pnb", name: "Punjab National Bank", short: "PNB", color: "#8c1735", group: "public" },
    { id: "bob", name: "Bank of Baroda", short: "BoB", color: "#9b3b08", group: "public", aliases: ["baroda"] },
    { id: "canara", name: "Canara Bank", short: "Canara", color: "#08527c", group: "public" },
    { id: "union", name: "Union Bank of India", short: "Union", color: "#a13126", group: "public" },
    { id: "boi", name: "Bank of India", short: "BOI", color: "#964008", group: "public" },
    { id: "indian", name: "Indian Bank", short: "Indian", color: "#1c4c8c", group: "public" },
    { id: "central", name: "Central Bank of India", short: "Central", color: "#a1302d", group: "public" },
    { id: "uco", name: "UCO Bank", short: "UCO", color: "#064d8f", group: "public" },
    { id: "bom", name: "Bank of Maharashtra", short: "Mahabank", color: "#03527e", group: "public", aliases: ["maharashtra"] },
    { id: "psb", name: "Punjab & Sind Bank", short: "P&SB", color: "#015d2c", group: "public", aliases: ["punjab and sind"] },

    { id: "au", name: "AU Small Finance Bank", short: "AU", color: "#6c2276", group: "small" },
    { id: "equitas", name: "Equitas Small Finance Bank", short: "Equitas", color: "#934404", group: "small" },
    { id: "ujjivan", name: "Ujjivan Small Finance Bank", short: "Ujjivan", color: "#085a4f", group: "small" },
    { id: "jana", name: "Jana Small Finance Bank", short: "Jana", color: "#065d31", group: "small" },
    { id: "suryoday", name: "Suryoday Small Finance Bank", short: "Suryoday", color: "#9d3808", group: "small" },
    { id: "slice", name: "slice Small Finance Bank", short: "slice", color: "#553494", group: "small" },

    { id: "amex", name: "American Express", short: "Amex", color: "#014f8b", group: "foreign", also: ["us"] },
    { id: "sc", name: "Standard Chartered", short: "StanChart", color: "#034a9a", group: "foreign", aliases: ["stanchart", "scb"], also: ["gb"] },
    { id: "hsbc", name: "HSBC", short: "HSBC", color: "#a13029", group: "foreign", also: ["gb"] },
    { id: "citi", name: "Citibank", short: "Citi", color: "#053b6e", group: "foreign", aliases: ["citi"], also: ["us"] },
    { id: "dbs", name: "DBS Bank", short: "DBS", color: "#a1302b", group: "foreign", also: ["apac"] },
    { id: "deutsche", name: "Deutsche Bank", short: "Deutsche", color: "#0f2f86", group: "foreign", also: ["eu"] },
    { id: "barclays", name: "Barclays", short: "Barclays", color: "#06395b", group: "foreign", also: ["gb"] },

    { id: "airtel", name: "Airtel Payments Bank", short: "Airtel", color: "#a13126", group: "payments" },
    { id: "ippb", name: "India Post Payments Bank", short: "IPPB", color: "#a12f34", group: "payments", aliases: ["post office"] },
    { id: "jio", name: "Jio Payments Bank", short: "Jio", color: "#0c2a81", group: "payments" },
    { id: "fino", name: "Fino Payments Bank", short: "Fino", color: "#612f8c", group: "payments" },

    // ----- around the world (added later: keep new banks at the end) -----

    // United States
    { id: "chase", name: "Chase", short: "Chase", color: "#0b3d7a", region: "us", aliases: ["chase bank", "jpmorgan chase", "jpmorgan chase bank"] },
    { id: "bofa", name: "Bank of America", short: "BofA", mark: "Bank of America", color: "#a3132c", region: "us", aliases: ["boa", "bofa", "b of a", "merrill", "merrill lynch", "merrill edge"] },
    { id: "wells", name: "Wells Fargo", short: "Wells Fargo", color: "#a1191f", region: "us", aliases: ["wf"] },
    { id: "capone", name: "Capital One", short: "Capital One", color: "#0b4a74", region: "us", aliases: ["capitalone", "cap one"] },
    { id: "usbank", name: "U.S. Bank", short: "U.S. Bank", color: "#0c2074", region: "us", aliases: ["us bank", "usbank"] },
    { id: "pnc", name: "PNC Bank", short: "PNC", color: "#b14a0d", region: "us" },
    { id: "truist", name: "Truist", short: "Truist", color: "#3c2a6b", region: "us" },
    { id: "goldman", name: "Goldman Sachs", short: "Goldman Sachs", color: "#3f5f86", region: "us", aliases: ["apple card", "marcus", "gs"] },
    { id: "discover", name: "Discover", short: "Discover", color: "#a24a0f", region: "us", aliases: ["discover bank"] },
    { id: "synchrony", name: "Synchrony", short: "Synchrony", color: "#3a3f46", region: "us" },
    { id: "schwab", name: "Charles Schwab", short: "Schwab", color: "#0a5a8c", region: "us" },
    { id: "ally", name: "Ally Bank", short: "Ally", color: "#5a1d6b", region: "us" },
    { id: "usaa", name: "USAA", short: "USAA", color: "#0c2a4d", region: "us" },
    { id: "navyfed", name: "Navy Federal Credit Union", short: "Navy Federal", color: "#0d2a5c", region: "us", aliases: ["nfcu"] },
    { id: "citizens", name: "Citizens Bank", short: "Citizens", color: "#0b5b46", region: "us" },
    { id: "fifththird", name: "Fifth Third Bank", short: "Fifth Third", color: "#145233", region: "us", aliases: ["53"] },
    { id: "keybank", name: "KeyBank", short: "KeyBank", color: "#a11622", region: "us" },
    { id: "huntington", name: "Huntington Bank", short: "Huntington", color: "#2a6b2e", region: "us" },

    // Canada
    { id: "rbc", name: "Royal Bank of Canada", short: "RBC", color: "#0b3f7a", region: "ca", aliases: ["royal bank"] },
    { id: "td", name: "TD Bank", short: "TD", color: "#11612b", region: "ca", also: ["us"], aliases: ["td canada trust", "toronto dominion"] },
    { id: "scotia", name: "Scotiabank", short: "Scotiabank", color: "#a1141c", region: "ca", aliases: ["bank of nova scotia", "bns"] },
    { id: "bmo", name: "BMO", short: "BMO", mark: "BMO", color: "#0b4d8c", region: "ca", aliases: ["bank of montreal"] },
    { id: "cibc", name: "CIBC", short: "CIBC", color: "#9b1b22", region: "ca" },
    { id: "nbc", name: "National Bank of Canada", short: "National Bank", color: "#9e1a22", region: "ca", aliases: ["banque nationale"] },
    { id: "desjardins", name: "Desjardins", short: "Desjardins", color: "#0c5a3c", region: "ca" },
    { id: "tangerine", name: "Tangerine", short: "Tangerine", color: "#b1500d", region: "ca" },

    // United Kingdom
    { id: "lloyds", name: "Lloyds Bank", short: "Lloyds", color: "#0b5a33", region: "gb" },
    { id: "natwest", name: "NatWest", short: "NatWest", color: "#42145f", region: "gb" },
    { id: "santander", name: "Santander", short: "Santander", color: "#a8100f", region: "eu", also: ["gb", "latam", "us"] },
    { id: "halifax", name: "Halifax", short: "Halifax", color: "#0b3a8c", region: "gb" },
    { id: "nationwide", name: "Nationwide", short: "Nationwide", color: "#0c2f6b", region: "gb", aliases: ["nationwide building society"] },
    { id: "rbs", name: "Royal Bank of Scotland", short: "RBS", color: "#2b2a6b", region: "gb" },
    { id: "tsb", name: "TSB", short: "TSB", color: "#0b4a8c", region: "gb" },
    { id: "metro", name: "Metro Bank", short: "Metro", color: "#b0102a", region: "gb" },
    { id: "virgin", name: "Virgin Money", short: "Virgin Money", color: "#a1122a", region: "gb" },

    // Europe
    { id: "bnp", name: "BNP Paribas", short: "BNP Paribas", color: "#0b5a3c", region: "eu", aliases: ["bnp"] },
    { id: "cagricole", name: "Crédit Agricole", short: "Crédit Agricole", color: "#0b5a52", region: "eu" },
    { id: "socgen", name: "Société Générale", short: "Société Générale", color: "#9e1b23", region: "eu", aliases: ["sg"] },
    { id: "commerz", name: "Commerzbank", short: "Commerzbank", color: "#6b5a12", region: "eu" },
    { id: "sparkasse", name: "Sparkasse", short: "Sparkasse", color: "#a5121b", region: "eu" },
    { id: "ing", name: "ING", short: "ING", color: "#b14800", region: "eu", aliases: ["ing bank", "ing direct"] },
    { id: "rabo", name: "Rabobank", short: "Rabobank", color: "#0b3a7a", region: "eu" },
    { id: "abn", name: "ABN AMRO", short: "ABN AMRO", color: "#0a5c55", region: "eu" },
    { id: "bbva", name: "BBVA", short: "BBVA", color: "#0a3b78", region: "eu", also: ["latam"] },
    { id: "caixabank", name: "CaixaBank", short: "CaixaBank", color: "#0b5a8c", region: "eu", aliases: ["la caixa"] },
    { id: "intesa", name: "Intesa Sanpaolo", short: "Intesa", color: "#0b5a38", region: "eu" },
    { id: "unicredit", name: "UniCredit", short: "UniCredit", color: "#a1141c", region: "eu" },
    { id: "ubs", name: "UBS", short: "UBS", color: "#8a1c1c", region: "eu" },
    { id: "kbc", name: "KBC", short: "KBC", color: "#0b4f7a", region: "eu" },
    { id: "nordea", name: "Nordea", short: "Nordea", color: "#0b2f6b", region: "eu" },
    { id: "danske", name: "Danske Bank", short: "Danske", color: "#0b3352", region: "eu" },
    { id: "seb", name: "SEB", short: "SEB", color: "#2a6b2e", region: "eu" },
    { id: "swedbank", name: "Swedbank", short: "Swedbank", color: "#a14a0f", region: "eu" },
    { id: "handels", name: "Handelsbanken", short: "Handelsbanken", color: "#0b3f6b", region: "eu" },
    { id: "dnb", name: "DNB", short: "DNB", color: "#0b5a5a", region: "eu" },
    { id: "erste", name: "Erste Bank", short: "Erste", color: "#0b3f7a", region: "eu", aliases: ["erste group"] },
    { id: "raiffeisen", name: "Raiffeisen Bank", short: "Raiffeisen", color: "#6b5a12", region: "eu" },

    // Asia-Pacific
    { id: "ocbc", name: "OCBC", short: "OCBC", color: "#a1141c", region: "apac" },
    { id: "uob", name: "UOB", short: "UOB", color: "#0b3a7a", region: "apac", aliases: ["united overseas bank"] },
    { id: "maybank", name: "Maybank", short: "Maybank", color: "#6b5a12", region: "apac" },
    { id: "cimb", name: "CIMB Bank", short: "CIMB", color: "#a1141c", region: "apac" },
    { id: "publicbank", name: "Public Bank", short: "Public Bank", color: "#9b1b22", region: "apac" },
    { id: "bca", name: "Bank Central Asia", short: "BCA", color: "#0b3a7a", region: "apac" },
    { id: "mandiri", name: "Bank Mandiri", short: "Mandiri", color: "#0b3a6b", region: "apac" },
    { id: "bri", name: "Bank Rakyat Indonesia", short: "BRI", color: "#0b4a7a", region: "apac" },
    { id: "bdo", name: "BDO Unibank", short: "BDO", color: "#0b3a7a", region: "apac" },
    { id: "bpi", name: "Bank of the Philippine Islands", short: "BPI", color: "#a1141c", region: "apac" },
    { id: "kbank", name: "Kasikornbank", short: "KBank", color: "#0b5a33", region: "apac", aliases: ["kasikorn"] },
    { id: "bangkok", name: "Bangkok Bank", short: "Bangkok Bank", color: "#0b3a7a", region: "apac" },
    { id: "siam", name: "Siam Commercial Bank", short: "Siam Commercial", color: "#4a2a6b", region: "apac", aliases: ["siam"] },
    { id: "vietcombank", name: "Vietcombank", short: "Vietcombank", color: "#0b5a33", region: "apac" },
    { id: "mufg", name: "MUFG Bank", short: "MUFG", color: "#a1141c", region: "apac", aliases: ["mitsubishi ufj"] },
    { id: "smbc", name: "Sumitomo Mitsui Banking Corporation", short: "SMBC", color: "#0b5a33", region: "apac", aliases: ["sumitomo mitsui"] },
    { id: "mizuho", name: "Mizuho", short: "Mizuho", color: "#0b2f6b", region: "apac" },
    { id: "japanpost", name: "Japan Post Bank", short: "Japan Post", color: "#0b5a33", region: "apac", aliases: ["yucho"] },
    { id: "rakuten", name: "Rakuten Bank", short: "Rakuten", color: "#a1141c", region: "apac" },
    { id: "kb", name: "KB Kookmin Bank", short: "KB", color: "#6b5a12", region: "apac", aliases: ["kookmin"] },
    { id: "shinhan", name: "Shinhan Bank", short: "Shinhan", color: "#0b3a7a", region: "apac" },
    { id: "hana", name: "Hana Bank", short: "Hana", color: "#0b5a52", region: "apac" },
    { id: "woori", name: "Woori Bank", short: "Woori", color: "#0b4a7a", region: "apac" },
    { id: "icbc", name: "ICBC", short: "ICBC", color: "#a1141c", region: "apac", aliases: ["industrial and commercial bank of china"] },
    { id: "ccb", name: "China Construction Bank", short: "CCB", color: "#0b3a7a", region: "apac" },
    { id: "bankofchina", name: "Bank of China", short: "Bank of China", color: "#a1141c", region: "apac", aliases: ["boc"] },
    { id: "abc", name: "Agricultural Bank of China", short: "ABC", color: "#0b5a42", region: "apac" },
    { id: "cmb", name: "China Merchants Bank", short: "CMB", color: "#a1141c", region: "apac" },
    { id: "bocom", name: "Bank of Communications", short: "BoCom", color: "#0b3a6b", region: "apac" },
    { id: "hangseng", name: "Hang Seng Bank", short: "Hang Seng", color: "#0b5a52", region: "apac" },
    { id: "bea", name: "Bank of East Asia", short: "BEA", color: "#a1141c", region: "apac" },
    { id: "commbank", name: "Commonwealth Bank", short: "CommBank", color: "#6b5a12", region: "apac", aliases: ["commonwealth bank of australia", "cba"] },
    { id: "westpac", name: "Westpac", short: "Westpac", color: "#a1141c", region: "apac" },
    { id: "anz", name: "ANZ", short: "ANZ", color: "#0b3f7a", region: "apac", aliases: ["australia and new zealand banking"] },
    { id: "nab", name: "National Australia Bank", short: "NAB", color: "#3a3f46", region: "apac" },
    { id: "macquarie", name: "Macquarie", short: "Macquarie", color: "#2b3a4a", region: "apac" },
    { id: "asb", name: "ASB Bank", short: "ASB", color: "#6b5a12", region: "apac" },
    { id: "bnz", name: "Bank of New Zealand", short: "BNZ", color: "#0b3a7a", region: "apac" },
    { id: "kiwibank", name: "Kiwibank", short: "Kiwibank", color: "#2a6b2e", region: "apac" },
    { id: "hbl", name: "Habib Bank", short: "HBL", color: "#0b5a42", region: "apac" },
    { id: "mcb", name: "MCB Bank", short: "MCB", color: "#2a5a2a", region: "apac" },
    { id: "meezan", name: "Meezan Bank", short: "Meezan", color: "#5a1d4b", region: "apac" },
    { id: "combank", name: "Commercial Bank of Ceylon", short: "ComBank", color: "#0b3a7a", region: "apac" },
    { id: "brac", name: "BRAC Bank", short: "BRAC", color: "#0b3a6b", region: "apac" },
    { id: "dbbl", name: "Dutch-Bangla Bank", short: "DBBL", color: "#0b5a33", region: "apac" },
    { id: "nabil", name: "Nabil Bank", short: "Nabil", color: "#0b3a6b", region: "apac" },

    // Middle East
    { id: "enbd", name: "Emirates NBD", short: "Emirates NBD", color: "#0b3f6b", region: "me", aliases: ["enbd"] },
    { id: "fab", name: "First Abu Dhabi Bank", short: "FAB", color: "#0b3a6b", region: "me" },
    { id: "adcb", name: "Abu Dhabi Commercial Bank", short: "ADCB", color: "#a1141c", region: "me" },
    { id: "mashreq", name: "Mashreq", short: "Mashreq", color: "#a14a0f", region: "me" },
    { id: "dib", name: "Dubai Islamic Bank", short: "DIB", color: "#0b5a3c", region: "me" },
    { id: "qnb", name: "Qatar National Bank", short: "QNB", color: "#5a1d4b", region: "me" },
    { id: "alrajhi", name: "Al Rajhi Bank", short: "Al Rajhi", color: "#0b3a7a", region: "me", aliases: ["alrajhi"] },
    { id: "snb", name: "Saudi National Bank", short: "SNB", color: "#0b5a3c", region: "me", aliases: ["alahli", "ncb"] },
    { id: "riyad", name: "Riyad Bank", short: "Riyad Bank", color: "#0b4a6b", region: "me" },
    { id: "kfh", name: "Kuwait Finance House", short: "KFH", color: "#0b5a3c", region: "me" },
    { id: "nbk", name: "National Bank of Kuwait", short: "NBK", color: "#0b3a6b", region: "me" },
    { id: "hapoalim", name: "Bank Hapoalim", short: "Hapoalim", color: "#a1141c", region: "me" },
    { id: "leumi", name: "Bank Leumi", short: "Leumi", color: "#0b3f7a", region: "me" },

    // Africa
    { id: "standardbank", name: "Standard Bank", short: "Standard Bank", color: "#0b2f6b", region: "af" },
    { id: "fnb", name: "First National Bank", short: "FNB", color: "#0b5a5a", region: "af", aliases: ["firstrand"] },
    { id: "absa", name: "Absa", short: "Absa", color: "#a1141c", region: "af" },
    { id: "nedbank", name: "Nedbank", short: "Nedbank", color: "#0b5a33", region: "af" },
    { id: "capitec", name: "Capitec", short: "Capitec", color: "#0b3a6b", region: "af" },
    { id: "ecobank", name: "Ecobank", short: "Ecobank", color: "#0b4a6b", region: "af" },
    { id: "access", name: "Access Bank", short: "Access", color: "#a14a0f", region: "af" },
    { id: "zenith", name: "Zenith Bank", short: "Zenith", color: "#a1141c", region: "af" },
    { id: "gtbank", name: "Guaranty Trust Bank", short: "GTBank", color: "#a14a0f", region: "af", aliases: ["gtco", "gt bank"] },
    { id: "equity", name: "Equity Bank", short: "Equity", color: "#8a2a1c", region: "af" },
    { id: "attijari", name: "Attijariwafa Bank", short: "Attijariwafa", color: "#a14a0f", region: "af" },
    { id: "cib", name: "Commercial International Bank", short: "CIB", color: "#0b3a6b", region: "af" },
    { id: "banquemisr", name: "Banque Misr", short: "Banque Misr", color: "#8a1c1c", region: "af" },

    // Latin America
    { id: "itau", name: "Itaú Unibanco", short: "Itaú", color: "#b04a0d", region: "latam" },
    { id: "bradesco", name: "Bradesco", short: "Bradesco", color: "#a1141c", region: "latam" },
    { id: "bb", name: "Banco do Brasil", short: "Banco do Brasil", color: "#0b3a7a", region: "latam" },
    { id: "caixa", name: "Caixa Econômica Federal", short: "Caixa", color: "#0b4f8c", region: "latam" },
    { id: "banorte", name: "Banorte", short: "Banorte", color: "#a1141c", region: "latam" },
    { id: "banamex", name: "Banamex", short: "Banamex", color: "#0b3a7a", region: "latam", aliases: ["citibanamex"] },
    { id: "bancolombia", name: "Bancolombia", short: "Bancolombia", color: "#6b5a12", region: "latam" },
    { id: "bancochile", name: "Banco de Chile", short: "Banco de Chile", color: "#0b3a6b", region: "latam" },
    { id: "bcp", name: "Banco de Crédito del Perú", short: "BCP", color: "#0b3a7a", region: "latam" },
    { id: "galicia", name: "Banco Galicia", short: "Galicia", color: "#a14a0f", region: "latam" },

    // Digital banks
    { id: "revolut", name: "Revolut", short: "Revolut", color: "#2b2f36", region: "digital", also: ["gb", "eu"] },
    { id: "wise", name: "Wise", short: "Wise", color: "#2a6b2e", region: "digital", also: ["gb", "eu"], aliases: ["transferwise"] },
    { id: "monzo", name: "Monzo", short: "Monzo", color: "#a1312a", region: "digital", also: ["gb"] },
    { id: "starling", name: "Starling Bank", short: "Starling", color: "#4a2a6b", region: "digital", also: ["gb"] },
    { id: "n26", name: "N26", short: "N26", color: "#2b3a4a", region: "digital", also: ["eu"] },
    { id: "bunq", name: "bunq", short: "bunq", color: "#2a6b2e", region: "digital", also: ["eu"] },
    { id: "chime", name: "Chime", short: "Chime", color: "#0b5a3c", region: "digital", also: ["us"] },
    { id: "sofi", name: "SoFi", short: "SoFi", color: "#0b4a7a", region: "digital", also: ["us"] },
    { id: "varo", name: "Varo Bank", short: "Varo", color: "#2a3a6b", region: "digital", also: ["us"] },
    { id: "cashapp", name: "Cash App", short: "Cash App", color: "#1c5a2a", region: "digital", also: ["us"], aliases: ["square"] },
    { id: "paypal", name: "PayPal", short: "PayPal", color: "#0b3a7a", region: "digital", also: ["us"] },
    { id: "nubank", name: "Nubank", short: "Nu", mark: "Nu", color: "#5a1d7a", region: "digital", also: ["latam"], aliases: ["nu"] },
    { id: "inter", name: "Banco Inter", short: "Inter", color: "#a14a0f", region: "digital", also: ["latam"] },
    { id: "mercadopago", name: "Mercado Pago", short: "Mercado Pago", color: "#0b5a8c", region: "digital", also: ["latam"] },

    // added after the first world list
    { id: "jpmorgan", name: "J.P. Morgan", short: "J.P. Morgan", color: "#4f4236", region: "us", aliases: ["jp morgan", "jpmorgan", "jpm", "j p morgan", "jpmorgan private bank"] },
];

/** Tile colours for banks that aren't in the list, in the same depth as the listed ones. */
const CUSTOM_COLORS = ["#1c4c8c", "#8c2a3a", "#145c47", "#553494", "#934404", "#085a5f", "#3a4656", "#70287d"];

const hashOf = (s = "") => {
    let h = 0;
    for (const ch of String(s).toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return h;
};

/** A bank not in the list always gets the same colour. */
export function bankColor(name = "") {
    return CUSTOM_COLORS[hashOf(name) % CUSTOM_COLORS.length];
}

/**
 * Card faces: quiet colour pairs, lighter at the top left. Picked per bank but not from its
 * brand, so neighbouring banks in the list (and the four most used) all differ.
 */
export const CARD_FACES = [
    ["#5d646b", "#373b40"], // slate
    ["#4f5e8a", "#2e3858"], // navy
    ["#3f7074", "#274548"], // teal
    ["#8a5470", "#593349"], // wine
    ["#7b5f99", "#52446b"], // plum
    ["#6f6c4e", "#45432f"], // olive
    ["#8b5d47", "#5a3b2c"], // sienna
    ["#4f705a", "#32483a"], // forest
];
/** The face for a card whose bank isn't chosen yet. */
export const BLANK_FACE = ["#4b5056", "#2d3136"];

/** Which of CARD_FACES a bank's cards use (a BANKS entry, or a name typed in); -1 for none yet. */
export function faceIndex(known, name) {
    if (known) return BANKS.indexOf(known) % CARD_FACES.length;
    return name ? hashOf(name) % CARD_FACES.length : -1;
}

/** The face colours for a bank, or the blank face before one is picked. */
export function cardFace(known, name) {
    const i = faceIndex(known, name);
    return i < 0 ? BLANK_FACE : CARD_FACES[i];
}

/** The listed banks someone has cards with, most cards first, for the bank picker's tiles. */
export function banksOf(cards = []) {
    const count = new Map();
    for (const c of cards) {
        const id = parseBankName(c.bankName).known?.id;
        if (id) count.set(id, (count.get(id) || 0) + 1);
    }
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

/** Faces for a row of cards (by _id): each bank's own, moved on one where it would repeat its neighbour's. */
export function rowFaces(cards) {
    const faces = new Map();
    let prev = -1;
    for (const c of cards) {
        const { known, bank } = parseBankName(c.bankName);
        let i = faceIndex(known, bank);
        if (i < 0) i = 0;
        if (i === prev) i = (i + 1) % CARD_FACES.length;
        faces.set(c._id, CARD_FACES[i]);
        prev = i;
    }
    return faces;
}

// lower case, accents folded (Société → societe), anything else between words a single space
const norm = (s) =>
    String(s || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9&]+/g, " ")
        .trim();

/** The listed bank a name refers to, by its full name, short name or an alias. */
export function findBank(name) {
    const n = norm(name);
    if (!n) return null;
    return BANKS.find((b) => norm(b.name) === n || norm(b.short) === n || (b.aliases || []).some((a) => norm(a) === n)) || null;
}

const SMALL_WORDS = new Set(["of", "the", "and", "&", "de", "do", "da", "del"]);

/** A name's initials, with and without its small words: "Bank of America" → boa and ba. */
function initialsOf(name) {
    const words = norm(name).split(" ").filter(Boolean);
    const all = words.map((w) => w[0]).join("");
    const big = words.filter((w) => !SMALL_WORDS.has(w)).map((w) => w[0]).join("");
    return [...new Set([all, big])].filter((x) => x.length > 1);
}

/** True when a and b are one typo apart: a letter added, dropped, changed or two swapped. */
function oneTypo(a, b) {
    if (a === b || Math.abs(a.length - b.length) > 1) return a === b;
    let i = 0;
    while (i < a.length && a[i] === b[i]) i++;
    if (a.length === b.length) {
        if (a.slice(i + 1) === b.slice(i + 1)) return true;
        return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
    }
    const [long, short] = a.length > b.length ? [a, b] : [b, a];
    return long.slice(i + 1) === short.slice(i);
}

/**
 * Banks matching a search, best first: a whole-name match, then a name or a word starting with
 * it, then its initials ("boa", "rbc"), then anywhere in a name, then one typo away ("barlcays").
 * Within a rank, banks in `prefer` (a region id) come first, then the list's own order.
 */
export function searchBanks(query, prefer) {
    const q = norm(query);
    if (!q) return [];
    const score = (b) => {
        const names = [b.short, b.name, b.mark, ...(b.aliases || [])].filter(Boolean).map(norm);
        if (names.some((n) => n === q)) return 0;
        if (names.some((n) => n.startsWith(q))) return 1;
        if (names.some((n) => n.split(" ").some((w) => w.startsWith(q)))) return 2;
        if (q.length > 1 && !q.includes(" ") && initialsOf(b.name).includes(q)) return 2.5;
        if (names.some((n) => n.includes(q))) return 3;
        if (q.length >= 4 && names.some((n) => n.split(" ").some((w) => w.length >= 4 && oneTypo(w, q)))) return 4;
        return -1;
    };
    const local = (b) => (prefer && regionsOf(b).includes(prefer) ? 0 : 1);
    const hits = BANKS.map((b, i) => [b, score(b), i]).filter(([, s]) => s >= 0);
    // a typo is only a guess: offer one only when nothing matched properly
    const sure = hits.some(([, s]) => s < 4);
    return hits
        .filter(([, s]) => !sure || s < 4)
        .sort((a, b) => a[1] - b[1] || local(a[0]) - local(b[0]) || a[2] - b[2])
        .map(([b]) => b);
}

// time zones that point to a region; anything else falls back on the browser's language
const ZONE_REGIONS = [
    [/^Asia\/(Kolkata|Calcutta)$/, "in"],
    [/^America\/(Toronto|Vancouver|Montreal|Edmonton|Winnipeg|Halifax|St_Johns|Regina)/, "ca"],
    [/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Indiana|Kentucky)|^Pacific\/Honolulu/, "us"],
    [/^America\//, "latam"],
    [/^Europe\/(London|Belfast)$/, "gb"],
    [/^Europe\//, "eu"],
    [/^Asia\/(Dubai|Riyadh|Qatar|Kuwait|Bahrain|Muscat|Jerusalem|Tel_Aviv|Amman|Beirut|Baghdad|Tehran)$/, "me"],
    [/^Africa\//, "af"],
    [/^(Asia|Australia|Pacific)\//, "apac"],
];

/** Where the person adding a card most likely banks, from their time zone. */
export function guessRegion() {
    try {
        const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
        const hit = ZONE_REGIONS.find(([re]) => re.test(zone));
        if (hit) return hit[1];
        const lang = (typeof navigator !== "undefined" && navigator.language) || "";
        if (/-IN$/i.test(lang)) return "in";
        if (/-US$/i.test(lang)) return "us";
        if (/-GB$/i.test(lang)) return "gb";
    } catch {
        /* no Intl: fall through */
    }
    return "in";
}

export const CARD_TYPES = ["Credit", "Debit", "Prepaid"];

/**
 * Payment networks by issuer identification number (the first digits), the same public
 * ranges payment gateways use. Each range is [from, to] on a prefix of that length; the
 * longest matching prefix wins, so RuPay's 652150–653149 beats Discover's 65.
 */
export const NETWORKS = [
    { id: "visa", name: "Visa", lengths: [13, 16, 19], ranges: [["4", "4"]] },
    { id: "mastercard", name: "Mastercard", lengths: [16], ranges: [["51", "55"], ["2221", "2720"]] },
    { id: "amex", name: "American Express", lengths: [15], ranges: [["34", "34"], ["37", "37"]] },
    { id: "diners", name: "Diners Club", lengths: [14, 16, 19], ranges: [["300", "305"], ["309", "309"], ["36", "36"], ["38", "39"]] },
    {
        id: "rupay",
        name: "RuPay",
        lengths: [16],
        ranges: [["508500", "508999"], ["606985", "607984"], ["608001", "608500"], ["652150", "653149"]],
    },
    { id: "discover", name: "Discover", lengths: [16, 19], ranges: [["6011", "6011"], ["644", "649"], ["65", "65"]] },
    { id: "jcb", name: "JCB", lengths: [16, 19], ranges: [["3528", "3589"]] },
    { id: "unionpay", name: "UnionPay", lengths: [16, 17, 18, 19], ranges: [["62", "62"]] },
    {
        id: "maestro",
        name: "Maestro",
        lengths: [12, 13, 14, 15, 16, 17, 18, 19],
        ranges: [["5018", "5018"], ["5020", "5020"], ["5038", "5038"], ["5893", "5893"], ["6304", "6304"], ["6759", "6759"], ["6761", "6763"]],
    },
    { id: "mir", name: "Mir", lengths: [16, 17, 18, 19], ranges: [["2200", "2204"]] },
    {
        id: "verve",
        name: "Verve",
        lengths: [16, 18, 19],
        ranges: [["506099", "506198"], ["507865", "507964"], ["650002", "650027"]],
    },
    { id: "troy", name: "Troy", lengths: [16], ranges: [["9792", "9792"]] },
    { id: "uatp", name: "UATP", lengths: [15], ranges: [["1", "1"]] },
];

const digitsOf = (s) => String(s || "").replace(/\D/g, "");

/** The network for a (possibly partly typed) card number, or null. */
export function detectNetwork(number) {
    const d = digitsOf(number);
    let best = null;
    let bestLen = 0;
    for (const net of NETWORKS) {
        for (const [from, to] of net.ranges) {
            const len = from.length;
            if (d.length < len || len <= bestLen) continue;
            const p = d.slice(0, len);
            if (p >= from && p <= to) {
                best = net;
                bestLen = len;
            }
        }
    }
    return best;
}

/** Luhn checksum, the check digit every card number carries. */
export function luhnValid(number) {
    const d = digitsOf(number);
    if (d.length < 12) return false;
    let sum = 0;
    for (let i = 0; i < d.length; i++) {
        let n = Number(d[d.length - 1 - i]);
        if (i % 2) {
            n *= 2;
            if (n > 9) n -= 9;
        }
        sum += n;
    }
    return sum % 10 === 0;
}

/** How a number is grouped for display: Amex is 4-6-5, everything else in fours. */
export function groupNumber(number, network) {
    const d = digitsOf(number);
    if (network?.id === "amex") return [d.slice(0, 4), d.slice(4, 10), d.slice(10, 15)].filter(Boolean).join(" ");
    return d.replace(/(.{4})(?=.)/g, "$1 ");
}

const SEP = " · ";

/** "HDFC Bank", "Credit", "Visa" → "HDFC Bank · Credit · Visa" (missing parts left out). */
export function composeBankName({ bank, type, network }) {
    return [bank, type, network].filter(Boolean).join(SEP);
}

/** The stored bankName back into its parts; anything unrecognised stays part of the bank. */
export function parseBankName(value = "") {
    const parts = String(value).split(SEP).map((s) => s.trim()).filter(Boolean);
    let type = null;
    let network = null;
    while (parts.length > 1) {
        const last = parts[parts.length - 1];
        const net = NETWORKS.find((n) => n.name.toLowerCase() === last.toLowerCase());
        const typ = CARD_TYPES.find((t) => t.toLowerCase() === last.toLowerCase());
        if (net && !network) network = net;
        else if (typ && !type) type = typ;
        else break;
        parts.pop();
    }
    const bank = parts.join(SEP);
    return { bank, type, network, known: findBank(bank) };
}
