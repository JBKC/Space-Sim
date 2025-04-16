/**
 * Texture Registry - Explicit imports for all textures
 * This provides Vite with a blueprint of which textures to include in production
 */

// Planet textures
import sunTexture from '@textures/2k_sun.jpg';
import mercuryTexture from '@textures/2k_mercury.jpg';
import venusTexture from '@textures/2k_venus_surface.jpg';
import earthTexture from '@textures/2k_earth_daymap.jpg';
import earthCloudsTexture from '@textures/Earth-clouds.png';
import moonTexture from '@textures/2k_moon.jpg';
import marsTexture from '@textures/2k_mars.jpg';
import jupiterTexture from '@textures/2k_jupiter.jpg';
import saturnTexture from '@textures/2k_saturn.jpg';
import saturnRingTexture from '@textures/2k_saturn_ring_alpha.png';
import uranusTexture from '@textures/2k_uranus.jpg';
import neptuneTexture from '@textures/2k_neptune.jpg';
import neptuneEditedTexture from '@textures/2k_neptune_edited.png';
import starsTexture from '@textures/2k_stars_milky_way.jpg';
import moonAltTexture from '@textures/moon_texture.jpg';
import planetTexture1 from '@textures/planet_texture1.jpg';

// Star Wars planets
import coruscantTexture from '@textures/Coruscant.png';
import feluciaTexture from '@textures/Felucia.png';
import nabooTexture from '@textures/Naboo.png';
import naboo1Texture from '@textures/Naboo1.webp';
import deathStarTexture from '@textures/deathstar.png';
import deathStarScarifTexture from '@textures/death-star-scarif.jpg';

// Skybox textures
import skyboxGalaxy from '@textures/skybox/galaxy.jpg';
import skyboxGalaxy1 from '@textures/skybox/galaxy1.jpeg';
import skyboxGalaxy2 from '@textures/skybox/galaxy2.jpg';
import skyboxGalaxy3 from '@textures/skybox/galaxy3.jpg';
import skyboxGalaxy4 from '@textures/skybox/galaxy4.jpg';
import skyboxGalaxy5 from '@textures/skybox/galaxy5.jpeg';

// Group into categories
export const textures = {
  planets: {
    sun: sunTexture,
    mercury: mercuryTexture,
    venus: venusTexture,
    earth: earthTexture,
    earthClouds: earthCloudsTexture,
    moon: moonTexture,
    moonAlt: moonAltTexture,
    mars: marsTexture,
    jupiter: jupiterTexture,
    saturn: saturnTexture,
    saturnRing: saturnRingTexture,
    uranus: uranusTexture,
    neptune: neptuneTexture,
    neptuneEdited: neptuneEditedTexture,
    stars: starsTexture,
    planet1: planetTexture1
  },
  starWars: {
    coruscant: coruscantTexture,
    felucia: feluciaTexture,
    naboo: nabooTexture,
    naboo1: naboo1Texture,
    deathStar: deathStarTexture,
    deathStarScarif: deathStarScarifTexture
  },
  skybox: {
    galaxy: skyboxGalaxy,
    galaxy1: skyboxGalaxy1,
    galaxy2: skyboxGalaxy2,
    galaxy3: skyboxGalaxy3,
    galaxy4: skyboxGalaxy4,
    galaxy5: skyboxGalaxy5
  }
};

// Helper function to get texture by category and name
export function getTexture(category, name) {
  return textures[category]?.[name] || null;
} 