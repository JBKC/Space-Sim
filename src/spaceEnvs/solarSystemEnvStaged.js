// Stage-driven solar system environment.
// This avoids heavy work at module import time so we can progressively load assets.

import * as THREE from 'three';
import {
  loadModelFromRegistryAsync,
  loadTextureFromRegistryAsync,
  universalScaleFactor,
} from '../appConfig/loaders.js';

/////////////////////////////////////////////////////////////////////////
// SIZE AND SCALE CONSTANTS (kept consistent with previous solarSystemEnv.js)
/////////////////////////////////////////////////////////////////////////

// Global scales
export const SKYBOX_SIZE = 250000;
const STAR_SIZE = 25;
const STAR_RANGE = 500000;
const STAR_COUNT = 1000000;

// Sun properties
const SUN_RADIUS = 10000;
const SUN_LIGHT_RANGE = 35000;

// Planet radii
const MERCURY_RADIUS = 1000;
const VENUS_RADIUS = 2000;
const EARTH_RADIUS = 2000;
const MOON_RADIUS = 500;
const MARS_RADIUS = 1500;
const JUPITER_RADIUS = 4500;
const SATURN_RADIUS = 4000;
const URANUS_RADIUS = 3000;
const NEPTUNE_RADIUS = 3000;

// Orbit distances (z-position)
const MERCURY_ORBIT = 20000;
const VENUS_ORBIT = 27000;
const EARTH_ORBIT = 40000;
const MARS_ORBIT = 50000;
const JUPITER_ORBIT = 60000;
const SATURN_ORBIT = 80000;
const URANUS_ORBIT = 95000;
const NEPTUNE_ORBIT = 110000;

// Moon orbit properties
const MOON_ORBIT_RADIUS = 5000;

// Saturn ring properties
const SATURN_RING_OUTER = 8000;
const SATURN_RING_INNER = 6000;
const SATURN_RING_OUTER2 = 5200;
const SATURN_RING_INNER2 = 4400;

// Star Wars ships properties
const STAR_DESTROYER_POSITION = 70000;
const STAR_DESTROYER_SIZE = 8;
const STAR_DESTROYER_DIMENSIONS = [10000, 3000, 8000];
const STAR_DESTROYER_OFFSET = [-7000, 2000, 0];

const LUCREHULK_POSITION = 35000;
const LUCREHULK_SIZE = 300;
const LUCREHULK_DIMENSIONS = [5000, 5000, 2000];

const DEATH_STAR_POSITION = 90000;
const DEATH_STAR_SIZE = 100;
const DEATH_STAR_RADIUS = 10000;

// Asteroid belt properties
const ASTEROID_BELT_RADIUS = 55000;
const ASTEROID_COLLISION_RADIUS = 3000;
const ASTEROID_BASE_SCALE = 200;
const ASTEROID_COUNT = 100;
const ASTEROID_HEIGHT_VARIATION = 5000;

// Atmosphere properties
const ATMOSPHERE_THICKNESS = 50;
const CLOUD_OFFSET = 5;

/////////////////////////////////////////////////////////////////////////
// Exported scene objects (created lazily where expensive)
/////////////////////////////////////////////////////////////////////////

export const planetGroups = [];

// Skybox & stars
export let skybox = null;
export let stars = null;
export const starCount = STAR_COUNT;
export const starRange = STAR_RANGE * universalScaleFactor;

// Sun
export const sunGroup = new THREE.Group();
export let blazingMaterial = null;
export let blazingEffect = null;

// Cloud meshes (animated in setup.js)
export let venusCloudMesh = null;
export let earthCloudMesh = null;
export let marsCloudMesh = null;

// Planets
export const mercuryGroup = new THREE.Group();
export const venusGroup = new THREE.Group();
export const earthGroup = new THREE.Group();
export const moonGroup = new THREE.Group();
export const marsGroup = new THREE.Group();
export const jupiterGroup = new THREE.Group();
export const saturnGroup = new THREE.Group();
export const uranusGroup = new THREE.Group();
export const neptuneGroup = new THREE.Group();

