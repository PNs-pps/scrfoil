import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'node:url';
import {defineConfig} from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    // Relative asset URLs. GitHub Pages serves the site from a sub-path
    // (https://<user>.github.io/<repo>/), so absolute "/assets/..." URLs would
    // 404. Relative "./assets/..." also works at a domain root, so this stays
    // compatible with the Vercel deploy.
    base: './',
    build: {
      // The bundle is one large app shell; the default 500 kB warning is just
      // noise here since there is no route to split on.
      chunkSizeWarningLimit: 2500,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
