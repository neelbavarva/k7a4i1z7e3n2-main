'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Clock, History, Lock } from 'lucide-react';
import { createTrade, friendly, updateTrade } from '@/lib/api';
import { dayKey, fmtDay, fmtTime, forexDay, localStamp, parseDay } from '@/lib/journal';
import { PACE_HINT, PACE_LABEL, pacePatch, type PaceOrNone } from '@/lib/pace';
import { PAIRS } from '@/lib/pairs';
import { uploadAll } from '@/lib/upload';
import type { Pending } from '@/lib/images';
import { pairError, riskError, textError, TEXT_MAX } from '@/lib/validate';
import type { TradeType } from '@/lib/types';
import { useJournal } from '../JournalContext';
import { useNow } from '../hooks';
import { useToast } from '../ui/Toast';
import Modal from '../ui/Modal';
import Seg from '../ui/Seg';
import MarketIcon from '../ui/MarketIcon';
import PairPicker from '../ui/PairPicker';
import DateTimePicker from '../ui/DateTimePicker';
import Dropzone from './Dropzone';
import { PaceSeg } from './bits';

const TYPE_HINT: Record<TradeType, string> = {
  NORMAL: 'A real trade you took.',
  DEMO: 'Practice on a demo account. It stays out of real-trading rules.',
  MISSED: 'A setup you saw but didn’t take. Saved as a profit at this R, for the record.',
};

