import { signed } from '../format.js';
import { isFx } from '../markets.js';

// The tug-of-war: quote currency pulls left (pair falls), base pulls right (pair rises).
// Solid knob = now; dashed ring = where it's heading in 7 days.
export default function Meter({ pair, score, label, future }) {
  const pos = 50 + score / 2; // -100..100 -> 0..100%
  const side = score > 14.9 ? 'up' : score < -14.9 ? 'down' : 'flat';
  const fillLeft = Math.min(50, pos);
  const fillWidth = Math.abs(pos - 50);
  return (
    <figure
      className="meter"
      aria-label={`${label}, score ${signed(score)} out of 100${future != null ? `, heading to ${signed(future)} in 7 days` : ''}`}
    >
      <div className="meter-ends" aria-hidden="true">
        <span>{isFx(pair) ? `${pair.quote} stronger` : 'Bearish'}</span>
        <span className="meter-scale">−100 · 0 · +100</span>
        <span>{isFx(pair) ? `${pair.base} stronger` : 'Bullish'}</span>
      </div>
      <div className="meter-rope" aria-hidden="true">
        <div className="meter-zone" />
        <div className={`meter-pull ${side}`} style={{ left: `${fillLeft}%`, width: `${fillWidth}%` }} />
        <div className="meter-mid" />
        {future != null && <div className="meter-future" style={{ left: `${50 + future / 2}%` }} />}
        <div className={`meter-knot ${side}`} style={{ left: `${pos}%` }} />
      </div>
    </figure>
  );
}
