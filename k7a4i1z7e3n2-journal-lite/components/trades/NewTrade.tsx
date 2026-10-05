'use client';

import { useEffect, useMemo, useState } from 'react';
import { Lock } from 'lucide-react';
import { createTrade, friendly, updateTrade } from '@/lib/api';
import { forexDay } from '@/lib/journal';
import { PACE_HINT, PACE_LABEL, pacePatch, type PaceOrNone } from '@/lib/pace';
import { COMMON_PAIRS, normalizePair } from '@/lib/pairs';
import { uploadAll } from '@/lib/upload';
import type { Pending } from '@/lib/images';
import { pairError, riskError, textError, TEXT_MAX } from '@/lib/validate';
import type { TradeType } from '@/lib/types';
import { useJournal } from '../JournalContext';
import { useToast } from '../ui/Toast';
import Modal from '../ui/Modal';
import Seg from '../ui/Seg';
import MarketIcon from '../ui/MarketIcon';
import Dropzone from './Dropzone';
import { PaceSeg } from './bits';

const TYPE_HINT: Record<TradeType, string> = {
  NORMAL: 'A real trade you took.',
  DEMO: 'Practice on a demo account. It stays out of real-trading rules.',
  MISSED: 'A setup you saw but didn’t take. Saved as a profit at this R, for the record.',
};

const pad = (n: number) => String(n).padStart(2, '0');
const localInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

export default function NewTrade({ open, onClose }: { open: boolean; onClose: () => void }) {
  const j = useJournal();
  const toast = useToast();
  const [type, setType] = useState<TradeType>('NORMAL');
  const [pair, setPair] = useState('');
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
    setRisk('');
    setNotes('');
    setPace(null);
    setWhen('now');
    setAt(localInput(new Date()));
    setImages([]);
    setImageProblem(null);
    setTried(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pairs = useMemo(() => [...new Set([...j.trades.map((t) => t.pair), ...COMMON_PAIRS])], [j.trades]);

  const when_ = when === 'earlier' && at ? new Date(at) : new Date();
  const dated = when === 'earlier' && at ? when_ : null;
  const atError = when === 'earlier' && (!at || Number.isNaN(when_.getTime())) ? 'Pick when it happened.' : dated && dated > new Date() ? 'That’s in the future.' : null;
  // locks apply to entries for the current forex day, not to logging the past
  const lock = forexDay(when_) === j.today?.day ? j.blocked[type] : undefined;

  const errors = {
    pair: pairError(normalizePair(pair)),
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
        pair: normalizePair(pair),
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
              <label htmlFor="nt-pair">Pair</label>
              <div className="input-icon">
                {pair && !errors.pair && <MarketIcon symbol={normalizePair(pair)} size={18} />}
                <input
                  id="nt-pair"
                  className="input"
                  list="nt-pairs"
                  value={pair}
                  onChange={(e) => setPair(e.target.value.toUpperCase())}
                  placeholder="EURUSD"
                  autoComplete="off"
                  spellCheck={false}
                  data-autofocus
                  aria-invalid={!!show('pair')}
                  maxLength={20}
                />
              </div>
              <datalist id="nt-pairs">
                {pairs.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
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
            <div className="when-row">
              <Seg
                label="When"
                value={when}
                onChange={setWhen}
                options={[
                  { value: 'now', label: 'Now' },
                  { value: 'earlier', label: 'Earlier' },
                ]}
              />
              {when === 'earlier' && (
                <input
                  type="datetime-local"
                  className="input fade-in"
                  value={at}
                  max={localInput(new Date())}
                  onChange={(e) => setAt(e.target.value)}
                  aria-label="When it happened"
                  aria-invalid={!!show('at')}
                />
              )}
            </div>
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
    </Modal>
  );
}
