// Trusted write proxy. The browser sends a mutation here; this server checks it against the
// API contract, adds the private X-API-Key and forwards it. Only the exact operations the
// journal uses are allowed (never /cleanup: trades are deleted one at a time), and the key is
// read from the server environment only.

import {
  DATE_RE,
  IMAGE_MAX_BYTES,
  IMAGES_PER_UPLOAD,
  NAME_MAX,
  UUID_RE,
  checkBlownWeek,
  checkCreateTrade,
  checkRename,
  checkUpdateTrade,
} from '@/lib/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API_URL = (process.env.KAIZEN_API_URL || process.env.NEXT_PUBLIC_KAIZEN_API_URL || 'https://k7a4i1z7e3n2-journal.lovable.app/api/public/v1').replace(/\/$/, '');

type Ctx = { params: Promise<{ path: string[] }> };
type Body = Record<string, unknown>;
type Route = { kind: 'json'; check?: (b: Body) => string | null } | { kind: 'none' } | { kind: 'images' };

/** The allowed operations: method plus path shape. Anything else is a 404. */
function match(method: string, path: string[]): Route | null {
  const [a, b, c, ...rest] = path;
  if (rest.length) return null;
  const id = b !== undefined && UUID_RE.test(b);
  if (a === 'trades' && b === undefined && c === undefined && method === 'POST') return { kind: 'json', check: checkCreateTrade };
  if (a === 'trades' && id && c === undefined && method === 'PATCH') return { kind: 'json', check: checkUpdateTrade };
  if (a === 'trades' && id && c === undefined && method === 'DELETE') return { kind: 'none' };
  if (a === 'trades' && id && c === 'images' && method === 'POST') return { kind: 'images' };
  if (a === 'images' && id && c === undefined && method === 'PATCH') return { kind: 'json', check: checkRename };
  if (a === 'images' && id && c === undefined && method === 'DELETE') return { kind: 'none' };
  if (a === 'blown-weeks' && b !== undefined && DATE_RE.test(b) && c === undefined && method === 'PUT') return { kind: 'json', check: checkBlownWeek };
  if (a === 'blown-weeks' && b !== undefined && DATE_RE.test(b) && c === undefined && method === 'DELETE') return { kind: 'none' };
  return null;
}

const fail = (status: number, code: string, message: string) => Response.json({ error: { code, message } }, { status });

/** Browsers say where a request came from; refuse writes started by other sites. */
function crossSite(req: Request) {
  const site = req.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return true;
  const origin = req.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host !== req.headers.get('host');
  } catch {
    return true;
  }
}

async function imagesBody(req: Request): Promise<FormData | string> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return 'Send the images as multipart form data.';
  }
  const files = form.getAll('file').filter((f): f is File => typeof f === 'object' && f !== null && 'arrayBuffer' in f);
  const names = form.getAll('name').map(String);
  if (!files.length) return 'Choose at least one image.';
  if (files.length > IMAGES_PER_UPLOAD) return `Upload ${IMAGES_PER_UPLOAD} images at most at a time.`;
  for (const f of files) {
    if (!f.type.startsWith('image/')) return `${f.name || 'A file'} is not an image.`;
    if (f.size > IMAGE_MAX_BYTES) return `${f.name || 'An image'} is larger than 10 MB.`;
  }
  if (names.some((n) => n.length > NAME_MAX)) return `Names can be ${NAME_MAX} characters at most.`;
  const out = new FormData();
  files.forEach((f, i) => {
    out.append('file', f, f.name || `image-${i + 1}`);
    if (names[i]) out.append('name', names[i]);
  });
  return out;
}

async function handle(req: Request, ctx: Ctx) {
  const { path } = await ctx.params;
  const route = match(req.method, path);
  if (!route) return fail(404, 'NOT_FOUND', 'Unknown operation.');
  if (crossSite(req)) return fail(403, 'FORBIDDEN', 'Writes must come from this site.');

  const key = process.env.KAIZEN_API_KEY;
  if (!key) return fail(503, 'NOT_CONFIGURED', 'KAIZEN_API_KEY is not set on this site.');

  const headers: Record<string, string> = { 'X-API-Key': key };
  let body: BodyInit | undefined;

  if (route.kind === 'json') {
    let parsed: unknown;
    try {
      parsed = await req.json();
    } catch {
      return fail(400, 'VALIDATION_ERROR', 'The request body must be JSON.');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return fail(400, 'VALIDATION_ERROR', 'The request body must be an object.');
    const problem = route.check?.(parsed as Body);
    if (problem) return fail(400, 'VALIDATION_ERROR', problem);
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(parsed);
  } else if (route.kind === 'images') {
    const form = await imagesBody(req);
    if (typeof form === 'string') return fail(400, 'VALIDATION_ERROR', form);
    body = form;
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${API_URL}/${path.map(encodeURIComponent).join('/')}`, {
      method: req.method,
      headers,
      body,
      cache: 'no-store',
    });
  } catch {
    return fail(502, 'UPSTREAM_UNAVAILABLE', 'The journal API can’t be reached right now.');
  }

  if (upstream.status === 204) return new Response(null, { status: 204 });
  const text = await upstream.text();
  try {
    return Response.json(JSON.parse(text), { status: upstream.status });
  } catch {
    return fail(upstream.ok ? 502 : upstream.status, 'UPSTREAM_ERROR', 'The journal API sent an unexpected reply.');
  }
}

export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