export const earthRadius = EARTH_RADIUS * universalScaleFactor;
export const moonRadius = MOON_RADIUS * universalScaleFactor;

// Collision material (invisible)
const collisionMaterialInvisible = new THREE.MeshBasicMaterial({ visible: false });

export const mercuryCollisionSphere = new THREE.Mesh(
  new THREE.SphereGeometry(MERCURY_RADIUS * universalScaleFactor * 1.5, 16, 16),
  collisionMaterialInvisible,
);
mercuryGroup.add(mercuryCollisionSphere);

export const venusCollisionSphere = new THREE.Mesh(
  new THREE.SphereGeometry(VENUS_RADIUS * universalScaleFactor * 1.5, 16, 16),
  collisionMaterialInvisible,
);
venusGroup.add(venusCollisionSphere);

export const earthCollisionSphere = new THREE.Mesh(
  new THREE.SphereGeometry(EARTH_RADIUS * universalScaleFactor * 1.5, 16, 16),
  collisionMaterialInvisible,
);
earthGroup.add(earthCollisionSphere);

export const moonCollisionSphere = new THREE.Mesh(
  new THREE.SphereGeometry(MOON_RADIUS * universalScaleFactor * 1.5, 16, 16),
  collisionMaterialInvisible,
);
moonGroup.add(moonCollisionSphere);

export const marsCollisionSphere = new THREE.Mesh(
  new THREE.SphereGeometry(MARS_RADIUS * universalScaleFactor * 1.5, 16, 16),
  collisionMaterialInvisible,
);
marsGroup.add(marsCollisionSphere);

export const jupiterCollisionSphere = new THREE.Mesh(
  new THREE.SphereGeometry(JUPITER_RADIUS * universalScaleFactor * 1.5, 16, 16),
  collisionMaterialInvisible,
);
jupiterGroup.add(jupiterCollisionSphere);

export const saturnCollisionSphere = new THREE.Mesh(
  new THREE.SphereGeometry(SATURN_RADIUS * universalScaleFactor * 1.5, 16, 16),
  collisionMaterialInvisible,
);
saturnGroup.add(saturnCollisionSphere);

export const uranusCollisionSphere = new THREE.Mesh(
  new THREE.SphereGeometry(URANUS_RADIUS * universalScaleFactor * 1.5, 16, 16),
  collisionMaterialInvisible,
);
uranusGroup.add(uranusCollisionSphere);

export const neptuneCollisionSphere = new THREE.Mesh(
  new THREE.SphereGeometry(NEPTUNE_RADIUS * universalScaleFactor * 1.5, 16, 16),
  collisionMaterialInvisible,
);
neptuneGroup.add(neptuneCollisionSphere);

// Ships (groups and collision proxies are cheap; models are staged)
export const starDestroyerGroup = new THREE.Group();
starDestroyerGroup.name = 'starDestroyer';
const collisionGeometry = new THREE.BoxGeometry(
  STAR_DESTROYER_DIMENSIONS[0] * universalScaleFactor,
  STAR_DESTROYER_DIMENSIONS[1] * universalScaleFactor,
  STAR_DESTROYER_DIMENSIONS[2] * universalScaleFactor,
);
export const collisionBox1 = new THREE.Mesh(collisionGeometry, collisionMaterialInvisible);
collisionBox1.name = 'starDestroyer1Collision';
starDestroyerGroup.add(collisionBox1);

export const collisionBox2 = new THREE.Mesh(collisionGeometry, collisionMaterialInvisible);
collisionBox2.position.set(
  STAR_DESTROYER_OFFSET[0] * universalScaleFactor,
  STAR_DESTROYER_OFFSET[1] * universalScaleFactor,
  STAR_DESTROYER_OFFSET[2],
);
collisionBox2.name = 'starDestroyer2Collision';
starDestroyerGroup.add(collisionBox2);

