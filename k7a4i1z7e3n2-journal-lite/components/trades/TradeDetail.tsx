'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Pencil, RotateCcw, TrendingDown, TrendingUp, X } from 'lucide-react';
import { deleteTrade, friendly, getTrade, updateTrade, type TradePatch } from '@/lib/api';
import { TYPE_LABEL, fmtDateTime, fmtPct, fmtR, fmtRatio, isOpen, rOf, sideOf } from '@/lib/journal';
import { FUND_LABEL, fundHint, fundOf, fundPatch } from '@/lib/fundamentals';
import { PACE_HINT, PACE_LABEL, ON_PACE, pacePatch, paceOf } from '@/lib/pace';
import { riskError, TEXT_MAX } from '@/lib/validate';
import type { Trade, TradeImage } from '@/lib/types';
import { useJournal } from '../JournalContext';
import { useToast } from '../ui/Toast';
import Notes from '../ui/Notes';
import Modal from '../ui/Modal';
import MarketIcon, { PairText } from '../ui/MarketIcon';
import { Marks, PaceSeg, PaceTag, TypeTag } from './bits';
import Gallery from './Gallery';

export default function TradeDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const j = useJournal();
  const fromList = id ? j.trades.find((t) => t.id === id) || null : null;
  const [trade, setTrade] = useState<Trade | null>(null);
  const [images, setImages] = useState<TradeImage[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [galleryBusy, setGalleryBusy] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async (tradeId: string) => {
    setLoadError(null);
    try {
      const d = await getTrade(tradeId);
      const { images: imgs, ...rest } = d;
      setTrade(rest);
      setImages(imgs || []);
    } catch (e) {
      setLoadError(friendly(e));
    }
  }, []);

  useEffect(() => {
    setTrade(null);
    setImages(null);
    setSaving(null);
    if (id) load(id);
  }, [id, load]);

  const t = trade || fromList;
  if (!id) return null;

  return (
    <Modal
      open={!!id}
      onClose={onClose}
      wide
      busy={!!saving || galleryBusy}
      className="trade-dialog"
      icon={t ? <MarketIcon symbol={t.pair} size={40} /> : undefined}
      title={t ? <PairText symbol={t.pair} /> : 'Trade'}
      sub={
        t && (
          <span className="sub-line">
            <TypeTag type={t.tradeType} />
            <span>{isOpen(t) ? 'Open' : t.status === 'PROFIT' ? 'Closed in profit' : 'Closed at a loss'}</span>
            <PaceTag pace={paceOf(t)} />
            <Marks t={t} pace={false} />
          </span>
        )
      }
    >
      {!t ? (
        loadError ? (
          <div className="modal-body">
            <p className="form-error" role="alert">
              {loadError}
            </p>
            <button type="button" className="btn" onClick={() => load(id)}>
              Try again
            </button>
          </div>
        ) : (
          <div className="modal-body skeleton" aria-busy="true">
            <div className="sk sk-facts" />
            <div className="sk sk-line" />
          </div>
        )
      ) : (
        <Body
          key={t.id}
          t={t}
          images={images}
          loadError={loadError}
          saving={saving}
          setSaving={setSaving}
          onTrade={(next) => {
            setTrade(next);
            j.applyTrade(next);
          }}
          onImages={setImages}
          onGalleryBusy={setGalleryBusy}
          onDeleted={() => {
            j.dropTrade(t.id);
            onClose();
          }}
          retry={() => load(t.id)}
        />
      )}
    </Modal>
  );
}

