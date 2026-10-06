// Refresh on the deployed site: collect the latest data now instead of waiting for the hour.
//   POST /api/refresh   start the data job (the "News - update data and deploy" GitHub workflow),
//                       or join the run already going
//   GET  /api/refresh   how the latest run is doing
// The run fetches the calendar and released values, scores everything, and redeploys the site, so
// once it has finished the new meta.json is live. Needs GITHUB_DISPATCH_TOKEN (a fine-grained token
// with Actions read and write on this repo) in the Vercel project's environment; without it this
// answers 501 and the page falls back to checking for the hourly update.

import { COLLECT_REST_MINUTES } from '../src/constants.js';

const REPO = process.env.NEWS_REPO || 'neelbavarva/k7a4i1z7e3n2-main';
const WORKFLOW = process.env.NEWS_WORKFLOW || 'news-update.yml';
const REF = process.env.NEWS_REF || 'main';

const github = (path, init = {}) =>
  fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_DISPATCH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'fx-bias-refresh',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });

/** The newest run of the workflow, whatever started it (the hour, a push, or a Refresh). */
async function latestRun() {
  const r = await github('/runs?per_page=1');
  if (!r.ok) throw new Error(`GitHub answered ${r.status} for the workflow runs`);
  const run = (await r.json()).workflow_runs?.[0];
  if (!run) return null;
  return {
    state: run.status === 'completed' ? 'done' : 'running',
    ok: run.status === 'completed' ? run.conclusion === 'success' : null,
    startedAt: run.created_at,
    finishedAt: run.status === 'completed' ? run.updated_at : null,
  };
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const send = (status, body) => {
    res.statusCode = status;
    res.end(JSON.stringify(body));
  };
  if (!process.env.GITHUB_DISPATCH_TOKEN) return send(501, { state: 'off' });
  if (req.method !== 'GET' && req.method !== 'POST') return send(405, { error: 'GET or POST' });

  try {
    const run = await latestRun();
    if (req.method === 'GET') return send(200, run ?? { state: 'idle' });

    // one run at a time: join the one going, and don't start another right after one finished
    if (run?.state === 'running') return send(200, { ...run, joined: true });
    if (run?.ok && Date.now() - Date.parse(run.finishedAt) < COLLECT_REST_MINUTES * 60 * 1000) {
      return send(200, { ...run, fresh: true });
    }
    const d = await github('/dispatches', { method: 'POST', body: JSON.stringify({ ref: REF }) });
    if (d.status !== 204) throw new Error(`GitHub answered ${d.status} to starting the workflow`);
    return send(202, { state: 'running', startedAt: new Date().toISOString() });
  } catch (err) {
    console.error('refresh:', err.message);
    return send(502, { error: "Couldn't start the data job." });
  }
}
