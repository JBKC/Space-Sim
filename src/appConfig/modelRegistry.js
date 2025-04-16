/**
 * Model Registry - Explicit imports for all models
 * This provides Vite with a blueprint of which models to include in production
 */

// Spacecraft
import xwingModel from '@models/xwing_axespoints.glb';
import xwingCockpitModel from '@models/x-wing_cockpit/scene.gltf';

// Ships
import starDestroyerIModel from '@models/star_wars_imperial-class_star_destroyer/scene.gltf';
import starDestroyerIIModel from '@models/star_wars_imperial_ii_star_destroyer/scene.gltf';
import lucrehulkModel from '@models/lucrehulk/scene.gltf';

// Environment
import asteroidPackModel from '@models/asteroids_pack_metallic_version/scene.gltf';

// Group into categories
export const models = {
  spacecraft: {
    xwing: xwingModel,
    xwingCockpit: xwingCockpitModel
  },
  ships: {
    starDestroyerI: starDestroyerIModel,
    starDestroyerII: starDestroyerIIModel,
    lucrehulk: lucrehulkModel,
  },
  environment: {
    asteroidPack: asteroidPackModel
  }
};

// Helper function to get model by category and name
export function getModel(category, name) {
  return models[category]?.[name] || null;
} 