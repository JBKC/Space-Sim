#!/usr/bin/env node

/**
 * Asset copying script for production builds
 * 
 * This script copies all necessary assets from the src/assets directory
 * to the public/assets directory to ensure they're available in production.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
// This script lives in ./scripts but needs to operate relative to the repo root.
const REPO_ROOT = path.resolve(__dirname, '..');
const SOURCE_DIR = path.resolve(REPO_ROOT, 'src/assets');
const TARGET_DIR = path.resolve(REPO_ROOT, 'public/assets');
const BASIS_SOURCE_DIR = path.resolve(REPO_ROOT, 'node_modules/three/examples/jsm/libs/basis');
const BASIS_TARGET_DIR = path.resolve(REPO_ROOT, 'public/basis');

// Ensure target directory exists
if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
}

/**
 * Recursively copy a directory
 */
function copyDirectory(source, target) {
  // Create target directory if it doesn't exist
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  // Get all files and directories in the source
  const entries = fs.readdirSync(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    // Skip certain files and directories
    if (entry.name === '.DS_Store' || entry.name === 'lib') {
      continue;
    }

    if (entry.isDirectory()) {
      // Recursively copy directory
      copyDirectory(sourcePath, targetPath);
    } else {
      // Copy file
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`Copied: ${sourcePath} -> ${targetPath}`);
    }
  }
}

// Copy styles.css file to the dist directory
const stylesSourcePath = path.resolve(REPO_ROOT, 'styles.css');
const stylesTargetPath = path.resolve(REPO_ROOT, 'public/styles.css');

if (fs.existsSync(stylesSourcePath)) {
  fs.copyFileSync(stylesSourcePath, stylesTargetPath);
  console.log(`Copied: ${stylesSourcePath} -> ${stylesTargetPath}`);
} else {
  console.error(`Styles file not found at ${stylesSourcePath}`);
}

// Start copying
console.log('Starting asset copy process...');
copyDirectory(SOURCE_DIR, TARGET_DIR);

// Copy Basis/KTX2 transcoder files for KTX2Loader (texture compression)
try {
  if (!fs.existsSync(BASIS_TARGET_DIR)) {
    fs.mkdirSync(BASIS_TARGET_DIR, { recursive: true });
  }
  const basisFiles = ['basis_transcoder.js', 'basis_transcoder.wasm'];
  for (const f of basisFiles) {
    const src = path.join(BASIS_SOURCE_DIR, f);
    const dst = path.join(BASIS_TARGET_DIR, f);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dst);
      console.log(`Copied: ${src} -> ${dst}`);
    } else {
      console.warn(`Basis transcoder file not found: ${src}`);
    }
  }
} catch (e) {
  console.warn('Failed to copy Basis transcoders (KTX2 textures may not work):', e);
}

console.log('Assets copied successfully to public directory!'); 