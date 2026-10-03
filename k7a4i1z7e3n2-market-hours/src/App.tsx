import { lazy, Suspense, useEffect, useState } from 'react';
import StatusBar from './components/StatusBar';
import ZonePicker from './components/ZonePicker';
import Dashboard from './components/Dashboard';
import { useClock, useMarketDay, useSettings } from './hooks';
import { cityOfZone, formatGmtOffset, offsetMinutes } from './marketTime';

const Guide = lazy(() => import('./components/Guide'));

const BASE = import.meta.env.BASE_URL;
export const href = (route: string) => `${BASE}#/${route}`;

type Route = 'home' | 'guide';

function readRoute(): Route {
  const raw = decodeURIComponent(window.location.hash.replace(/^#\/?/, '')).replace(/\/+$/, '').toLowerCase();
  return raw === 'how-it-works' ? 'guide' : 'home';
}

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

  // "/" or Cmd/Ctrl+K opens the timezone picker from anywhere
  useEffect(() => {
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
  }, [picking]);

  useEffect(() => {
    document.title = route === 'guide' ? 'How market hours work · Forex Market Hours' : 'Forex Market Hours';
  }, [route]);

  const zoneLabel = `${formatGmtOffset(offsetMinutes(timezone, nowMs)).replace(' ', '')} (${cityOfZone(timezone)})`;

  return (
    <div className="page">
      <StatusBar day={day} is24Hour={is24Hour} setIs24Hour={setIs24Hour} />

      {route === 'guide' ? (
        <Suspense fallback={<div className="skeleton" aria-busy="true" />}>
          <Guide timezone={timezone} nowMs={nowMs} is24Hour={is24Hour} />
        </Suspense>
      ) : (
        <Dashboard day={day} is24Hour={is24Hour} onPickZone={() => setPicking(true)} />
      )}

      {picking && (
        <ZonePicker current={timezone} nowMs={nowMs} is24Hour={is24Hour} onPick={setTimezone} onClose={() => setPicking(false)} />
      )}

      <footer className="footer">
        <p className="muted">
          Times shown in {zoneLabel}. Sessions run 8 am to 5 pm local time (Tokyo 9 am to 6 pm), Monday to Friday, with
          daylight saving applied for each city. Volume and phases are models of a typical day, not live data.{' · '}
          {route === 'guide' ? <a href={href('')}>Market hours</a> : <a href={href('how-it-works')}>How market hours work</a>}
        </p>
      </footer>
    </div>
  );
}
