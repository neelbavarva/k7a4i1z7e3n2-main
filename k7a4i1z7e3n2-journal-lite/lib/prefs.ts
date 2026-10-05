// Small preferences kept in this browser only. Reads and writes never throw: private
// windows and blocked storage just fall back to the defaults.

import { demoOn } from './demo';

// sample-data mode keeps its own Batman setting, so trying it out never locks the real journal
const KEYS = {
  tab: 'kaizen-journal:tab',
  get batman() {
    return demoOn() ? 'kaizen-journal:demo:batman' : 'kaizen-journal:batman';
  },
};

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export type Tab = 'trades' | 'calendar';
export const loadTab = (): Tab => (read(KEYS.tab) === 'calendar' ? 'calendar' : 'trades');
export const saveTab = (tab: Tab) => write(KEYS.tab, tab);

/** Batman Mode: real and missed entries are blocked until this local date (YYYY-MM-DD). */
export const loadBatman = () => {
  const v = read(KEYS.batman);
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
};
export const saveBatman = (until: string | null) => write(KEYS.batman, until);
