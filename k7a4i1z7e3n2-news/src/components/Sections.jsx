const href = (route) => `${import.meta.env.BASE_URL}#/${route}`;

/** The two halves of the site, News and the Economic calendar. Sits beside each half's title. */
export default function Sections({ section }) {
  return (
    <nav className="sections" aria-label="Sections">
      <a href={href('all')} aria-current={section === 'news' ? 'page' : undefined}>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M2 12.5 6 8l3 2.5L14 4.5" />
        </svg>
        News
      </a>
      <a href={href('calendar')} aria-current={section === 'calendar' ? 'page' : undefined}>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <rect x="2" y="3" width="12" height="11" rx="2" />
          <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
        </svg>
        <span className="nav-long">Economic calendar</span>
        <span className="nav-short">Calendar</span>
      </a>
    </nav>
  );
}
