import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { STALE_HOURS } from './src/constants.js';

/**
 * Local development only: the site's Refresh button POSTs to /__refresh, which re-runs
 * the data job on this machine and answers when the new JSON is written.
 * - Once you've run the real pipeline (data/events.json exists), it runs that again.
 * - Otherwise it regenerates the sample data.
 * The deployed site is static and has no such endpoint; there the button just re-fetches.
 */
function refreshData() {
  let running = null;
  return {
    name: 'fx-refresh-data',
    configureServer(server) {
      server.middlewares.use('/__refresh', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end();
        }
        const root = server.config.root;
        const real = existsSync(join(root, 'data', 'events.json'));
        const script = real ? 'pipeline/run.js' : 'pipeline/demo.js';
        // one run at a time: a second click waits for the same result
        running ??= new Promise((resolve) => {
          server.config.logger.info(`[refresh] running ${script}…`, { timestamp: true });
          const child = spawn(process.execPath, [script], { cwd: root, env: process.env });
          let log = '';
          child.stdout.on('data', (d) => (log += d));
          child.stderr.on('data', (d) => (log += d));
          child.on('close', (code) => {
            server.config.logger[code === 0 ? 'info' : 'error'](`[refresh] ${script} finished (exit ${code})`, { timestamp: true });
            if (code !== 0) server.config.logger.error(log.slice(-1500));
            resolve({ ok: code === 0, mode: real ? 'pipeline' : 'demo' });
          });
        }).finally(() => (running = null));
        running.then((result) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
        });
      });
    },
  };
}

/**
 * Local development: /api/calendar answers from api/calendar.js, as the Vercel function does
 * on the deployed site (loaded through Vite, so edits to it apply without a restart).
 */
function calendarApi() {
  return {
    name: 'fx-calendar-api',
    configureServer(server) {
      server.middlewares.use('/api/calendar', async (req, res) => {
        try {
          const { default: handler } = await server.ssrLoadModule('/api/calendar.js');
          await handler(req, res);
        } catch (err) {
          server.config.logger.error(`[calendar] ${err.message}`, { timestamp: true });
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    },
  };
}

/**
 * Builds also write the app as 404.html. Vercel and GitHub Pages serve that file for any path
 * that doesn't exist, and the app sees the unknown path and shows its own "page not found".
 */
function notFoundPage() {
  let outDir;
  return {
    name: 'fx-404-page',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      copyFileSync(join(outDir, 'index.html'), join(outDir, '404.html'));
    },
  };
}

/**
 * A build on Vercel ships whatever public/data/ it was given. The hourly workflow builds right after
 * the data job, so its scores are fresh; a `vercel deploy` from a laptop uploads that machine's copy,
 * days old perhaps, over the live ones. So a build on Vercel stops when the scores are older than
 * STALE_HOURS, and the live site keeps its own: deploy through the workflow instead (the site's
 * Refresh, or Run workflow on GitHub). Local builds and GitHub Pages aren't checked.
 */
function freshData() {
  let root;
  return {
    name: 'fx-fresh-data',
    apply: 'build',
    configResolved(config) {
      root = config.root;
    },
    buildStart() {
      if (!process.env.VERCEL) return;
      const file = join(root, 'public', 'data', 'meta.json');
      const at = existsSync(file) ? Date.parse(JSON.parse(readFileSync(file, 'utf8')).generatedAt) : NaN;
      const hours = (Date.now() - at) / 36e5;
      if (Number.isFinite(hours) && hours <= STALE_HOURS) return;
      this.error(
        `public/data/meta.json is ${Number.isFinite(hours) ? `${Math.round(hours)} hours old` : 'missing'}: deploying it would put old scores on the live site. ` +
          'Deploy through the "News - update data and deploy" workflow (the site\'s Refresh, or Run workflow on GitHub), which makes them fresh first.',
      );
    },
  };
}

// BASE_PATH is set by the GitHub Pages workflow ("/<repo-name>/"). Locally it is "/".
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react(), refreshData(), calendarApi(), notFoundPage(), freshData()],
  server: {
    // the data job rewrites ~40 JSON files; don't let each one trigger a page reload
    watch: { ignored: ['**/public/data/**', '**/data/**'] },
  },
});
