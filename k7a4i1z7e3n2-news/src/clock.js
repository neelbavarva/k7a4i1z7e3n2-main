import { useEffect, useState } from 'react';

/**
 * The time right now, read again every `ms` on the boundary (every whole minute by default),
 * so a release turns "out" on the minute it comes out. The pages compare times with this,
 * not with when the data was made, so a page left open (or data a few hours old) still
 * knows what has already happened.
 */
export function useNow(ms = 60 * 1000) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let timer;
    const tick = () => {
      setNow(Date.now());
      timer = setTimeout(tick, ms - (Date.now() % ms) + 20);
    };
    timer = setTimeout(tick, ms - (Date.now() % ms) + 20);
    // timers sleep in a background tab: catch up as soon as it's back
    const onVisible = () => document.visibilityState === 'visible' && setNow(Date.now());
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [ms]);
  return now;
}
