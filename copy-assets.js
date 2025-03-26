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
const SOURCE_DIR = path.resolve(__dirname, 'src/assets');
const TARGET_DIR = path.resolve(__dirname, 'public/assets');

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

// Start copying
console.log('Starting asset copy process...');
copyDirectory(SOURCE_DIR, TARGET_DIR);
console.log('Assets copied successfully to public directory!'); 