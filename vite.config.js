import { defineConfig } from 'vite';
import { resolve } from 'path';
import dotenv from 'dotenv';
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

// Load the environment variables from .env.development
dotenv.config({ path: '.env.development' });

// Function to ensure directory exists
function ensureDirectoryExistence(filePath) {
  const dir = dirname(filePath);
  if (existsSync(dir)) return true;
  ensureDirectoryExistence(dir);
  mkdirSync(dir);
}

export default defineConfig({
  server: {
    port: 3000,
    open: true,
    cors: true,
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    assetsInlineLimit: 0,
    rollupOptions: {
      external: [
        /^src\/assets\/.*/,
      ],
    },
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
  assetsInclude: ['**/*.gltf', '**/*.glb', '**/*.jpg', '**/*.png', '**/*.jpeg'],
  publicDir: 'public',
});