'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from '@/components/ui/icons';

export type Reading = { label: string; detail: string; tone: 'up' | 'down' | 'flat' };
export type ReadingColumn = { id: string; long: string; short: string };
export type ReadingRow = { country: string; name: string; color: string; cells: (Reading | null)[] };

/** Up to this many readings sit inline next to the chart title; more open from a button. */
const INLINE_MAX = 2;

function Value({ cell }: { cell: Reading }) {
  return (
    <span className={`reading ${cell.tone}`}>
      <b>{cell.label}</b>
      {cell.detail && <span>{cell.detail}</span>}
    </span>
  );
}

/**
 * Where each market's latest year stands against its own history, in the chart header:
 * one or two readings inline, otherwise a summary button that opens the full table.
 */
export function Readings({ columns, rows }: { columns: ReadingColumn[]; rows: ReadingRow[] }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const cells = rows.flatMap(row => row.cells.map((cell, i) => ({ row, column: columns[i], cell })));
  const filled = cells.filter((c): c is typeof c & { cell: Reading } => c.cell !== null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => anchor.current && !anchor.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  if (!filled.length) return null;

  if (cells.length <= INLINE_MAX) {
    return (
      <ul className="readings-inline" aria-label="Latest year in range, against each market’s own history">
        {filled.map(({ row, column, cell }) => (
          <li key={`${row.country}-${column.id}`} title={`${row.name}: ${column.long}`}>
            <span className="readings-who">
              <i className="dot" style={{ backgroundColor: row.color }} />
              {row.name}
              {columns.length > 1 && <span className="muted">{column.short}</span>}
            </span>
            <Value cell={cell} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="pop-anchor readings-anchor" ref={anchor}>
      <button type="button" className="btn btn-sm readings-btn" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(o => !o)}>
        Readings
        {/* one dot per reading, grouped by view and coloured by which way it leans: the gist before opening */}
        <span className="readings-dots" aria-hidden="true">
          {columns.map((column, ci) => (
            <span key={column.id}>
              {rows.slice(0, 8).map(row => {
                const cell = row.cells[ci];
                return cell && <i key={row.country} className={cell.tone} />;
              })}
            </span>
          ))}
        </span>
        <ChevronDown className="chev" />
      </button>
      {open && (
        <div className="pop readings-pop" role="dialog" aria-label="Readings">
          <div className="pop-title">
            <b>Where each market stands</b>
          </div>
          <p className="pop-foot muted" style={{ marginTop: 4 }}>
            Latest year in range, against each market’s own history.
          </p>
          <div className="readings-scroll">
            <table className="t">
              <thead>
                <tr>
                  <th>Market</th>
                  {columns.map(c => (
                    <th key={c.id}>{columns.length > 1 ? c.short : c.long}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.country}>
                    <td>
                      <span className="cell-market strong">
                        <i className="dot" style={{ backgroundColor: row.color }} />
                        {row.name}
                      </span>
                    </td>
                    {row.cells.map((cell, i) => (
                      <td key={columns[i].id}>{cell ? <Value cell={cell} /> : <span className="muted">No data</span>}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
