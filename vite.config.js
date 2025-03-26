import { defineConfig } from 'vite';
import { resolve } from 'path';
import dotenv from 'dotenv';

// Load the environment variables from .env.development
dotenv.config({ path: '.env.development' });

export default defineConfig({
  server: {
    port: 3000,
    open: true,
    cors: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      'three': resolve(__dirname, 'node_modules/three'),
      '3d-tiles-renderer': resolve(__dirname, 'node_modules/3d-tiles-renderer'),
    },
  },
  optimizeDeps: {
    include: ['three', '3d-tiles-renderer'],
  },
  // Set up asset handling explicitly
  assetsInclude: ['**/*.gltf', '**/*.glb', '**/*.jpg', '**/*.png', '**/*.jpeg'],
  // Public directory for static assets that don't need processing
  publicDir: 'public',
});