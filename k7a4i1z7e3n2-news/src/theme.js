import { useEffect, useState } from 'react';

// Chart colours are read from CSS custom properties so light/dark stay in one place
// (styles.css). SVG presentation attributes can't use var(), so we resolve them here.
const KEYS = ['bull', 'bear', 'band', 'ink', 'ink2', 'muted', 'grid', 'axis', 'surface', 'high', 'medium', 'rate', 'now'];

function read() {
  const cs = getComputedStyle(document.documentElement);
  return Object.fromEntries(KEYS.map((k) => [k, cs.getPropertyValue(`--${k}`).trim()]));
}

export function useThemeColors() {
  const [colors, setColors] = useState(read);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setColors(read());
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return colors;
}