planetGroups.push({ group: starDestroyerGroup, z: STAR_DESTROYER_POSITION * universalScaleFactor });

export const lucrehulkGroup = new THREE.Group();
lucrehulkGroup.name = 'lucrehulk';
export const lucrehulkCollisionBox = new THREE.Mesh(
  new THREE.CylinderGeometry(
    LUCREHULK_DIMENSIONS[0] * universalScaleFactor,
    LUCREHULK_DIMENSIONS[1] * universalScaleFactor,
    LUCREHULK_DIMENSIONS[2] * universalScaleFactor,
    32,
  ),
  collisionMaterialInvisible,
);
lucrehulkCollisionBox.rotation.x = Math.PI / 2;
lucrehulkCollisionBox.name = 'lucrehulkCollision';
lucrehulkGroup.add(lucrehulkCollisionBox);
planetGroups.push({ group: lucrehulkGroup, z: LUCREHULK_POSITION * universalScaleFactor });

export const deathStarGroup = new THREE.Group();
deathStarGroup.name = 'deathStar';
export const deathStarCollisionSphere = new THREE.Mesh(
  new THREE.SphereGeometry(DEATH_STAR_RADIUS * universalScaleFactor * 0.5, 32),
  collisionMaterialInvisible,
);
deathStarCollisionSphere.name = 'deathStarCollision';
deathStarGroup.add(deathStarCollisionSphere);
planetGroups.push({ group: deathStarGroup, z: DEATH_STAR_POSITION * universalScaleFactor });

// Asteroids
export const asteroidBeltGroup = new THREE.Group();
asteroidBeltGroup.name = 'asteroidBelt';
export const asteroidCollisionSphere = new THREE.Mesh(
  new THREE.SphereGeometry(ASTEROID_COLLISION_RADIUS * universalScaleFactor, 32, 32),
  collisionMaterialInvisible,
);
asteroidBeltGroup.add(asteroidCollisionSphere);

// Moon positioning helper (used by setup.js)
export const moonOrbitRadius = MOON_ORBIT_RADIUS * universalScaleFactor;
export const moonAngle = Math.random() * Math.PI * 2;
export function updateMoonPosition() {
  const angle = Math.random() * Math.PI * 2;
  moonGroup.position.set(
    earthGroup.position.x + Math.cos(angle) * moonOrbitRadius,
    earthGroup.position.y + Math.sin(angle) * moonOrbitRadius,
    earthGroup.position.z,
  );
}

/////////////////////////////////////////////////////////////////////////
// Stage init functions
/////////////////////////////////////////////////////////////////////////

let initializedSkybox = false;
let initializedStars = false;
let initializedSunPlanets = false;
let initializedAsteroids = false;
let initializedBigShips = false;

export async function initStageSkyboxAndStars() {
  if (!initializedSkybox) {
    const tex = await loadTextureFromRegistryAsync('skybox', 'galaxy');
    const geom = new THREE.BoxGeometry(
      SKYBOX_SIZE * universalScaleFactor,
      SKYBOX_SIZE * universalScaleFactor,
      SKYBOX_SIZE * universalScaleFactor,
    );
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      color: 0x555555,
    });
    skybox = new THREE.Mesh(geom, mat);
    skybox.position.set(0, 0, 0);
    initializedSkybox = true;
  }

  if (!initializedStars) {
    // NOTE: this is heavy. We chunk work to avoid a long main-thread stall.
    const starGeometry = new THREE.BufferGeometry();
    const count = STAR_COUNT;
    const range = STAR_RANGE * universalScaleFactor;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    const yieldToMainThread = () => new Promise((r) => setTimeout(r, 0));
    const CHUNK = 25000;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = range * Math.pow(Math.random(), 1 / 3);

      positions[i3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = r * Math.cos(phi);

      colors[i3] = 1.0;
      colors[i3 + 1] = 1.0;
      colors[i3 + 2] = 1.0;

      sizes[i] = 1 + Math.random() * 2;

      // Yield occasionally so gameplay/rendering stays responsive while stars generate.
      if (i > 0 && i % CHUNK === 0) {
        await yieldToMainThread();
      }
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    starGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const starMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: STAR_SIZE * universalScaleFactor,
      vertexColors: true,
      sizeAttenuation: true,
      transparent: true,
      opacity: 1.0,
    });

    stars = new THREE.Points(starGeometry, starMaterial);
    initializedStars = true;
  }
}

