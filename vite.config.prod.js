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
    assetsDir: 'assets', // Directory for static assets in output (matches .env.production)
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
        main: resolve(__dirname, 'index.html')
      },
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            // Split vendor libraries into separate chunks
            return 'vendor';
          }
        },
        // Ensure assets are properly copied and maintain their paths
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          
          if (/\.(png|jpe?g|svg|gif|tiff|bmp|ico|webp|glb|gltf)$/i.test(assetInfo.name)) {
            return `assets/[name]-[hash][extname]`;
          }
          
          if (ext === 'css') {
            return `[name][extname]`;  // Don't add hash to CSS files for direct reference
          }
          
          return `assets/[name]-[hash][extname]`;
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
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
  // Set up asset handling explicitly
  assetsInclude: ['**/*.gltf', '**/*.glb', '**/*.jpg', '**/*.png', '**/*.jpeg'],
  // Public directory for static assets that don't need processing
  publicDir: 'public',
});

