import { friendly, uploadImages } from './api';
import { forUpload, type Pending } from './images';
import type { TradeImage } from './types';

/** Upload pending screenshots one at a time; a failed one doesn't stop the rest. */
export async function uploadAll(tradeId: string, items: Pending[], onStep?: (done: number) => void) {
  const uploaded: TradeImage[] = [];
  const failed: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const p = items[i];
    try {
      const { blob, filename } = await forUpload(p.file);
      const res = await uploadImages(tradeId, [{ file: new File([blob], filename, { type: blob.type || p.file.type }), name: p.name.trim() || filename }]);
      uploaded.push(...res);
    } catch (e) {
      failed.push(`${p.name}: ${e instanceof Error && !(e as { code?: string }).code ? e.message : friendly(e)}`);
    }
    onStep?.(i + 1);
  }
  return { uploaded, failed };
}