export async function initStageSunAndPlanets() {
  if (initializedSunPlanets) return;

  const [
    sunTex,
    mercuryTex,
    venusTex,
    earthTex,
    cloudTex,
    moonTex,
    marsTex,
    jupiterTex,
    saturnTex,
    ringTex,
    uranusTex,
    neptuneTex,
  ] = await Promise.all([
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
  ]);

  // Sun mesh + effects
  const sunRadius = SUN_RADIUS * universalScaleFactor;
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(sunRadius, 64, 64),
    new THREE.MeshStandardMaterial({
      map: sunTex,
      emissive: 0xffffff,
      emissiveIntensity: 0.3,
      side: THREE.FrontSide,
    }),
  );
  sunGroup.add(sun);

  blazingMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      intensity: { value: 0.4 },
      baseColor: { value: new THREE.Vector3(1.0, 0.5, 0.0) },
      noiseScale: { value: 2.0 },
    },
    vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
            vNormal = normalize(normal);
            vPosition = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float time;
        uniform float intensity;
        uniform vec3 baseColor;
        uniform float noiseScale;
        varying vec3 vNormal;
        varying vec3 vPosition;
        float noise(vec3 p) {
            return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
        }
        void main() {
            vec3 pos = vPosition * noiseScale;
            float n = noise(pos + time * 0.5);
            float glow = sin(time * 5.0 + length(vPosition) * 2.0) * 0.5 + 0.5;
            float pulse = (n * 0.5 + glow * 0.5) * intensity * 0.5;
            vec3 color = baseColor * (1.0 + pulse * 0.5);
            float alpha = clamp(pulse * 0.8, 0.2, 0.9);
            gl_FragColor = vec4(color, alpha);
        }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  blazingEffect = new THREE.Mesh(new THREE.SphereGeometry(sunRadius * 1.2, 64, 64), blazingMaterial);
  sunGroup.add(blazingEffect);

  // Lighting
  const sunLight = new THREE.PointLight(0xffffdd, 1.2, SUN_LIGHT_RANGE * universalScaleFactor);
  sunLight.castShadow = true;
  sunLight.shadow.bias = -0.0001;
  sunGroup.add(sunLight);
  sunGroup.position.set(0, 0, 0);

  // Planets (create meshes and add to existing groups)
  function planetMesh(radius, map) {
    return new THREE.Mesh(
      new THREE.SphereGeometry(radius, 32, 32),
      new THREE.MeshStandardMaterial({
        map,
        side: THREE.FrontSide,
        metalness: 0.2,
        roughness: 0.8,
      }),
    );
  }

  mercuryGroup.add(planetMesh(MERCURY_RADIUS * universalScaleFactor, mercuryTex));
  planetGroups.push({ group: mercuryGroup, z: MERCURY_ORBIT * universalScaleFactor });

  venusGroup.add(planetMesh(VENUS_RADIUS * universalScaleFactor, venusTex));
  // Venus clouds (tinted)
  const venusAtmosphereThickness = ATMOSPHERE_THICKNESS * universalScaleFactor;
  const venusAtmosphereRadius = VENUS_RADIUS * universalScaleFactor + venusAtmosphereThickness;
  venusCloudMesh = new THREE.Mesh(
    new THREE.SphereGeometry(venusAtmosphereRadius + CLOUD_OFFSET * universalScaleFactor, 64, 64),
    new THREE.MeshStandardMaterial({
      map: cloudTex,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      color: 0x8b8000,
    }),
  );
  venusGroup.add(venusCloudMesh);
  planetGroups.push({ group: venusGroup, z: VENUS_ORBIT * universalScaleFactor });

  earthGroup.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_RADIUS * universalScaleFactor, 64, 64),
      new THREE.MeshStandardMaterial({
        map: earthTex,
        side: THREE.FrontSide,
        metalness: 0.2,
        roughness: 0.8,
      }),
    ),
  );
  planetGroups.push({ group: earthGroup, z: EARTH_ORBIT * universalScaleFactor });

  moonGroup.add(planetMesh(MOON_RADIUS * universalScaleFactor, moonTex));

  marsGroup.add(planetMesh(MARS_RADIUS * universalScaleFactor, marsTex));
  // Mars clouds (tinted)
  marsCloudMesh = new THREE.Mesh(
    new THREE.SphereGeometry(MARS_RADIUS * universalScaleFactor + CLOUD_OFFSET * universalScaleFactor, 64, 64),
    new THREE.MeshStandardMaterial({
      map: cloudTex,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      color: 0x3b2a2a,
    }),
  );
  marsGroup.add(marsCloudMesh);
  planetGroups.push({ group: marsGroup, z: MARS_ORBIT * universalScaleFactor });

  jupiterGroup.add(planetMesh(JUPITER_RADIUS * universalScaleFactor, jupiterTex));
  planetGroups.push({ group: jupiterGroup, z: JUPITER_ORBIT * universalScaleFactor });

  saturnGroup.add(planetMesh(SATURN_RADIUS * universalScaleFactor, saturnTex));
  planetGroups.push({ group: saturnGroup, z: SATURN_ORBIT * universalScaleFactor });

  uranusGroup.add(planetMesh(URANUS_RADIUS * universalScaleFactor, uranusTex));
  planetGroups.push({ group: uranusGroup, z: URANUS_ORBIT * universalScaleFactor });

  neptuneGroup.add(planetMesh(NEPTUNE_RADIUS * universalScaleFactor, neptuneTex));
  planetGroups.push({ group: neptuneGroup, z: NEPTUNE_ORBIT * universalScaleFactor });

  // Saturn rings (particle positions)
  const ringOuterRadius = SATURN_RING_OUTER * universalScaleFactor;
  const ringInnerRadius = SATURN_RING_INNER * universalScaleFactor;
  const ringOuterRadius2 = SATURN_RING_OUTER2 * universalScaleFactor;
  const ringInnerRadius2 = SATURN_RING_INNER2 * universalScaleFactor;
  const count = 80000;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const useOuterRing = Math.random() < 0.67;
    const minRadius = useOuterRing ? ringInnerRadius : ringInnerRadius2;
    const maxRadius = useOuterRing ? ringOuterRadius : ringOuterRadius2;
    const r = THREE.MathUtils.randFloat(minRadius, maxRadius);
    const y = THREE.MathUtils.randFloatSpread(200 * universalScaleFactor);
    const x = r * Math.cos(theta);
    const z = r * Math.sin(theta);
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
  }
  const ringGeometry = new THREE.BufferGeometry();
  ringGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const ringMaterial = new THREE.PointsMaterial({
    size: 30 * universalScaleFactor,
    map: ringTex,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    color: 0xffffff,
  });
  const rings = new THREE.Points(ringGeometry, ringMaterial);
  rings.rotation.x = Math.PI / 2;
  saturnGroup.add(rings);

  // Clouds/atmospheres (reusing cloud texture)
  const atmosphereThickness = ATMOSPHERE_THICKNESS * universalScaleFactor;
  const earthAtmosphereRadius = EARTH_RADIUS * universalScaleFactor + atmosphereThickness;
  earthGroup.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(earthAtmosphereRadius, 64, 64),
      new THREE.MeshStandardMaterial({
        color: 0x00aaff,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
      }),
    ),
  );
  earthGroup.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(earthAtmosphereRadius + CLOUD_OFFSET * universalScaleFactor, 64, 64),
      new THREE.MeshStandardMaterial({
        map: cloudTex,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      }),
    ),
  );
  earthCloudMesh = earthGroup.children[earthGroup.children.length - 1];

  initializedSunPlanets = true;
}

