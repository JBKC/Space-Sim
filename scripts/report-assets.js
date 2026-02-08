#!/usr/bin/env node
/**
 * Report loaded assets (models + textures) with file sizes.
 *
 * This parses:
 * - src/appConfig/modelRegistry.js
 * - src/appConfig/textureRegistry.js
 *
 * and maps @models/@textures imports to files under src/assets.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

function bytesToMB(bytes) {
  return bytes / (1024 * 1024);
}

function statSize(absPath) {
  const st = fs.statSync(absPath);
  return st.size;
}

function parseImportMap(source, aliasPrefix) {
  // e.g. import xwingModel from '@models/xwing_axespoints.glb';
  const re = new RegExp(`import\\s+(\\w+)\\s+from\\s+['"]@${aliasPrefix}\\/([^'"]+)['"];`, 'g');
  const out = new Map(); // var -> relPathWithinAlias
  let m;
  while ((m = re.exec(source))) {
    out.set(m[1], m[2]);
  }
  return out;
}

function parseRegistryObject(source, exportedName) {
  // Very small parser for the `export const <exportedName> = { ... }` literal
  const startIdx = source.indexOf(`export const ${exportedName} = {`);
  if (startIdx === -1) return [];
  const body = source.slice(startIdx);
  const lines = body.split('\n');

  const entries = [];
  let currentCategory = null;
  let braceDepth = 0;

  for (const line of lines) {
    if (line.includes('{')) braceDepth += (line.match(/\{/g) || []).length;
    if (line.includes('}')) braceDepth -= (line.match(/\}/g) || []).length;

    const catMatch = line.match(/^\s{2}(\w+):\s*\{\s*$/);
    if (catMatch) {
      currentCategory = catMatch[1];
      continue;
    }

    const kvMatch = line.match(/^\s{4}(\w+):\s*(\w+)\s*,?\s*$/);
    if (kvMatch && currentCategory) {
      entries.push({
        category: currentCategory,
        name: kvMatch[1],
        varName: kvMatch[2],
      });
      continue;
    }

    // Leave when the exported object closes (braceDepth returns to 0 after encountering the opener)
    if (braceDepth <= 0 && entries.length > 0) break;
  }

  return entries;
}

function stageFor(category) {
  if (category === 'spacecraft') return 'stage1_ship';
  if (category === 'skybox') return 'stage2_skybox';
  if (category === 'planets') return 'stage3_planets';
  if (category === 'environment') return 'stage3_asteroids';
  if (category === 'ships') return 'stage4_big_ships';
  return 'unknown';
}

function main() {
  const modelRegistryPath = path.join(REPO_ROOT, 'src/appConfig/modelRegistry.js');
  const textureRegistryPath = path.join(REPO_ROOT, 'src/appConfig/textureRegistry.js');

  const modelSrc = read(modelRegistryPath);
  const texSrc = read(textureRegistryPath);

  const modelImports = parseImportMap(modelSrc, 'models');
  const texImports = parseImportMap(texSrc, 'textures');

  const modelEntries = parseRegistryObject(modelSrc, 'models').map((e) => ({
    type: 'model',
    category: e.category,
    name: e.name,
    stage: stageFor(e.category),
    rel: path.join('src/assets/models', modelImports.get(e.varName) || ''),
  }));

  const texEntries = parseRegistryObject(texSrc, 'textures').map((e) => ({
    type: 'texture',
    category: e.category,
    name: e.name,
    stage: stageFor(e.category),
    rel: path.join('src/assets/textures', texImports.get(e.varName) || ''),
  }));

  const all = [...modelEntries, ...texEntries].map((e) => {
    const abs = path.join(REPO_ROOT, e.rel);
    let size = null;
    let ok = true;
    try {
      size = statSize(abs);
    } catch {
      ok = false;
    }
    return {
      ...e,
      abs,
      sizeBytes: size,
      sizeMB: size != null ? bytesToMB(size) : null,
      ok,
    };
  });

  const missing = all.filter((a) => !a.ok);
  const present = all.filter((a) => a.ok).sort((a, b) => b.sizeBytes - a.sizeBytes);

  console.log('Asset report (from registries)');
  console.log('---');
  for (const a of present) {
    const mb = a.sizeMB.toFixed(2).padStart(7);
    console.log(`${mb} MB  ${a.type.padEnd(7)}  ${a.stage.padEnd(16)}  ${a.category}/${a.name}  (${a.rel})`);
  }

  if (missing.length) {
    console.log('\nMissing/unresolved entries:');
    for (const a of missing) {
      console.log(`- ${a.type} ${a.category}/${a.name}: expected ${a.rel}`);
    }
    process.exitCode = 1;
  }
}

main();

