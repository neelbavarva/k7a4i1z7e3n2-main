import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

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

// BASE_PATH is set by the GitHub Pages workflow ("/<repo-name>/"). Locally it is "/".
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react(), refreshData()],
  server: {
    // the data job rewrites ~40 JSON files; don't let each one trigger a page reload
    watch: { ignored: ['**/public/data/**', '**/data/**'] },
  },
});
