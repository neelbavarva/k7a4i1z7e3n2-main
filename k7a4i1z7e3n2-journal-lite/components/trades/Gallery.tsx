'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Pencil, Trash2, Check, X } from 'lucide-react';
import { deleteImage, friendly, renameImage } from '@/lib/api';
import type { Pending } from '@/lib/images';
import { uploadAll } from '@/lib/upload';
import { NAME_MAX } from '@/lib/validate';
import type { TradeImage } from '@/lib/types';
import { useToast } from '../ui/Toast';
import Modal from '../ui/Modal';
import Dropzone from './Dropzone';

/** A trade's screenshots: view full screen, rename, delete, and add more. */
export default function Gallery({
  tradeId,
  title,
  images,
  onImages,
  onBusy,
}: {
  tradeId: string;
  title: string;
  images: TradeImage[];
  onImages: (next: TradeImage[]) => void;
  onBusy: (busy: boolean) => void;
}) {
  const toast = useToast();
  const [viewing, setViewing] = useState<number | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [working, setWorking] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<TradeImage | null>(null);

  useEffect(() => onBusy(!!uploading || !!working), [uploading, working, onBusy]);

  const saveName = async (img: TradeImage) => {
    const n = name.trim();
    if (!n || n === img.name) return setEditing(null);
    setWorking(img.id);
    try {
      const updated = await renameImage(img.id, n.slice(0, NAME_MAX));
      onImages(images.map((x) => (x.id === img.id ? { ...x, ...updated } : x)));
      setEditing(null);
    } catch (e) {
      toast('error', 'Couldn’t rename it', friendly(e));
    } finally {
      setWorking(null);
    }
  };

  const remove = async (img: TradeImage) => {
    setWorking(img.id);
    try {
      await deleteImage(img.id);
      onImages(images.filter((x) => x.id !== img.id));
      setConfirm(null);
      toast('success', 'Screenshot deleted');
    } catch (e) {
      toast('error', 'Couldn’t delete it', friendly(e));
    } finally {
      setWorking(null);
    }
  };

  const upload = async () => {
    if (!pending.length) return;
    setUploading(`Uploading 1 of ${pending.length}…`);
    const { uploaded, failed } = await uploadAll(tradeId, pending, (done) => done < pending.length && setUploading(`Uploading ${done + 1} of ${pending.length}…`));
    onImages([...images, ...uploaded]);
    pending.forEach((p) => URL.revokeObjectURL(p.preview));
    setPending([]);
    setUploading(null);
    if (failed.length) toast('error', 'Some screenshots didn’t upload', failed.join('\n'));
    else toast('success', uploaded.length === 1 ? 'Screenshot added' : `${uploaded.length} screenshots added`);
  };

  const shown = viewing != null ? images[viewing] : null;

  return (
    <section>
      <div className="section-title">
        <h3>Screenshots</h3>
        <span>{images.length ? 'Choose one to see it full screen' : 'None yet'}</span>
      </div>

      {images.length > 0 && (
        <ul className="shots">
          {images.map((img, i) => (
            <li key={img.id} className="shot fade-in">
              <button type="button" className="shot-view" onClick={() => setViewing(i)} aria-label={`View ${img.name} full screen`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" loading="lazy" />
                <Maximize2 className="shot-zoom" aria-hidden="true" />
              </button>
              {editing === img.id ? (
                <form
                  className="shot-cap"
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveName(img);
                  }}
                >
                  <input
                    className="input input-sm"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={NAME_MAX}
                    autoFocus
                    aria-label="Screenshot name"
                    data-own-escape
                    onKeyDown={(e) => e.key === 'Escape' && setEditing(null)}
                    disabled={working === img.id}
                  />
                  <button type="submit" className="btn btn-ghost btn-icon btn-sm" aria-label="Save name" disabled={working === img.id}>
                    <Check />
                  </button>
                </form>
              ) : (
                <div className="shot-cap">
                  <span className="shot-name" title={img.name}>
                    {img.name}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon btn-sm"
                    aria-label={`Rename ${img.name}`}
                    onClick={() => {
                      setEditing(img.id);
                      setName(img.name);
                    }}
                  >
                    <Pencil />
                  </button>
                  <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`Delete ${img.name}`} onClick={() => setConfirm(img)}>
                    <Trash2 />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="gallery-add">
        <Dropzone items={pending} onChange={setPending} onProblem={setProblem} disabled={!!uploading} />
        {problem && <span className="form-error">{problem}</span>}
        {pending.length > 0 && (
          <button type="button" className={`btn btn-primary${uploading ? ' is-busy' : ''}`} onClick={upload} disabled={!!uploading}>
            {uploading || `Upload ${pending.length} screenshot${pending.length === 1 ? '' : 's'}`}
          </button>
        )}
      </div>

      <Modal open={!!shown} onClose={() => setViewing(null)} className="viewer" label={shown ? `${title}: ${shown.name}` : ''} head={false}>
        {shown && (
          <div
            className="viewer-in"
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') setViewing((v) => (v! + 1) % images.length);
              if (e.key === 'ArrowLeft') setViewing((v) => (v! - 1 + images.length) % images.length);
            }}
            tabIndex={-1}
          >
            <div className="viewer-bar">
              <span>
                <b>{title}</b> · {shown.name}
                {images.length > 1 && (
                  <span className="muted">
                    {' '}
                    · {viewing! + 1} of {images.length}
                  </span>
                )}
              </span>
              <button type="button" className="btn btn-ghost btn-icon" onClick={() => setViewing(null)} aria-label="Close" data-autofocus>
                <X />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="viewer-img" src={shown.url} alt={shown.name} />
            {images.length > 1 && (
              <>
                <button type="button" className="viewer-nav prev" onClick={() => setViewing((v) => (v! - 1 + images.length) % images.length)} aria-label="Previous">
                  <ChevronLeft />
                </button>
                <button type="button" className="viewer-nav next" onClick={() => setViewing((v) => (v! + 1) % images.length)} aria-label="Next">
                  <ChevronRight />
                </button>
              </>
            )}
          </div>
        )}
      </Modal>

      <Modal open={!!confirm} onClose={() => setConfirm(null)} busy={!!working} title="Delete this screenshot?" sub={confirm?.name}>
        <div className="modal-body">
          <p className="muted">It’s removed from the trade and from storage. This can’t be undone.</p>
          <div className="form-foot">
            <button type="button" className="btn" onClick={() => setConfirm(null)} disabled={!!working}>
              Keep it
            </button>
            <button type="button" className="btn btn-danger btn-grow" onClick={() => confirm && remove(confirm)} disabled={!!working}>
              {working ? 'Deleting…' : 'Delete screenshot'}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
