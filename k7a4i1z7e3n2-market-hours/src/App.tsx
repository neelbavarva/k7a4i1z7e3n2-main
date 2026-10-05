import { lazy, Suspense, useEffect, useState } from 'react';
import StatusBar from './components/StatusBar';
import ZonePicker from './components/ZonePicker';
import Dashboard from './components/Dashboard';
import { useClock, useMarketDay, useSettings } from './hooks';
import { cityOfZone, formatGmtOffset, offsetMinutes } from './marketTime';

const Guide = lazy(() => import('./components/Guide'));
const Calculator = lazy(() => import('./components/Calculator'));

const BASE = import.meta.env.BASE_URL;
export const href = (route: string) => `${BASE}#/${route}`;

type Route = 'home' | 'guide' | 'size';

function readRoute(): Route {
  const raw = decodeURIComponent(window.location.hash.replace(/^#\/?/, '')).replace(/\/+$/, '').toLowerCase();
  if (raw === 'how-it-works') return 'guide';
  if (raw === 'position-size' || raw === 'position-size-calculator' || raw === 'calculator') return 'size';
  return 'home';
}

const TITLES: Record<Route, string> = {
  home: 'Forex Market Hours',
  guide: 'How market hours work · Forex Market Hours',
  size: 'Position size calculator · Forex Market Hours',
};

function useRoute(): Route {
  const [route, setRoute] = useState<Route>(readRoute);
  useEffect(() => {
    const on = () => {
      setRoute(readRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export default function App() {
  const route = useRoute();
  const nowMs = useClock();
  const { timezone, setTimezone, is24Hour, setIs24Hour } = useSettings();
  const day = useMarketDay(timezone, nowMs);
  const [picking, setPicking] = useState(false);

  // "/" or Cmd/Ctrl+K opens the timezone picker (on the calculator they open its instrument picker)
  useEffect(() => {
    if (route === 'size') return;
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable="true"]');
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPicking((v) => !v);
      } else if (e.key === '/' && !typing && !picking) {
        e.preventDefault();
        setPicking(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [picking, route]);

  useEffect(() => {
    document.title = TITLES[route];
  }, [route]);

  const zoneLabel = `${formatGmtOffset(offsetMinutes(timezone, nowMs)).replace(' ', '')} (${cityOfZone(timezone)})`;

  return (
    <div className="page">
      <StatusBar day={day} is24Hour={is24Hour} setIs24Hour={setIs24Hour} />

      {route === 'guide' ? (
        <Suspense fallback={<div className="skeleton" aria-busy="true" />}>
          <Guide timezone={timezone} nowMs={nowMs} is24Hour={is24Hour} />
        </Suspense>
      ) : route === 'size' ? (
        <Suspense fallback={<div className="skeleton" aria-busy="true" />}>
          <Calculator nowMs={nowMs} timezone={timezone} is24Hour={is24Hour} />
        </Suspense>
      ) : (
        <Dashboard day={day} is24Hour={is24Hour} onPickZone={() => setPicking(true)} />
      )}

      {picking && (
        <ZonePicker current={timezone} nowMs={nowMs} is24Hour={is24Hour} onPick={setTimezone} onClose={() => setPicking(false)} />
      )}

      <footer className="footer">
        {route === 'size' ? (
          <p className="muted">
            Exchange rates from Coinbase, live and refreshed every minute, and currency-api, daily, for metals. Sizes round down
            to your lot step and leave out spreads and commission. A guide to sizing, not financial advice.{' · '}
            <a href={href('')}>Market hours</a>
          </p>
        ) : (
          <p className="muted">
            Times shown in {zoneLabel}. Sessions run 8 am to 5 pm local time (Tokyo 9 am to 6 pm), Monday to Friday, with
            daylight saving applied for each city. Volume and phases are models of a typical day, not live data.{' · '}
            {route === 'guide' ? <a href={href('')}>Market hours</a> : <a href={href('how-it-works')}>How market hours work</a>}
            {' · '}
            <a href={href('position-size')}>Position size calculator</a>
          </p>
        )}
      </footer>
    </div>
  );
}