export default function NewTrade({ open, onClose }: { open: boolean; onClose: () => void }) {
  const j = useJournal();
  const toast = useToast();
  const [type, setType] = useState<TradeType>('NORMAL');
  const [pair, setPair] = useState('');
  // the pair picker, and the key typed on the pair button that opened it
  const [picking, setPicking] = useState<string | null>(null);
  const [risk, setRisk] = useState('');
  const [notes, setNotes] = useState('');
  const [pace, setPace] = useState<PaceOrNone>(null);
  const [when, setWhen] = useState<'now' | 'earlier'>('now');
  const [at, setAt] = useState('');
  const [images, setImages] = useState<Pending[]>([]);
  const [imageProblem, setImageProblem] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setType(j.blocked.NORMAL ? 'DEMO' : 'NORMAL');
    setPair('');
    setPicking(null);
    setRisk('');
    setNotes('');
    setPace(null);
    setWhen('now');
    setAt(localStamp(new Date()));
    setImages([]);
    setImageProblem(null);
    setTried(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const clock = useNow(15000);
  // trades per local day, for the dots on the date picker
  const perDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of j.trades) {
      const k = dayKey(new Date(t.createdAt));
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [j.trades]);

  const when_ = when === 'earlier' && at ? new Date(at) : new Date();
  const dated = when === 'earlier' && at ? when_ : null;
  const atError = when === 'earlier' && (!at || Number.isNaN(when_.getTime())) ? 'Pick when it happened.' : dated && dated > new Date() ? 'That’s in the future.' : null;
  // locks apply to entries for the current forex day, not to logging the past
  const lock = forexDay(when_) === j.today?.day ? j.blocked[type] : undefined;

  const errors = {
    pair: pairError(pair),
    risk: riskError(risk),
    notes: textError(notes),
    at: atError,
  };
  const invalid = Object.values(errors).some(Boolean);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (invalid || lock || busy) return;
    setError(null);
    setBusy('Saving…');
    try {
      let trade = await createTrade({
        pair,
        riskRatio: Number(risk),
        tradeType: type,
        description: notes.trim() || null,
        ...(dated ? { createdAt: dated.toISOString() } : {}),
      });
      // the API takes the pace only on an update, so it goes on straight after
      if (pace) {
        try {
          trade = await updateTrade(trade.id, pacePatch(pace));
        } catch {
          toast('error', `Saved without the ${PACE_LABEL[pace].toLowerCase()} mark`, 'Open the trade to mark its pace again.');
        }
      }
      j.applyTrade(trade);
      if (images.length) {
        setBusy(`Uploading 1 of ${images.length}…`);
        const { failed } = await uploadAll(trade.id, images, (done) => done < images.length && setBusy(`Uploading ${done + 1} of ${images.length}…`));
        if (failed.length) toast('error', 'Some screenshots didn’t upload', failed.join('\n'));
      }
      toast('success', `${trade.pair} saved`, type === 'MISSED' ? 'Logged as a missed profit.' : type === 'DEMO' ? 'Demo trade logged.' : 'It’s in your open trades.');
      setBusy(null);
      onClose();
    } catch (err) {
      setError(friendly(err));
      setBusy(null);
    }
  };

  const show = (k: keyof typeof errors) => (tried ? errors[k] : null);

  return (
    <Modal open={open} onClose={onClose} busy={!!busy} title="New trade" sub="Log it now; close it as a profit or loss later.">
      <form className="modal-body" onSubmit={submit} noValidate>
        <fieldset className="bare form" disabled={!!busy}>
          <div className="field">
            <span className="field-label" id="nt-type">
              Type
            </span>
            <Seg
              wide
              label="Trade type"
              value={type}
              onChange={setType}
              options={(['NORMAL', 'DEMO', 'MISSED'] as const).map((t) => ({
                value: t,
                label: t === 'NORMAL' ? 'Real' : t === 'DEMO' ? 'Demo' : 'Missed',
                icon: forexDay(when_) === j.today?.day && j.blocked[t] ? <Lock className="seg-lock" aria-hidden="true" /> : undefined,
              }))}
            />
            <span className="field-hint">{TYPE_HINT[type]}</span>
          </div>

          {lock && (
            <div className="notice is-locked fade-in" role="alert">
              <Lock aria-hidden="true" />
              <p>{lock}</p>
            </div>
          )}

          <div className="form-grid">
            <div className="field">
              <span className="field-label" id="nt-pair-label">
                Pair
              </span>
              <button
                type="button"
                className="btn pair-btn pair-field"
                onClick={() => setPicking('')}
                onKeyDown={(e) => {
                  // typing on the button opens the picker already searching for that key
                  if (e.key.length === 1 && /[a-z0-9]/i.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) setPicking(e.key);
                  else if (e.key === 'ArrowDown') setPicking('');
                  else return;
                  e.preventDefault();
                }}
                aria-haspopup="dialog"
                aria-labelledby="nt-pair-label nt-pair-value"
                aria-invalid={!!show('pair')}
                data-autofocus
              >
                {pair && <MarketIcon symbol={pair} size={18} />}
                <span id="nt-pair-value" className={`pair-field-text${pair ? '' : ' muted'}`}>
                  {pair || 'Choose a pair'}
                </span>
                <ChevronDown className="chev" aria-hidden="true" />
              </button>
              {show('pair') && <span className="form-error">{errors.pair}</span>}
            </div>
            <div className="field">
              <label htmlFor="nt-risk">Risk ratio (R)</label>
              <div className="input-affix">
                <span aria-hidden="true">1 :</span>
                <input
                  id="nt-risk"
                  className="input num-tab"
                  inputMode="decimal"
                  value={risk}
                  onChange={(e) => setRisk(e.target.value.replace(',', '.'))}
                  placeholder="2.5"
                  autoComplete="off"
                  aria-invalid={!!show('risk')}
                />
              </div>
              {show('risk') ? <span className="form-error">{errors.risk}</span> : <span className="field-hint">A win pays this many R; a loss costs 1R.</span>}
            </div>
          </div>

          <div className="field">
            <span className="field-label">Pace</span>
            <PaceSeg wide value={pace} onChange={setPace} />
            <span className="field-hint">{PACE_HINT[pace ?? 'NONE']} You can change it later.</span>
          </div>

          <div className="field">
            <label htmlFor="nt-notes">Notes</label>
            <textarea
              id="nt-notes"
              className="textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="The setup, why you took it, where the stop and target sit"
              maxLength={TEXT_MAX}
            />
            {show('notes') && <span className="form-error">{errors.notes}</span>}
          </div>

          <div className="field">
            <span className="field-label">When</span>
            <Seg
              wide
              className="when-seg"
              label="When"
              value={when}
              onChange={setWhen}
              options={[
                { value: 'now', label: 'Now', icon: <Clock aria-hidden="true" /> },
                { value: 'earlier', label: 'Earlier', icon: <History aria-hidden="true" /> },
              ]}
            />
            {when === 'now' ? (
              <span className="field-hint">
                Stamped with the moment you save{clock && <>: {fmtDay(clock)}, {fmtTime(clock)} · forex day {fmtDay(parseDay(forexDay(clock)))}</>}.
              </span>
            ) : (
              <DateTimePicker value={at} onChange={setAt} now={clock ?? new Date()} counts={perDay} invalid={!!show('at')} />
            )}
            {show('at') && <span className="form-error">{errors.at}</span>}
          </div>

          <div className="field">
            <span className="field-label">Screenshots</span>
            <Dropzone items={images} onChange={setImages} onProblem={setImageProblem} disabled={!!busy} />
            {imageProblem && <span className="form-error">{imageProblem}</span>}
          </div>
        </fieldset>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className={`btn btn-primary btn-block${busy ? ' is-busy' : ''}`} disabled={!!busy || !!lock}>
          {busy || (type === 'MISSED' ? 'Log missed setup' : type === 'DEMO' ? 'Log demo trade' : 'Log trade')}
        </button>
      </form>

      <PairPicker open={picking !== null} onClose={() => setPicking(null)} pairs={PAIRS} value={pair} onPick={setPair} seed={picking ?? ''} />
    </Modal>
  );
}
