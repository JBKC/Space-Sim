// Asset staging orchestrator for the browser game (non-VR).
// Goal: start gameplay fast (ship first), then progressively load environment.

import { loadModelFromRegistryAsync, loadTextureFromRegistryAsync } from './loaders.js';

// Tiny helper to yield to the browser between stages.
function nextTick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export async function preloadStageShip() {
  // Ship (third-person) + cockpit (first-person)
  await loadModelFromRegistryAsync('spacecraft', 'xwing');
  await loadModelFromRegistryAsync('spacecraft', 'xwingCockpit');
}

export async function preloadStageSkybox() {
  await loadTextureFromRegistryAsync('skybox', 'galaxy');
}

export async function preloadStagePlanetsAndAsteroids() {
  // Planets + rings + clouds + asteroid pack
  await Promise.all([
    loadTextureFromRegistryAsync('planets', 'sun'),
    loadTextureFromRegistryAsync('planets', 'mercury'),
    loadTextureFromRegistryAsync('planets', 'venus'),
    loadTextureFromRegistryAsync('planets', 'earth'),
    loadTextureFromRegistryAsync('planets', 'earthClouds'),
    loadTextureFromRegistryAsync('planets', 'moon'),
    loadTextureFromRegistryAsync('planets', 'mars'),
    loadTextureFromRegistryAsync('planets', 'jupiter'),
    loadTextureFromRegistryAsync('planets', 'saturn'),
    loadTextureFromRegistryAsync('planets', 'saturnRing'),
    loadTextureFromRegistryAsync('planets', 'uranus'),
    loadTextureFromRegistryAsync('planets', 'neptune'),
    loadModelFromRegistryAsync('environment', 'asteroidPack'),
  ]);
}

export async function preloadStageBigShips() {
  // “Star Wars stuff”
  await Promise.all([
    // setup currently instantiates `starDestroyerII` twice
    loadModelFromRegistryAsync('ships', 'starDestroyerII'),
    loadModelFromRegistryAsync('ships', 'lucrehulk'),
    loadModelFromRegistryAsync('ships', 'deathStar'),
  ]);
}

/**
 * Runs the full staged preload sequence in-order, yielding between stages.
 * The caller can choose to `await` (blocking) or fire-and-forget.
 */
export async function runFullSpaceAssetStaging() {
  await preloadStageShip();
  await nextTick();
  await preloadStageSkybox();
  await nextTick();
  await preloadStagePlanetsAndAsteroids();
  await nextTick();
  await preloadStageBigShips();
}

