import * as THREE from 'three';
import { TilesRenderer } from '/node_modules/3d-tiles-renderer/src/three/TilesRenderer.js';
import { CesiumIonAuthPlugin } from '/node_modules/3d-tiles-renderer/src/plugins/three/CesiumIonAuthPlugin.js';
import { GLTFExtensionsPlugin } from '/node_modules/3d-tiles-renderer/src/plugins/three/GLTFExtensionsPlugin.js';
import { DRACOLoader } from '/node_modules/three/examples/jsm/loaders/DRACOLoader.js';
import { OBJExporter } from '/node_modules/three/examples/jsm/exporters/OBJExporter.js';
import { OrbitControls } from '/node_modules/three/examples/jsm/controls/OrbitControls.js';

// Global variables
let scene, camera, renderer, tiles, controls;

const ionAssetId = '1415196';
let ionAccessToken = localStorage.getItem('ionApiKey') || 'YOUR_CESIUM_TOKEN_HERE';

// If running in Node.js, attempt to load token from config.json (optional, browser skips this)
async function loadTokenFromConfig() {
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    try {
      const fs = await import('fs/promises');
      const configData = await fs.readFile('./config.json', 'utf8');
      const config = JSON.parse(configData);
      ionAccessToken = config.cesiumAccessToken || ionAccessToken;
    } catch (error) {
      console.warn('Failed to load config.json, using localStorage or default token:', error);
    }
  }
}

// Initialize the scene, camera, renderer, and tiles
function init() {
  // Create the scene
  scene = new THREE.Scene();

  // Set up the camera
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 100000);
  camera.position.set(0, 100, 0); // Initial position, will be adjusted after tiles load
  camera.lookAt(0, 0, 0);

  // Set up the renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Set up OrbitControls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.update();

  // Initialize the TilesRenderer
  tiles = new TilesRenderer();
  tiles.fetchOptions.mode = 'cors';
  tiles.registerPlugin(new CesiumIonAuthPlugin({ apiToken: ionAccessToken, assetId: ionAssetId }));
  tiles.registerPlugin(new GLTFExtensionsPlugin({ dracoLoader: new DRACOLoader().setDecoderPath('./draco/') }));

  // When the tileset is loaded, position the camera and controls to view it
  tiles.addEventListener('load-tile-set', () => {
    const sphere = new THREE.Sphere();
    tiles.getBoundingSphere(sphere);
    const center = sphere.center;
    const radius = sphere.radius;
    camera.position.copy(center).add(new THREE.Vector3(0, radius, 0));
    camera.lookAt(center);
    controls.target.copy(center);
    controls.update();
    console.log('Tileset loaded, camera positioned at:', camera.position);
  });

  // Add the tiles group to the scene
  scene.add(tiles.group);

  // Event listeners for window resize and key press
  window.addEventListener('resize', onWindowResize, false);
  document.addEventListener('keydown', onKeyDown, false);

  console.log("Press 'e' to export the current scene as an OBJ file");

  // Start the animation loop
  animate();
}

// Animation loop to update and render the scene
function animate() {
  requestAnimationFrame(animate);
  tiles.setCamera(camera);
  tiles.setResolutionFromRenderer(camera, renderer);
  tiles.update();
  controls.update(); // Update controls for smooth navigation
  renderer.render(scene, camera);
}

// Handle window resize
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Handle key press to trigger export
function onKeyDown(event) {
  if (event.key === 'e') {
    exportSceneAsOBJ();
  }
}

// Export the scene as an OBJ file
function exportSceneAsOBJ() {
  const sphere = new THREE.Sphere();
  tiles.getBoundingSphere(sphere);
  const center = sphere.center.clone();

  // Temporarily translate the tiles to the origin to avoid large coordinates in Blender
  tiles.group.position.copy(center).negate();

  // Export the tiles group as OBJ
  const exporter = new OBJExporter();
  const result = exporter.parse(tiles.group);

  // Reset the position after exporting
  tiles.group.position.set(0, 0, 0);

  // Create a downloadable file
  const blob = new Blob([result], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sanfran_tiles.obj';
  a.click();
  URL.revokeObjectURL(url);

  console.log('Scene exported as sanfran_tiles.obj');
}

// Start the application
loadTokenFromConfig().then(() => init()).catch((err) => {
  console.error('Error loading token:', err);
  init(); // Proceed with default token if loading fails
});