import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';

// The guides' shared parts: the contents list, and which section is in view.

export type Sections = readonly (readonly [id: string, title: string])[];

/** The section being read: the last one whose heading has passed a line near the top of the screen. */
export function useActiveSection(sections: Sections) {
  const [active, setActive] = useState(sections[0][0]);
  useEffect(() => {
    const els = sections.map(([id]) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = Math.min(120, window.innerHeight * 0.3);
      let current = sections[0][0];
      for (const el of els) if (el.getBoundingClientRect().top <= line) current = el.id;
      // the last sections can't reach the line: at the bottom of the page, light up the last one
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = sections[sections.length - 1][0];
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [sections]);
  return active;
}

const jump = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
  e.preventDefault();
  e.currentTarget.closest('details')?.removeAttribute('open');
  requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
};

/** The contents as a line index: a dash per section, darker once read, longer for the one in view. */
export function Contents({ sections, active }: { sections: Sections; active: string }) {
  const at = sections.findIndex(([id]) => id === active);
  return (
    <ol className="toc-list">
      {sections.map(([id, title], i) => (
        <li key={id}>
          <a href={`#${id}`} onClick={(e) => jump(e, id)} aria-current={active === id ? 'true' : undefined} data-read={i < at || undefined}>
            {title}
          </a>
        </li>
      ))}
    </ol>
  );
}
