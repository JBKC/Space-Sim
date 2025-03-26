// vite.config.js
import { defineConfig } from 'vite';
import { resolve } from 'path';
import dotenv from 'dotenv';

// Load the environment variables from .env.production
dotenv.config({ path: '.env.production' });

export default defineConfig({
  build: {
    target: 'esnext', // Use modern JavaScript for smaller bundle sizes
    outDir: 'dist', // Output directory for production build
    emptyOutDir: true, // Clean directory before build
    assetsDir: 'assets', // Directory for static assets
    sourcemap: false, // Disable source maps for smaller builds
    minify: 'terser', // Terser for optimal minification
    terserOptions: {
      compress: {
        drop_console: true, // Remove console logs
        drop_debugger: true, // Remove debugger statements
      },
    },
    rollupOptions: {
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
      'three': resolve(__dirname, 'node_modules/three'),
      '3d-tiles-renderer': resolve(__dirname, 'node_modules/3d-tiles-renderer'),
    },
  },
  optimizeDeps: {
    include: ['three', '3d-tiles-renderer'],
  },
  // Public directory for static assets that don't need processing
  publicDir: 'public',
});