export async function initStageAsteroids() {
  if (initializedAsteroids) return;
  const gltf = await loadModelFromRegistryAsync('environment', 'asteroidPack');
  const asteroidModel = gltf.scene;

  const asteroidCount = ASTEROID_COUNT;
  const radius = ASTEROID_BELT_RADIUS * universalScaleFactor;
  const asteroidScale = ASTEROID_BASE_SCALE * universalScaleFactor;

  const tiltX = (Math.random() * Math.PI * 2) - Math.PI;
  const tiltZ = (Math.random() * Math.PI * 2) - Math.PI;

  for (let i = 0; i < asteroidCount; i++) {
    const angle = (i / asteroidCount) * Math.PI * 2;
    const randomRadius = radius * (0.9 + Math.random() * 0.2);

    const xFlat = Math.cos(angle) * randomRadius;
    const zFlat = Math.sin(angle) * randomRadius;
    const yFlat = (Math.random() - 0.5) * ASTEROID_HEIGHT_VARIATION * universalScaleFactor;

    const yTiltX = yFlat * Math.cos(tiltX) - zFlat * Math.sin(tiltX);
    const zTiltX = yFlat * Math.sin(tiltX) + zFlat * Math.cos(tiltX);

    const xTilt = xFlat * Math.cos(tiltZ) - yTiltX * Math.sin(tiltZ);
    const yTilt = xFlat * Math.sin(tiltZ) + yTiltX * Math.cos(tiltZ);
    const zTilt = zTiltX;

    const asteroid = asteroidModel.clone(true);
    const scale = asteroidScale * (0.5 + Math.random());
    asteroid.scale.set(scale, scale, scale);
    asteroid.position.set(xTilt, yTilt, zTilt);
    asteroid.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    asteroidBeltGroup.add(asteroid);
  }

  initializedAsteroids = true;
}

