import fs from 'fs';
import path from 'path';

// Function to recursively list directory contents
function listDirContents(dir, indent = '') {
  try {
    const items = fs.readdirSync(dir);
    items.forEach(item => {
      const itemPath = path.join(dir, item);
      const stats = fs.statSync(itemPath);
      console.log(`${indent}${item}${stats.isDirectory() ? '/' : ''}`);
      if (stats.isDirectory()) {
        listDirContents(itemPath, indent + '  ');
      }
    });
  } catch (err) {
    console.error(`Error reading directory ${dir}: ${err.message}`);
  }
}

// Check the 3d-tiles-renderer package structure
console.log('Contents of 3d-tiles-renderer package:');
listDirContents('./node_modules/3d-tiles-renderer');