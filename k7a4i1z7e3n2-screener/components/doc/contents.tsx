'use client';

import { useEffect, useState } from 'react';

type Section = readonly [id: string, title: string];

/** Highlights the section currently on screen in the contents list. */
function useActiveSection(sections: readonly Section[]) {
  const [active, setActive] = useState(sections[0][0]);
  useEffect(() => {
    const els = sections.map(([id]) => document.getElementById(id)).filter((el): el is HTMLElement => Boolean(el));
    // The observer only reports sections whose visibility changed, so keep the full set and
    // highlight the first visible one in page order.
    const visible = new Set<string>();
    const io = new IntersectionObserver(
      entries => {
        entries.forEach(e => (e.isIntersecting ? visible.add(e.target.id) : visible.delete(e.target.id)));
        const first = els.find(el => visible.has(el.id));
        if (first) setActive(first.id);
      },
      { rootMargin: '0px 0px -70% 0px' },
    );
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [sections]);
  return active;
}

/** Scrolls in place (no hash change), closing the phone contents list first so the page doesn't shift under the scroll. */
export function jump(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
  e.preventDefault();
  e.currentTarget.closest('details')?.removeAttribute('open');
  requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
}

/** The contents as a line index: a dash per section, darker once read, longer for the one in view. */
function List({ sections, active }: { sections: readonly Section[]; active: string }) {
  const at = sections.findIndex(([id]) => id === active);
  return (
    <ol className="toc-list">
      {sections.map(([id, title], i) => (
        <li key={id}>
          <a href={`#${id}`} onClick={e => jump(e, id)} aria-current={active === id ? 'true' : undefined} data-read={i < at || undefined}>
            {title}
          </a>
        </li>
      ))}
    </ol>
  );
}

/** Sticky contents on wide screens, a collapsible list on phones; the body sits between them. */
export function DocLayout({ sections, children }: { sections: readonly Section[]; children: React.ReactNode }) {
  const active = useActiveSection(sections);
  return (
    <div className="doc-layout">
      <nav className="toc" aria-label="On this page">
        <p className="toc-title">On this page</p>
        <List sections={sections} active={active} />
      </nav>
      <article className="doc-body">
        <details className="toc-mobile">
          <summary>On this page</summary>
          <List sections={sections} active={active} />
        </details>
        {children}
      </article>
    </div>
  );
}

/** In-page link to another section. */
export function SectionLink({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <a href={`#${id}`} onClick={e => jump(e, id)}>
      {children}
    </a>
  );
}
