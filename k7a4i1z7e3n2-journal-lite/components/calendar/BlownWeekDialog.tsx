'use client';

import { useEffect, useState } from 'react';
import { friendly, markBlownWeek, undoBlownWeek } from '@/lib/api';
import { addDays, dayKey, fmtDay, fmtSpan, parseDay, undoDeadline } from '@/lib/journal';
import type { BlownWeek } from '@/lib/types';
import { useJournal } from '../JournalContext';
import { useNow } from '../hooks';
import { useToast } from '../ui/Toast';
import Modal from '../ui/Modal';
import Seg from '../ui/Seg';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Mark a week blown through a chosen day, or undo it within 24 hours. */
export default function BlownWeekDialog({ week, onClose }: { week: string | null; onClose: () => void }) {
  const j = useJournal();
  const toast = useToast();
  const now = useNow(30000);
  const record: BlownWeek | undefined = week ? j.blownWeeks.find((b) => b.week_start.slice(0, 10) === week) : undefined;
  const days = week ? DAY_NAMES.map((_, i) => dayKey(addDays(parseDay(week), i))) : [];
  const [through, setThrough] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!week) return;
    const today = dayKey(new Date());
    setThrough(record?.blown_through.slice(0, 10) || (days.includes(today) ? today : days[4]));
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week]);

  if (!week) return null;

  const left = record && now ? undoDeadline(record) - now.getTime() : 0;
  const canUndo = left > 0;

  const save = async () => {
    setBusy('save');
    setError(null);
    try {
      await markBlownWeek(week, through);
      await j.reloadBlown();
      j.bump();
      toast('success', 'Week marked blown', `No real trading through ${fmtDay(parseDay(through))}. You can undo this for 24 hours.`);
      onClose();
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(null);
    }
  };

  const undo = async () => {
    setBusy('undo');
    setError(null);
    try {
      await undoBlownWeek(week);
      await j.reloadBlown();
      j.bump();
      toast('success', 'Blown week undone');
      onClose();
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(null);
    }
  };

  const monday = parseDay(week);
  return (
    <Modal
      open={!!week}
      onClose={onClose}
      busy={!!busy}
      title={record ? 'Blown week' : 'Mark the week blown'}
      sub={`Week of ${fmtDay(monday)}. A blown week stops real trading through the day you pick.`}
    >
      <div className="modal-body">
        <div className="field">
          <span className="field-label">Blown through</span>
          <Seg wide label="Blown through" value={through} onChange={setThrough} options={days.map((d, i) => ({ value: d, label: DAY_NAMES[i], title: fmtDay(parseDay(d)) }))} />
          <span className="field-hint">
            {through ? `Real entries are blocked from Monday to ${fmtDay(parseDay(through))}.` : ''}
            {record ? ' Saving again restarts the 24-hour undo window.' : ''}
          </span>
        </div>

        {record && (
          <div className={`notice${canUndo ? '' : ' is-muted'}`}>
            <p>
              Blown through <b>{fmtDay(parseDay(record.blown_through))}</b>.{' '}
              {canUndo ? `You can undo this for another ${fmtSpan(left)}.` : 'The 24-hour undo window has passed.'}
            </p>
          </div>
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="form-foot">
          {record && canUndo && (
            <button type="button" className="btn" onClick={undo} disabled={!!busy}>
              {busy === 'undo' ? 'Undoing…' : 'Undo blown week'}
            </button>
          )}
          <button
            type="button"
            className="btn btn-danger btn-grow"
            onClick={save}
            disabled={!!busy || !through || through === record?.blown_through.slice(0, 10)}
          >
            {busy === 'save' ? 'Saving…' : record ? 'Update' : 'Mark blown'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
