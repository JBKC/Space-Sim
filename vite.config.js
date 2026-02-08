import { defineConfig } from 'vite';
import { resolve } from 'path';
import dotenv from 'dotenv';
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

// Load environment variables (prefer local secrets, fallback to committed defaults)
dotenv.config({ path: existsSync('.env.development.local') ? '.env.development.local' : '.env.development' });

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
      input: {
        main: resolve(__dirname, 'index.html'),
        games: resolve(__dirname, 'games/index.html'),
      },
      external: [
        /^src\/assets\/.*/,
      ],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@assets': resolve(__dirname, 'src/assets'),
      '@textures': resolve(__dirname, 'src/assets/textures'),
      '@models': resolve(__dirname, 'src/assets/models'),
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