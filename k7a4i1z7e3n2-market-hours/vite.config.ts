import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// BASE_PATH lets the same build be served from a sub-path (e.g. GitHub Pages "/<repo-name>/"). Locally it is "/".
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
});
