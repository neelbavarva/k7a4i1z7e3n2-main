'use client';

import { createContext, useContext } from 'react';
import type { DayStatus } from '@/lib/journal';
import type { BlownWeek, Trade, TradeType } from '@/lib/types';

export type LoadState = 'loading' | 'ready' | 'error';

export type Journal = {
  trades: Trade[];
  state: LoadState;
  loadingMore: boolean;
  error: string | null;
  reload: () => void;
  blownWeeks: BlownWeek[];
  reloadBlown: () => Promise<void>;
  /** Put a created or updated trade into the list (and refresh the calendar). */
  applyTrade: (t: Trade) => void;
  dropTrade: (id: string) => void;
  /** Bumped after every write, so calendar months refetch. */
  version: number;
  bump: () => void;
  openTrade: (id: string) => void;
  newTrade: () => void;
  /** Null until the browser has the time (server render and hydration; see useNow). */
  today: DayStatus | null;
  batman: string | null;
  setBatman: (until: string | null) => void;
  /** Why a trade type can't be entered right now (for a trade dated today). */
  blocked: Partial<Record<TradeType, string>>;
};

export const JournalCtx = createContext<Journal | null>(null);

export function useJournal() {
  const j = useContext(JournalCtx);
  if (!j) throw new Error('useJournal outside JournalApp');
  return j;
}
