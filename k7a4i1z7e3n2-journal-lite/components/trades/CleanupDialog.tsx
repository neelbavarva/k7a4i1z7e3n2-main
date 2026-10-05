'use client';

import { useEffect, useState } from 'react';
import { cleanup, friendly } from '@/lib/api';
import { useJournal } from '../JournalContext';
import { useToast } from '../ui/Toast';
import Modal from '../ui/Modal';

/** Erase the whole journal. Only runs once DELETE ALL is typed exactly. */
export default function CleanupDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const j = useJournal();
  const toast = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setText('');
      setError(null);
    }
  }, [open]);

  const ready = text === 'DELETE ALL';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await cleanup();
      toast('success', 'Journal erased', `${res.deletedTrades} trades, ${res.deletedImages} images and ${res.deletedBlownWeeks} blown weeks deleted.`);
      j.reload();
      j.reloadBlown();
      j.bump();
      onClose();
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} busy={busy} title="Reset the journal" sub="Every trade, screenshot and blown week is deleted for good.">
      <form className="modal-body" onSubmit={submit}>
        <div className="danger-zone">
          <p>
            This can’t be undone. There is no backup and no trash: {j.trades.length} trade{j.trades.length === 1 ? '' : 's'} and all of their
            screenshots will be gone.
          </p>
        </div>
        <div className="field">
          <label htmlFor="cl-confirm">
            Type <b>DELETE ALL</b> to confirm
          </label>
          <input
            id="cl-confirm"
            className="input mono"
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="DELETE ALL"
            disabled={busy}
          />
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-foot">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Keep my journal
          </button>
          <button type="submit" className="btn btn-danger btn-grow" disabled={!ready || busy}>
            {busy ? 'Erasing…' : 'Erase everything'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
