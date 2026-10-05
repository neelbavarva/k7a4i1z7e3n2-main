'use client';

import { useEffect, useState } from 'react';
import { addDays, dayKey, fmtDay, parseDay } from '@/lib/journal';
import { useJournal } from '../JournalContext';
import { useToast } from '../ui/Toast';
import Modal from '../ui/Modal';

/** Batman Mode: block real and missed entries until a chosen day. Kept in this browser. */
export default function BatmanDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const j = useJournal();
  const toast = useToast();
  const tomorrow = dayKey(addDays(new Date(), 1));
  const [until, setUntil] = useState('');

  useEffect(() => {
    if (open) setUntil(j.batman || dayKey(addDays(new Date(), 7)));
  }, [open, j.batman]);

  const valid = until >= tomorrow;

  const turnOn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    j.setBatman(until);
    toast('success', 'Batman Mode is on', `Real and missed entries are blocked until ${fmtDay(parseDay(until))}.`);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Batman Mode" sub="Step back from real trading for a while. Demo stays open.">
      <form className="modal-body" onSubmit={turnOn}>
        <div className="field">
          <label htmlFor="bm-until">Back on</label>
          <input id="bm-until" type="date" className="input" min={tomorrow} value={until} onChange={(e) => setUntil(e.target.value)} required />
          <span className="field-hint">Real and missed entries unlock at the start of this day. Saved in this browser only.</span>
          {!valid && until && <span className="form-error">Pick a day after today.</span>}
        </div>
        <div className="form-foot">
          {j.batman && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                j.setBatman(null);
                toast('success', 'Batman Mode is off');
                onClose();
              }}
            >
              Turn off now
            </button>
          )}
          <button type="submit" className="btn btn-primary btn-grow" disabled={!valid}>
            {j.batman ? 'Update return date' : 'Turn on'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