export async function initStageBigShips() {
  if (initializedBigShips) return;

  const [sd, lu, ds] = await Promise.all([
    loadModelFromRegistryAsync('ships', 'starDestroyerII'),
    loadModelFromRegistryAsync('ships', 'lucrehulk'),
    loadModelFromRegistryAsync('ships', 'deathStar'),
  ]);

  // Star Destroyer (two instances)
  const sd1 = sd.scene.clone(true);
  sd1.scale.set(
    STAR_DESTROYER_SIZE * universalScaleFactor,
    STAR_DESTROYER_SIZE * universalScaleFactor,
    STAR_DESTROYER_SIZE * universalScaleFactor,
  );
  sd1.rotation.y = Math.PI;
  sd1.position.copy(collisionBox1.position);
  starDestroyerGroup.add(sd1);

  const sd2 = sd.scene.clone(true);
  sd2.scale.set(
    STAR_DESTROYER_SIZE * universalScaleFactor,
    STAR_DESTROYER_SIZE * universalScaleFactor,
    STAR_DESTROYER_SIZE * universalScaleFactor,
  );
  sd2.rotation.y = Math.PI;
  sd2.position.copy(collisionBox2.position);
  starDestroyerGroup.add(sd2);

  const lucre = lu.scene.clone(true);
  lucre.scale.set(
    LUCREHULK_SIZE * universalScaleFactor,
    LUCREHULK_SIZE * universalScaleFactor,
    LUCREHULK_SIZE * universalScaleFactor,
  );
  lucre.rotation.y = Math.PI;
  lucrehulkGroup.add(lucre);

  const death = ds.scene.clone(true);
  death.scale.set(
    DEATH_STAR_SIZE * universalScaleFactor,
    DEATH_STAR_SIZE * universalScaleFactor,
    DEATH_STAR_SIZE * universalScaleFactor,
  );
  death.rotation.x = Math.PI * 0.1;
  death.rotation.y = Math.PI * 0.7;
  deathStarGroup.add(death);

  initializedBigShips = true;
}

