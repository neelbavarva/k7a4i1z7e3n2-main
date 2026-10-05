// Small preferences kept in this browser only. Reads and writes never throw: private
// windows and blocked storage just fall back to the defaults.

const KEYS = {
  tab: 'kaizen-journal:tab',
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