function Body({
  t,
  images,
  loadError,
  saving,
  setSaving,
  onTrade,
  onImages,
  onGalleryBusy,
  onDeleted,
  retry,
}: {
  t: Trade;
  images: TradeImage[] | null;
  loadError: string | null;
  saving: string | null;
  setSaving: (s: string | null) => void;
  onTrade: (t: Trade) => void;
  onImages: (i: TradeImage[]) => void;
  onGalleryBusy: (b: boolean) => void;
  onDeleted: () => void;
  retry: () => void;
}) {
  const toast = useToast();
  const [notes, setNotes] = useState(t.description || '');
  const [editRisk, setEditRisk] = useState(false);
  const [risk, setRisk] = useState(String(t.riskRatio));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = async (key: string, body: TradePatch, done?: string) => {
    setSaving(key);
    setError(null);
    try {
      const next = await updateTrade(t.id, body);
      onTrade(next);
      if (done) toast('success', done);
      return true;
    } catch (e) {
      setError(friendly(e));
      return false;
    } finally {
      setSaving(null);
    }
  };

  const remove = async () => {
    setSaving('delete');
    try {
      await deleteTrade(t.id);
      toast('success', `${t.pair} deleted`, 'The trade and its screenshots are gone.');
      setSaving(null);
      onDeleted();
    } catch (e) {
      setError(friendly(e));
      setSaving(null);
      setConfirmDelete(false);
    }
  };

  const open = isOpen(t);
  const pace = paceOf(t);
  const r = rOf(t);
  const riskProblem = riskError(risk);
  const busy = !!saving;

  return (
    <div className="modal-body">
      <dl className="brief three trade-facts">
        <div className="brief-cell">
          <dt>Result</dt>
          <dd className={`brief-num sm ${open ? '' : sideOf(r)}`}>{open ? <span className="muted">Open</span> : fmtR(r)}</dd>
          <dd className="brief-sub">{open ? `Win pays ${fmtR(t.riskRatio)}` : `${fmtPct(r * 100)} of risk`}</dd>
        </div>
        <div className="brief-cell">
          <dt>Risk ratio</dt>
          {editRisk ? (
            <dd>
              <form
                className="inline-edit"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (riskProblem) return;
                  if (await patch('risk', { riskRatio: Number(risk) }, 'Risk ratio updated')) setEditRisk(false);
                }}
              >
                <input
                  className="input input-sm num-tab"
                  inputMode="decimal"
                  value={risk}
                  onChange={(e) => setRisk(e.target.value.replace(',', '.'))}
                  autoFocus
                  aria-label="Risk ratio"
                  aria-invalid={!!riskProblem}
                  data-own-escape
                  onKeyDown={(e) => e.key === 'Escape' && setEditRisk(false)}
                  disabled={busy}
                />
                <button type="submit" className="btn btn-icon btn-sm" aria-label="Save risk ratio" disabled={busy || !!riskProblem}>
                  <Check />
                </button>
                <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Cancel" onClick={() => setEditRisk(false)} disabled={busy}>
                  <X />
                </button>
              </form>
              {riskProblem && <span className="form-error">{riskProblem}</span>}
            </dd>
          ) : (
            <dd className="brief-num sm with-edit">
              {fmtRatio(t.riskRatio)}
              <button
                type="button"
                className="btn btn-ghost btn-icon btn-sm"
                aria-label="Edit risk ratio"
                onClick={() => {
                  setRisk(String(t.riskRatio));
                  setEditRisk(true);
                }}
                disabled={busy}
              >
                <Pencil />
              </button>
            </dd>
          )}
        </div>
        <div className="brief-cell">
          <dt>Dates</dt>
          <dd className="brief-dates">
            <span>
              <span className="muted">Added</span> {fmtDateTime(t.createdAt)}
            </span>
            <span>
              <span className="muted">Closed</span> {open ? '—' : fmtDateTime(t.closedAt)}
            </span>
          </dd>
        </div>
      </dl>

      {open ? (
        <div className="outcome">
          <button type="button" className={`btn outcome-win${saving === 'win' ? ' is-busy' : ''}`} onClick={() => patch('win', { status: 'PROFIT' }, `${t.pair} closed in profit`)} disabled={busy}>
            <TrendingUp aria-hidden="true" />
            Close as profit <b>{fmtR(t.riskRatio)}</b>
          </button>
          <button type="button" className={`btn outcome-loss${saving === 'loss' ? ' is-busy' : ''}`} onClick={() => patch('loss', { status: 'LOSS' }, `${t.pair} closed at a loss`)} disabled={busy}>
            <TrendingDown aria-hidden="true" />
            Close as loss <b>{fmtR(-1)}</b>
          </button>
        </div>
      ) : (
        <div className="outcome is-closed">
          <p>
            {t.tradeType === 'MISSED' ? 'A missed setup, counted as a profit for analysis.' : `Closed ${t.status === 'PROFIT' ? 'in profit' : 'at a loss'} on ${fmtDateTime(t.closedAt)}.`}
          </p>
          <button type="button" className="btn btn-sm" onClick={() => patch('reopen', { status: 'OPEN' }, `${t.pair} reopened`)} disabled={busy}>
            <RotateCcw aria-hidden="true" />
            Reopen
          </button>
        </div>
      )}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <section>
        <div className="section-title">
          <h3>Review</h3>
          <span>How you handled it</span>
        </div>
        <ul className="review">
          <li className={`review-row pace-row p-${pace ? pace.toLowerCase() : 'none'}`}>
            <div>
              <b>Pace</b>
              <span>{PACE_HINT[pace ?? 'NONE']}</span>
            </div>
            <PaceSeg
              value={pace}
              onChange={(p) => p !== pace && patch('pace', pacePatch(p), p ? `Marked as ${PACE_LABEL[p].toLowerCase()}` : `Marked ${ON_PACE.toLowerCase()}`)}
              disabled={busy}
            />
          </li>
          <li className={`review-row fund-row${fundOf(t) ? ' is-on' : ''}`}>
            <div>
              <b>{FUND_LABEL}</b>
              <span>{fundHint(fundOf(t))}</span>
            </div>
            <Switch
              label={FUND_LABEL}
              on={!!fundOf(t)}
              onChange={(v) => patch('fund', fundPatch(v), v ? 'Marked as backed by fundamentals' : 'Marked as chart only')}
              disabled={busy}
            />
          </li>
          {!open && (
            <li className="review-row">
              <div>
                <b>Would’ve hit TP</b>
                <span>A winner you sabotaged: it reached the target after you interfered.</span>
              </div>
              <Switch label="Would’ve hit TP" on={t.sabotagedWinner} onChange={(v) => patch('sab', { sabotagedWinner: v })} disabled={busy} />
            </li>
          )}
        </ul>
      </section>

      <section>
        <div className="section-title">
          <h3>Notes</h3>
          <span>Thesis and review</span>
        </div>
        <Notes
          value={notes}
          onChange={setNotes}
          placeholder="What happened, what you’d repeat, what you wouldn’t"
          prompts={['What happened', 'Repeat', 'Avoid']}
          max={TEXT_MAX}
          label="Notes"
          disabled={busy}
        />
        {notes.trim() !== (t.description || '') && (
          <div className="save-row fade-in">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNotes(t.description || '')} disabled={busy}>
              Discard
            </button>
            <button type="button" className={`btn btn-primary btn-sm${saving === 'notes' ? ' is-busy' : ''}`} onClick={() => patch('notes', { description: notes.trim() || null }, 'Notes saved')} disabled={busy}>
              Save notes
            </button>
          </div>
        )}
      </section>

      {images ? (
        <Gallery tradeId={t.id} title={t.pair} images={images} onImages={onImages} onBusy={onGalleryBusy} />
      ) : loadError ? (
        <p className="form-error">
          Screenshots didn’t load. <button type="button" className="linkish" onClick={retry}>Try again</button>
        </p>
      ) : (
        <div className="sk sk-shots" aria-label="Loading screenshots" />
      )}

      <section className="danger-row">
        <div>
          <b>Delete this trade</b>
          <span>Removes the trade and every screenshot attached to it.</span>
        </div>
        <button type="button" className="btn btn-sm danger-ghost" onClick={() => setConfirmDelete(true)} disabled={busy}>
          Delete
        </button>
      </section>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} busy={saving === 'delete'} title={`Delete ${t.pair}?`} sub={`${TYPE_LABEL[t.tradeType]} trade added ${fmtDateTime(t.createdAt)}`}>
        <div className="modal-body">
          <p className="muted">The trade and its screenshots are deleted for good. This can’t be undone.</p>
          <div className="form-foot">
            <button type="button" className="btn" onClick={() => setConfirmDelete(false)} disabled={saving === 'delete'}>
              Keep it
            </button>
            <button type="button" className="btn btn-danger btn-grow" onClick={remove} disabled={saving === 'delete'}>
              {saving === 'delete' ? 'Deleting…' : 'Delete trade'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className="switch" onClick={() => onChange(!on)} disabled={disabled}>
      <i aria-hidden="true" />
    </button>
  );
}
