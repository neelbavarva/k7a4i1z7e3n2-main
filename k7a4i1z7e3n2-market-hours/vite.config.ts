import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Builds also write the app as 404.html. Vercel and GitHub Pages serve that file for any path
 * that doesn't exist, and the app sees the unknown path and shows its own "page not found".
 */
function notFoundPage(): Plugin {
  let outDir = '';
  return {
    name: 'mh-404-page',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, '404.html'));
    },
  };
}

// BASE_PATH lets the same build be served from a sub-path (e.g. GitHub Pages "/<repo-name>/"). Locally it is "/".
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react(), notFoundPage()],
});
