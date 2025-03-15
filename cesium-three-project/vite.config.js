import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  server: {
    port: 3000,
    open: '/ionExample.html'
  },
  build: {
    outDir: 'dist'
  },
  resolve: {
    alias: {
      '3d-tiles-renderer': path.resolve(__dirname, 'node_modules/3d-tiles-renderer'),
      'three': path.resolve(__dirname, 'node_modules/three')
    }
  },
  optimizeDeps: {
    include: ['three', '3d-tiles-renderer']
  }
});