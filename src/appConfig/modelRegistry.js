/**
 * Model Registry - Explicit imports for all models
 * This provides Vite with a blueprint of which models to include in production
 */

// Spacecraft
import xwingModel from '@models/xwing_axespoints.glb';
import xwingCockpitModel from '@models/x-wing_cockpit_highres.glb';

// Ships
import starDestroyerIModel from '@models/imperial_star_destroyer_highres.glb';
import starDestroyerIIModel from '@models/imperial_star_destroyer_highres.glb';
import lucrehulkModel from '@models/lucrehulk.glb';
import deathStarModel from '@models/death_star_highres.glb';

// Environment / Other
import asteroidPackModel from '@models/asteroids_lowres.glb';
import asteroidPackModelVR from '@models/asteroids_highres_vr.glb';
import hologramModel from '@models/earth_hologram.glb';

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
    deathStar: deathStarModel
  },
  environment: {
    asteroidPack: asteroidPackModel,
    hologram: hologramModel
  }
};

// Helper function to get model by category and name
export function getModel(category, name) {
  return models[category]?.[name] || null;
} 