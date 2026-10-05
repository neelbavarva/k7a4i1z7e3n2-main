// Screenshots are uploaded one per request through the server proxy. Hosted functions cap a
// request at about 4.5 MB, so anything bigger is redrawn as WebP (sharp enough for charts)
// before it leaves the browser. The API's own limit is 10 MB per image, five per upload.

import { IMAGE_MAX_BYTES, IMAGES_PER_UPLOAD, NAME_MAX } from './validate';

const SEND_LIMIT = 4 * 1024 * 1024;

export type Pending = { id: string; file: File; name: string; preview: string };

let seq = 0;

/** Turn picked, dropped or pasted files into pending uploads, with a reason for any left out. */
export function toPending(files: File[], already: number): { items: Pending[]; problems: string[] } {
  const problems: string[] = [];
  const items: Pending[] = [];
  for (const file of files) {
    if (!file.type.startsWith('image/')) {
      problems.push(`${file.name || 'A file'} isn’t an image.`);
      continue;
    }
    if (file.size > IMAGE_MAX_BYTES) {
      problems.push(`${file.name || 'An image'} is larger than 10 MB.`);
      continue;
    }
    if (already + items.length >= IMAGES_PER_UPLOAD) {
      problems.push(`Up to ${IMAGES_PER_UPLOAD} images at a time.`);
      break;
    }
    const base = file.name && file.name !== 'image.png' ? file.name.replace(/\.[^.]+$/, '') : `Screenshot ${already + items.length + 1}`;
    items.push({ id: `p${++seq}`, file, name: base.slice(0, NAME_MAX), preview: URL.createObjectURL(file) });
  }
  return { items, problems };
}

async function redraw(file: File, maxSide: number, quality: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/webp', quality));
}

/** The file to send: the original when it fits, otherwise a smaller WebP copy. */
export async function forUpload(file: File): Promise<{ blob: Blob; filename: string }> {
  if (file.size <= SEND_LIMIT) return { blob: file, filename: file.name || 'screenshot.png' };
  for (const [side, q] of [[2560, 0.9], [2200, 0.82], [1800, 0.75]] as const) {
    const blob = await redraw(file, side, q);
    if (blob.size <= SEND_LIMIT) return { blob, filename: (file.name || 'screenshot').replace(/\.[^.]+$/, '') + '.webp' };
  }
  throw new Error('This image is too detailed to upload. Try a smaller screenshot.');
}
