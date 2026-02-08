// vite.config.js
import { defineConfig } from 'vite';
import { resolve } from 'path';
import dotenv from 'dotenv';
import { existsSync } from 'fs';

// Load environment variables (prefer local secrets, fallback to committed defaults)
dotenv.config({ path: existsSync('.env.production.local') ? '.env.production.local' : '.env.production' });

export default defineConfig({
  build: {
    target: 'esnext', // Use modern JavaScript for smaller bundle sizes
    outDir: 'dist', // Output directory for production build
    emptyOutDir: true, // Clean directory before build
    assetsDir: 'src/assets', // Directory for static assets
    sourcemap: false, // Disable source maps for smaller builds
    minify: 'terser', // Terser for optimal minification
    terserOptions: {
      compress: {
        drop_console: true, // Remove console logs
        drop_debugger: true, // Remove debugger statements
      },
    },
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        games: resolve(__dirname, 'games/index.html'),
      },
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            // Split vendor libraries into separate chunks
            return 'vendor';
          }
        },
      },
    },
  },
  server: {
    port: 3000, // You can change the dev server port if needed
    cors: true,
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
  // Set up asset handling explicitly
  assetsInclude: ['**/*.gltf', '**/*.glb', '**/*.jpg', '**/*.png', '**/*.jpeg'],
  // Public directory for static assets that don't need processing
  publicDir: 'public',
});

