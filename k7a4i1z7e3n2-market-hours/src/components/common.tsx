import { useState } from 'react';
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import AU from '../assets/flags/AU.svg';
import JP from '../assets/flags/JP.svg';
import GB from '../assets/flags/GB.svg';
import US from '../assets/flags/US.svg';
import { DAY_MS, clamp, formatClock, tickLabel } from '../marketTime';
import type { SessionId } from '../marketModel';
import type { Scrub } from '../hooks';

const FLAGS: Record<SessionId, string> = { sydney: AU, tokyo: JP, london: GB, newyork: US };

/** Round country flag, as on FX Fundamental Bias. */
export function Flag({ id, size = 20 }: { id: SessionId; size?: number }) {
  return <img className="flag" src={FLAGS[id]} alt="" width={size} height={size} style={{ width: size, height: size }} />;
}

/** Hour ticks under a chart: every 3 h (every 6 h on phones). */
export function Axis({ is24Hour }: { is24Hour: boolean }) {
  return (
    <div className="axis" aria-hidden="true">
      {Array.from({ length: 9 }, (_, i) => i * 3).map((h) => (
        <span
          key={h}
          className={`axis-tick${h % 6 ? ' minor' : ''}${h === 0 ? ' first' : ''}${h === 24 ? ' last' : ''}`}
          style={{ left: `${(h / 24) * 100}%` }}
        >
          {tickLabel(h, is24Hour)}
        </span>
      ))}
    </div>
  );
}

interface PlotProps {
  scrub: Scrub;
  dayStart: number;
  timezone: string;
  is24Hour: boolean;
  className?: string;
  style?: CSSProperties;
  /** what the tooltip says about a moment (hours into the shown day) */
  tip?: (hour: number) => ReactNode;
  /** the slider stop for keyboard users (one per page) */
  keyboard?: boolean;
  /** the shown day isn't today (weekend): the line marks this time of day, not now */
  preview?: boolean;
  label: string;
  children: ReactNode;
}

/**
 * A chart's drawing area. Shows the shared time line with its "now" tag, a hover guide with
 * a tooltip, and starts scrubbing on press anywhere inside it.
 */
export function Plot({ scrub, dayStart, timezone, is24Hour, className, style, tip, keyboard, preview, label, children }: PlotProps) {
  const [hover, setHover] = useState<number | null>(null);
  const live = scrub.scrubPercent === null;
  const lineTime = dayStart + (scrub.percent / 100) * DAY_MS;
  const showHover = hover !== null && !scrub.dragging && tip;
  const hoverHour = hover === null ? 0 : (hover / 100) * 24;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = ((e.shiftKey ? 60 : 15) / (24 * 60)) * 100;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') scrub.set(scrub.percent - step);
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') scrub.set(scrub.percent + step);
    else if (e.key === 'Home') scrub.set(0);
    else if (e.key === 'End') scrub.set(100);
    else if (e.key === 'Enter' || e.key === 'Escape') scrub.reset();
    else return;
    e.preventDefault();
  };

  return (
    <div
      className={`plot${className ? ` ${className}` : ''}`}
      style={style}
      data-track
      onPointerDown={scrub.onPointerDown}
      onPointerMove={(e) => {
        scrub.onPointerMove(e);
        if (e.pointerType !== 'touch') {
          const r = e.currentTarget.getBoundingClientRect();
          setHover(clamp(((e.clientX - r.left) / r.width) * 100, 0, 100));
        }
      }}
      onPointerUp={scrub.onPointerUp}
      onPointerCancel={scrub.onPointerUp}
      onPointerLeave={() => setHover(null)}
      {...(keyboard
        ? {
            role: 'slider',
            tabIndex: 0,
            'aria-label': label,
            'aria-valuemin': 0,
            'aria-valuemax': 100,
            'aria-valuenow': Math.round(scrub.percent),
            'aria-valuetext': formatClock(lineTime, timezone, is24Hour),
            onKeyDown,
          }
        : { 'aria-label': label, role: 'img' })}
    >
      {children}

      {showHover && <span className="hover-guide" style={{ left: `${hover}%` }} aria-hidden="true" />}

      <div className={`now-line${live ? (preview ? ' is-ghost' : '') : ' is-scrubbed'}`} style={{ left: `${scrub.percent}%` }} aria-hidden="true">
        <span className={`now-tag${scrub.percent > 94 ? ' at-end' : scrub.percent < 6 ? ' at-start' : ''}`}>{live && !preview ? 'now' : formatClock(lineTime, timezone, is24Hour)}</span>
      </div>

      {showHover && (
        <div className={`tip plot-tip${hover! > 55 ? ' left' : ''}`} style={{ left: `${hover}%` }} aria-hidden="true">
          <div className="tip-time">{formatClock(dayStart + hoverHour * 3_600_000, timezone, is24Hour)}</div>
          {tip!(hoverHour)}
        </div>
      )}
    </div>
  );
}

interface TubeProps {
  /** marker position, % of the drawing area from the top */
  y: number;
  /** extent of the scale, % from the top */
  top: number;
  bottom: number;
  className: string;
  marker: string;
  ticks: { y: number; label?: string; end?: boolean }[];
  /** labels placed independently of the notches (e.g. centred in each band) */
  labels?: { y: number; label: string }[];
  moving: boolean;
}

/**
 * A vertical scale in a chart's gutter: a gradient tube with labelled ticks and a knob that
 * follows the shared time line, so the value under the line reads at a glance.
 */
export function Tube({ y, top, bottom, className, marker, ticks, labels = [], moving }: TubeProps) {
  return (
    <div className={`tube ${className}`} aria-hidden="true">
      <span className="tube-body" style={{ top: `${top}%`, bottom: `${100 - bottom}%` }} />
      {ticks.map((t) => (
        <span key={t.y} className={`tube-tick${t.end ? ' end' : ''}`} style={{ top: `${t.y}%` }}>
          {t.label && <span className="tube-label">{t.label}</span>}
        </span>
      ))}
      {labels.map((l) => (
        <span key={l.label} className="tube-tick end" style={{ top: `${l.y}%` }}>
          <span className="tube-label">{l.label}</span>
        </span>
      ))}
      <span className={`tube-knob ${marker}${moving ? ' is-moving' : ''}`} style={{ top: `${y}%` }} />
    </div>
  );
}
