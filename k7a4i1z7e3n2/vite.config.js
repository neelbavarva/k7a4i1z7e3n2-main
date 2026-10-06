import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Builds also write the app as 404.html. Vercel and GitHub Pages serve that file for any path
 * that doesn't exist, and the app sees the unknown path and shows its own "page not found".
 */
function notFoundPage() {
  let outDir;
  return {
    name: 'split-404-page',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, '404.html'));
    },
  };
}

export default defineConfig({
  plugins: [react(), notFoundPage()],
});
