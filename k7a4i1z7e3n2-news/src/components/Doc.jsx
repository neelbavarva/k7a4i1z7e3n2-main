import { useEffect, useState } from 'react';

// Shared by the two "How it works" pages: the contents list down the side, which follows the
// reader. `sections` is a list of [id, title] pairs, in page order.

/** Highlights the section currently on screen in the contents list. */
export function useActiveSection(sections) {
  const [active, setActive] = useState(sections[0][0]);
  useEffect(() => {
    const els = sections.map(([id]) => document.getElementById(id)).filter(Boolean);
    const io = new IntersectionObserver(
      (entries) => {
        const seen = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (seen[0]) setActive(seen[0].target.id);
      },
      { rootMargin: '0px 0px -70% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections]);
  return active;
}

const jump = (e, id) => {
  // the site uses #/ routes, so scroll in place instead of changing the hash
  e.preventDefault();
  // close the phone contents list first, so the page doesn't shift under the scroll
  e.currentTarget.closest('details')?.removeAttribute('open');
  requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
};

/** The contents as a line index: a dash per section, darker once read, longer for the one in view. */
export function Contents({ sections, active }) {
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
