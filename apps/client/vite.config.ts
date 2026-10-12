import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  build: {
    // Phaser alone is ~1.2 MB minified; revisit code-splitting in the launch performance pass.
    chunkSizeWarningLimit: 1600,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
});
