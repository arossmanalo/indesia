import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  build: {
    // Phaser alone is ~1.2 MB minified (≈330 KB gzipped); it gets its own long-cached chunk.
    chunkSizeWarningLimit: 1400,
    rolldownOptions: {
      output: {
        // Split rarely-changing libraries out so game updates only re-download our code.
        codeSplitting: {
          groups: [
            { name: 'phaser', test: /node_modules[\\/]phaser[\\/]/, priority: 2 },
            { name: 'vendor', test: /node_modules[\\/]/, priority: 1 },
          ],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
});
