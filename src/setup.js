// Setup.js
import * as THREE from 'three';
import { TilesRenderer } from '3d-tiles-renderer';

// Cesium is loaded globally via script tag in index.html
const Cesium = window.Cesium;

// Scene setup
export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 250000);
export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game-container').appendChild(renderer.domElement);

// Earth surface scene
export const earthSurfaceScene = new THREE.Scene();
earthSurfaceScene.background = new THREE.Color(0x87CEFA); // Brighter blue sky

// NYC center coordinates
const NYC_CENTER = { lat: 40.7128, lng: -74.0060 };

// Mapbox setup (no longer needed for imagery, but kept for consistency)
const MAPBOX_TOKEN = 'pk.eyJ1IjoiamJrYyIsImEiOiJjbTg3cTEwOHgwamdjMmtyMzczMTNoNmpxIn0.OkVdZogiJFH93fG0Pp4ZlQ';
const ZOOM = 14;
const TILE_SIZE = 1000;
const textureLoader = new THREE.TextureLoader();

// Cesium Ion setup for 3D buildings and Bing Maps Aerial
const CESIUM_ION_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJmM2NmMGU2Mi0zNDYxLTRhOTQtYmRiNi05Mzk0NTg4OTdjZDkiLCJpZCI6Mjg0MDk5LCJpYXQiOjE3NDE5MTI4Nzh9.ciqVryFsYbzdwKxd_nEANC8pHgU9ytlfylfpfy9Q56U';
const NYC_BUILDINGS_ASSET_ID = 75343; // New York City 3D Buildings
const BING_MAPS_AERIAL_ASSET_ID = 2;   // Bing Maps Aerial imagery

// Camera offset from movement.js
const surfaceCameraOffset = new THREE.Vector3(0, 2, -10); // Above and behind spacecraft
const smoothFactor = 0.1; // Smoothing factor for camera movement

// 3D Tiles renderer for buildings
let cesiumViewer;
let cesiumContainer;
let cesiumOverlay;

// Initialize Cesium 3D Tiles for buildings with Bing Maps Aerial underneath
async function initializeCesium3DTiles() {
    console.log("Initializing Cesium 3D Tiles");
    
    // Create a container for Cesium
    if (!cesiumContainer) {
        cesiumContainer = document.createElement('div');
        cesiumContainer.id = 'cesiumContainer';
        cesiumContainer.style.position = 'absolute';
        cesiumContainer.style.top = '0';
        cesiumContainer.style.left = '0';
        cesiumContainer.style.width = '100%';
        cesiumContainer.style.height = '100%';
        cesiumContainer.style.pointerEvents = 'none'; // Allow click-through
        cesiumContainer.style.display = 'none'; // Initially hidden
        document.body.appendChild(cesiumContainer);
        
        // Create loading indicator
        cesiumOverlay = document.createElement('div');
        cesiumOverlay.id = 'cesiumLoading';
        cesiumOverlay.style.position = 'absolute';
        cesiumOverlay.style.top = '0';
        cesiumOverlay.style.left = '0';
        cesiumOverlay.style.width = '100%';
        cesiumOverlay.style.height = '100%';
        cesiumOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        cesiumOverlay.style.display = 'flex';
        cesiumOverlay.style.justifyContent = 'center';
        cesiumOverlay.style.alignItems = 'center';
        cesiumOverlay.style.color = 'white';
        cesiumOverlay.style.fontFamily = 'Arial, sans-serif';
        cesiumOverlay.style.fontSize = '24px';
        cesiumOverlay.style.zIndex = '1000';
        cesiumOverlay.textContent = 'Loading New York 3D Buildings...';
        cesiumOverlay.style.display = 'none'; // Initially hidden
        document.body.appendChild(cesiumOverlay);
    }
    
    // Set Cesium Ion token
    Cesium.Ion.defaultAccessToken = CESIUM_ION_TOKEN;
    
    // Create Cesium viewer with minimal configuration
    cesiumViewer = new Cesium.Viewer(cesiumContainer, {
        terrainProvider: undefined,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        animation: false,
        timeline: false,
        fullscreenButton: false,
        requestRenderMode: true,
        maximumRenderTimeChange: Infinity
    });

    // Ensure the globe is transparent to show imagery
    cesiumViewer.scene.globe.baseColor = Cesium.Color.TRANSPARENT;

    // Remove all existing imagery layers to avoid conflicts
    cesiumViewer.imageryLayers.removeAll();

    // Add Bing Maps Aerial imagery as the base layer
    try {
        const bingMapsProvider = await Cesium.IonImageryProvider.fromAssetId(BING_MAPS_AERIAL_ASSET_ID);
        cesiumViewer.imageryLayers.addImageryProvider(bingMapsProvider);
        console.log("Bing Maps Aerial imagery loaded successfully");
    } catch (error) {
        console.error("Failed to load Bing Maps Aerial imagery:", error);
        // Fallback to a default imagery provider (OpenStreetMap) to diagnose
        cesiumViewer.imageryLayers.addImageryProvider(
            new Cesium.OpenStreetMapImageryProvider({
                url: 'https://tile.openstreetmap.org/'
            })
        );
        console.log("Fallback to OpenStreetMap imagery due to error");
    }
    
    // Load NYC 3D buildings
    return Cesium.IonResource.fromAssetId(NYC_BUILDINGS_ASSET_ID)
        .then(resource => {
            console.log("Ion resource resolved");
            return Cesium.Cesium3DTileset.fromUrl(resource);
        })
        .then(tileset => {
            console.log("Tileset created successfully");
            cesiumViewer.scene.primitives.add(tileset);
            
            // Position the camera to view NYC
            const nycPosition = Cesium.Cartesian3.fromDegrees(NYC_CENTER.lng, NYC_CENTER.lat, 1000);
            cesiumViewer.camera.flyTo({
                destination: nycPosition,
                orientation: {
                    heading: Cesium.Math.toRadians(0),
                    pitch: Cesium.Math.toRadians(-30),
                    roll: 0.0
                },
                duration: 1
            });
            
            if (cesiumOverlay) {
                cesiumOverlay.style.display = 'none';
            }
            
            return tileset;
        })
        .catch(error => {
            console.error('Error loading Cesium 3D Tiles:', error);
            if (cesiumOverlay) {
                cesiumOverlay.textContent = 'Error: ' + error.message;
            }
            throw error;
        });
}

// Helper function to convert lat/lng to tile coordinates
function latLngToTile(lat, lng, zoom) {
    const n = Math.pow(2, zoom);
    const x = Math.floor(((lng + 180) / 360) * n);
    const latRad = lat * Math.PI / 180;
    const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
    return { x, y };
}

// TileManager class for dynamic Mapbox tile loading (no longer needed for imagery, kept for reference)
class TileManager {
    constructor() {
        this.tiles = new Map();
    }

    latLngToTile(lat, lng, zoom) {
        return latLngToTile(lat, lng, zoom);
    }

    update(centerLat, centerLng, viewRadius) {
        const centerTile = this.latLngToTile(centerLat, centerLng, ZOOM);
        const tilesNeeded = Math.ceil(viewRadius / TILE_SIZE) + 1;

        for (let dx = -tilesNeeded; dx <= tilesNeeded; dx++) {
            for (let dy = -tilesNeeded; dy <= tilesNeeded; dy++) {
                const tileX = centerTile.x + dx;
                const tileY = centerTile.y + dy;
                const key = `${tileX},${tileY}`;
                if (!this.tiles.has(key)) this.loadTile(tileX, tileY);
            }
        }

        this.tiles.forEach((mesh, key) => {
            const [x, y] = key.split(',').map(Number);
            if (Math.abs(x - centerTile.x) > tilesNeeded || Math.abs(y - centerTile.y) > tilesNeeded) {
                earthSurfaceScene.remove(mesh);
                this.tiles.delete(key);
            }
        });
    }

    loadTile(x, y) {
        const url = `https://api.mapbox.com/v4/mapbox.satellite/${ZOOM}/${x}/{y}@2x.png?access_token=${MAPBOX_TOKEN}`;
        const geometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
        const texture = textureLoader.load(url, () => texture.needsUpdate = true);
        const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(
            (x - this.latLngToTile(NYC_CENTER.lat, NYC_CENTER.lng, ZOOM).x) * TILE_SIZE,
            0,
            (y - this.latLngToTile(NYC_CENTER.lat, NYC_CENTER.lng, ZOOM).y) * TILE_SIZE
        );
        earthSurfaceScene.add(mesh);
        this.tiles.set(`${x},${y}`, mesh);
    }
}

const tileManager = new TileManager();

// Add lighting to earthSurfaceScene
const earthAmbientLight = new THREE.AmbientLight(0xffffff, 0.5);
earthSurfaceScene.add(earthAmbientLight);
const earthDirectionalLight = new THREE.DirectionalLight(0xffffff, 1);
earthDirectionalLight.position.set(1, 1, 1);
earthSurfaceScene.add(earthDirectionalLight);

// Add fog for depth
earthSurfaceScene.fog = new THREE.FogExp2(0x87CEFA, 0.0003);

// Flags
export let isEarthSurfaceActive = false;
export let isTransitionInProgress = false;

// Check proximity to Earth (assuming earthGroup and spacecraft are defined elsewhere)
export function checkEarthProximity() {
    const earthPosition = earthGroup.position.clone();
    const spacecraftPosition = spacecraft.position.clone();
    const distance = earthPosition.distanceTo(spacecraftPosition);

    if (distance < planetRadius + 800 && !isEarthSurfaceActive && !isTransitionInProgress) {
        startAtmosphereTransition();
    }

    if (distance < planetRadius + 500 && !isEarthSurfaceActive && isTransitionInProgress) {
        const overlay = document.getElementById('transition-overlay');
        if (overlay && parseFloat(getComputedStyle(overlay).opacity) > 0.3) {
            transitionToEarthSurface();
        }
    }
}

// Start atmosphere transition
function startAtmosphereTransition() {
    console.log("Approaching Earth's atmosphere...");
    isTransitionInProgress = true;

    const overlay = document.createElement('div');
    overlay.id = 'transition-overlay';
    overlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(135, 206, 250, 0);
        opacity: 0;
        pointer-events: none;
        z-index: 999;
    `;
    document.body.appendChild(overlay);

    const transitionDuration = 1000;
    const startTime = performance.now();

    function animatePreTransition() {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / transitionDuration, 1);
        overlay.style.opacity = (0.6 * progress).toString();

        if (progress < 1 && !isEarthSurfaceActive) {
            requestAnimationFrame(animatePreTransition);
        }
    }
    animatePreTransition();
}

// Transition to Earth surface
export function transitionToEarthSurface() {
    console.log("Entering Earth's atmosphere!");
    isEarthSurfaceActive = true;

    // Initialize Cesium 3D Tiles if not already initialized
    if (!cesiumViewer) {
        if (cesiumOverlay) cesiumOverlay.style.display = 'flex';
        initializeCesium3DTiles().then(() => {
            // Show Cesium container after initialization
            if (cesiumContainer) cesiumContainer.style.display = 'block';
        });
    } else {
        // Show Cesium container immediately if already initialized
        if (cesiumContainer) cesiumContainer.style.display = 'block';
    }

    const earthSpacecraft = new THREE.Group();
    earthSpacecraft.name = "EarthSurfaceSpacecraft";
    spacecraft.children.forEach(child => {
        const childClone = child.clone();
        if (child.name) childClone.name = child.name;
        earthSpacecraft.add(childClone);
    });
    earthSpacecraft.position.set(0, 10000, -2000);
    earthSpacecraft.rotation.set(-Math.PI * 0.25, 0, 0);
    earthSurfaceScene.add(earthSpacecraft);

    const overlay = document.getElementById('transition-overlay');
    const transitionDuration = 1000;
    const startTime = performance.now();
    const originalFogDensity = 0.0003;
    earthSurfaceScene.fog.density = 0.02;

    function animateTransition() {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / transitionDuration, 1);
        earthSurfaceScene.fog.density = 0.02 - (0.02 - originalFogDensity) * progress;
        if (overlay) overlay.style.opacity = (0.6 * (1 - progress)).toString();

        if (earthSpacecraft) {
            const newY = 4000 - (4000 - 1500) * progress;
            const newZ = -2000 + (2000 + 500) * progress;
            earthSpacecraft.position.set(0, newY, newZ);
            const newPitch = -Math.PI * 0.25 + (Math.PI * 0.45) * progress;
            earthSpacecraft.rotation.set(newPitch, 0, 0);

            // Camera transition using surfaceCameraOffset
            const surfaceCameraPosition = surfaceCameraOffset.clone().applyMatrix4(earthSpacecraft.matrixWorld);
            camera.position.lerp(surfaceCameraPosition, smoothFactor);
            camera.quaternion.copy(earthSpacecraft.quaternion);
            const adjustment = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0));
            camera.quaternion.multiply(adjustment);
        }

        if (progress < 1) {
            requestAnimationFrame(animateTransition);
        } else {
            if (overlay) document.body.removeChild(overlay);
            earthSurfaceScene.fog.density = originalFogDensity;
            isTransitionInProgress = false;
            displayEarthSurfaceMessage();
        }
    }
    animateTransition();
}

// Display message
function displayEarthSurfaceMessage() {
    const message = document.createElement('div');
    message.id = 'earth-surface-message';
    message.style.cssText = `
        position: absolute;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        color: white;
        font-family: Orbitron, sans-serif;
        font-size: 18px;
        text-align: center;
        padding: 8px 15px;
        background-color: rgba(0, 0, 0, 0.5);
        border-radius: 5px;
        z-index: 1000;
    `;
    message.textContent = 'Press ESC to leave Earth\'s atmosphere';
    document.body.appendChild(message);
}

// Exit Earth surface
export function exitEarthSurface() {
    console.log("Exiting Earth's atmosphere!");
    isEarthSurfaceActive = false;
    
    // Hide Cesium container
    if (cesiumContainer) {
        cesiumContainer.style.display = 'none';
    }
    
    // Remove Earth surface spacecraft
    const earthSpacecraft = earthSurfaceScene.getObjectByName('EarthSurfaceSpacecraft');
    if (earthSpacecraft) {
        earthSurfaceScene.remove(earthSpacecraft);
    }
    
    // Reset camera position
    camera.position.copy(spacecraft.position);
    camera.position.y += 5;
    camera.position.z -= 20;
    camera.lookAt(spacecraft.position);
    
    // Position spacecraft away from Earth to avoid immediate re-entry
    const directionVector = new THREE.Vector3(1, 1, 1).normalize();
    spacecraft.position.set(
        earthGroup.position.x + directionVector.x * (planetRadius * 3 + 1000),
        earthGroup.position.y + directionVector.y * (planetRadius * 3 + 1000),
        earthGroup.position.z + directionVector.z * (planetRadius * 3 + 1000)
    );
    
    // Create transition effect
    const overlay = document.getElementById('transition-overlay');
    if (overlay) {
        overlay.style.opacity = '0.6';
        setTimeout(() => {
            overlay.style.opacity = '0';
        }, 1000);
    }
}

// Render function with Cesium 3D Tiles updates and camera logic
export function renderScene() {
    if (isEarthSurfaceActive) {
        const earthSpacecraft = earthSurfaceScene.getObjectByName('EarthSurfaceSpacecraft');
        if (earthSpacecraft) {
            // Update camera using surfaceCameraOffset
            const surfaceCameraPosition = surfaceCameraOffset.clone().applyMatrix4(earthSpacecraft.matrixWorld);
            camera.position.lerp(surfaceCameraPosition, smoothFactor);
            camera.quaternion.copy(earthSpacecraft.quaternion);
            const adjustment = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0));
            camera.quaternion.multiply(adjustment);

            // Update Cesium camera to match Three.js camera position
            if (cesiumViewer) {
                // Convert Three.js position to Cesium position
                const height = 1000; // Height in meters above ground
                const cesiumPosition = Cesium.Cartesian3.fromDegrees(
                    NYC_CENTER.lng + (earthSpacecraft.position.x / (111320 * Math.cos(NYC_CENTER.lat * Math.PI / 180))),
                    NYC_CENTER.lat + (earthSpacecraft.position.z / 111320),
                    height
                );
                
                // Get heading and pitch from Three.js camera
                const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
                const heading = Math.atan2(direction.x, direction.z);
                const pitch = Math.asin(direction.y);
                
                // Update Cesium camera
                cesiumViewer.camera.setView({
                    destination: cesiumPosition,
                    orientation: {
                        heading: -heading, // Negate heading to match Three.js
                        pitch: pitch,
                        roll: 0
                    }
                });
                
                // Force Cesium to render a frame
                cesiumViewer.scene.requestRender();
            }
        }
        
        // Render Three.js scene on top of Cesium
        renderer.render(earthSurfaceScene, camera);
    } else {
        // Hide Cesium container when not in Earth surface mode
        if (cesiumContainer) {
            cesiumContainer.style.display = 'none';
        }
        
        // Render normal space scene
        renderer.render(scene, camera);
    }
}

// Basic controls for surface movement
document.addEventListener('keydown', (event) => {
    if (!isEarthSurfaceActive) return;
    const earthSpacecraft = earthSurfaceScene.getObjectByName('EarthSurfaceSpacecraft');
    if (!earthSpacecraft) return;

    const speed = 20;
    switch (event.key) {
        case 'ArrowUp': earthSpacecraft.position.z -= speed; break;
        case 'ArrowDown': earthSpacecraft.position.z += speed; break;
        case 'ArrowLeft': earthSpacecraft.position.x -= speed; break;
        case 'ArrowRight': earthSpacecraft.position.x += speed; break;
        case 'Escape': exitEarthSurface(); break;
    }
});

////////

// Skybox setup
// const skyboxTexture = textureLoader.load('skybox/galaxy5.jpeg');
// const skyboxGeometry = new THREE.BoxGeometry(250000, 250000, 250000);
// const skyboxMaterial = new THREE.MeshBasicMaterial({
//     map: skyboxTexture,
//     side: THREE.BackSide,
//     depthWrite: false, // Prevent depth interference
//     depthTest: false   // Avoid rendering issues
// });
// const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
// skybox.position.set(0, 0, 0); // Ensure centered at origin
// scene.add(skybox);

// --- Sun Setup ---
const sunGroup = new THREE.Group();
scene.add(sunGroup);

const sunRadius = 10000;
const sunGeometry = new THREE.SphereGeometry(sunRadius, 64, 64);
const sunTexture = textureLoader.load('skybox/2k_sun.jpg');
const sunMaterial = new THREE.MeshStandardMaterial({
    map: sunTexture,
    emissive: 0xffffff,
    emissiveIntensity: 0.4,
    side: THREE.FrontSide
});
export const sun = new THREE.Mesh(sunGeometry, sunMaterial);
sunGroup.add(sun);

// Blazing effect
const blazingMaterial = new THREE.ShaderMaterial({
    uniforms: {
        time: { value: 0 },
        intensity: { value: 0.5 },
        baseColor: { value: new THREE.Vector3(1.0, 0.5, 0.0) },
        noiseScale: { value: 2.0 }
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
    blending: THREE.AdditiveBlending
});
const blazingGeometry = new THREE.SphereGeometry(sunRadius * 1.2, 64, 64);
const blazingEffect = new THREE.Mesh(blazingGeometry, blazingMaterial);
sunGroup.add(blazingEffect);

// Halo
const haloGeometry = new THREE.SphereGeometry(sunRadius * 1.2, 32, 32);
const haloMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.5 });
const halo = new THREE.Mesh(haloGeometry, haloMaterial);
sunGroup.add(halo);

// Sun light
const sunLight = new THREE.PointLight(0xffffff, 2, 45000);
sunGroup.add(sunLight);

sunGroup.position.set(0, 0, 0);

function animateSun() {
    blazingMaterial.uniforms.time.value += 0.02;
    blazingEffect.scale.setScalar(0.9 + Math.sin(blazingMaterial.uniforms.time.value * 1.0) * 0.05);
    requestAnimationFrame(animateSun);
}
animateSun();


// ... [All your existing setup.js code up to planet definitions] ...

// Planet definitions and randomization
const planetGroups = [];
const positionRange = 100000; // Not used directly, kept for reference

// --- Mercury Setup ---
const mercuryGroup = new THREE.Group();
scene.add(mercuryGroup);
const mercuryRadius = 1000;
const mercuryGeometry = new THREE.SphereGeometry(mercuryRadius, 32, 32);
const mercuryTexture = textureLoader.load('skybox/2k_mercury.jpg');
const mercuryMaterial = new THREE.MeshStandardMaterial({
    map: mercuryTexture,
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.8
});
const mercury = new THREE.Mesh(mercuryGeometry, mercuryMaterial);
mercuryGroup.add(mercury);
planetGroups.push({ group: mercuryGroup, z: 20000 });

// --- Venus Setup ---
const venusGroup = new THREE.Group();
scene.add(venusGroup);
const venusRadius = 2000;
const venusGeometry = new THREE.SphereGeometry(venusRadius, 32, 32);
const venusTexture = textureLoader.load('skybox/2k_venus_surface.jpg');
const venusMaterial = new THREE.MeshStandardMaterial({
    map: venusTexture,
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.8
});
const venus = new THREE.Mesh(venusGeometry, venusMaterial);
venusGroup.add(venus);
const venusAtmosphereThickness = 50;
const venusAtmosphereRadius = venusRadius + venusAtmosphereThickness;
const venusAtmosphereGeometry = new THREE.SphereGeometry(venusAtmosphereRadius, 64, 64);
const venusAtmosphereMaterial = new THREE.MeshStandardMaterial({
    color: 0xffff00,
    transparent: true,
    opacity: 0.2,
    side: THREE.DoubleSide
});
const venusAtmosphere = new THREE.Mesh(venusAtmosphereGeometry, venusAtmosphereMaterial);
venusGroup.add(venusAtmosphere);
const cloudTexture = textureLoader.load('skybox/Earth-clouds.png');
const venusCloudMaterial = new THREE.MeshStandardMaterial({
    map: cloudTexture,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
    color: 0x8B8000
});
const venusCloudGeometry = new THREE.SphereGeometry(venusAtmosphereRadius + 5, 64, 64);
const venusCloudMesh = new THREE.Mesh(venusCloudGeometry, venusCloudMaterial);
venusGroup.add(venusCloudMesh);
planetGroups.push({ group: venusGroup, z: 27000 });

function animateVenusClouds() {
    venusCloudMesh.rotation.y += 0.0005;
    requestAnimationFrame(animateVenusClouds);
}
animateVenusClouds();

// --- Earth Setup ---
const earthGroup = new THREE.Group();
scene.add(earthGroup);
const planetRadius = 2000;
const planetGeometry = new THREE.SphereGeometry(planetRadius, 64, 64);
const planetTexture = textureLoader.load('skybox/2k_earth_daymap.jpg');
const planetMaterial = new THREE.MeshStandardMaterial({
    map: planetTexture,
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.8
});
export const planet = new THREE.Mesh(planetGeometry, planetMaterial);
earthGroup.add(planet);
const atmosphereThickness = 50;
const atmosphereRadius = planetRadius + atmosphereThickness;
const atmosphereGeometry = new THREE.SphereGeometry(atmosphereRadius, 64, 64);
const atmosphereMaterial = new THREE.MeshStandardMaterial({
    color: 0x00aaff,
    transparent: true,
    opacity: 0.2,
    side: THREE.DoubleSide
});
const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
earthGroup.add(atmosphere);
const earthCloudMaterial = new THREE.MeshStandardMaterial({
    map: cloudTexture,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide
});
const earthCloudGeometry = new THREE.SphereGeometry(atmosphereRadius + 5, 64, 64);
const earthCloudMesh = new THREE.Mesh(earthCloudGeometry, earthCloudMaterial);
earthGroup.add(earthCloudMesh);
planetGroups.push({ group: earthGroup, z: 40000 });

function animateEarthClouds() {
    earthCloudMesh.rotation.y += 0.0005;
    requestAnimationFrame(animateEarthClouds);
}
animateEarthClouds();

// --- Mars Setup ---
const marsGroup = new THREE.Group();
scene.add(marsGroup);
const marsRadius = 1500;
const marsGeometry = new THREE.SphereGeometry(marsRadius, 32, 32);
const marsTexture = textureLoader.load('skybox/2k_mars.jpg');
const marsMaterial = new THREE.MeshStandardMaterial({
    map: marsTexture,
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.8
});
const mars = new THREE.Mesh(marsGeometry, marsMaterial);
marsGroup.add(mars);
const redCloudTexture = textureLoader.load('skybox/Earth-clouds.png');
const marsCloudMaterial = new THREE.MeshStandardMaterial({
    map: redCloudTexture,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
    color: 0x3B2A2A
});
const marsCloudGeometry = new THREE.SphereGeometry(marsRadius + 5, 64, 64);
const marsCloudMesh = new THREE.Mesh(marsCloudGeometry, marsCloudMaterial);
marsGroup.add(marsCloudMesh);
planetGroups.push({ group: marsGroup, z: 50000 });

function animateMarsClouds() {
    marsCloudMesh.rotation.y += 0.0005;
    requestAnimationFrame(animateMarsClouds);
}
animateMarsClouds();

// --- Jupiter Setup ---
const jupiterGroup = new THREE.Group();
scene.add(jupiterGroup);
const jupiterRadius = 5000;
const jupiterGeometry = new THREE.SphereGeometry(jupiterRadius, 32, 32);
const jupiterTexture = textureLoader.load('skybox/2k_jupiter.jpg');
const jupiterMaterial = new THREE.MeshStandardMaterial({
    map: jupiterTexture,
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.8
});
const jupiter = new THREE.Mesh(jupiterGeometry, jupiterMaterial);
jupiterGroup.add(jupiter);
planetGroups.push({ group: jupiterGroup, z: 60000 });

function animateJupiterClouds() {
    requestAnimationFrame(animateJupiterClouds);
}
animateJupiterClouds();

// --- Saturn Setup ---
const saturnGroup = new THREE.Group();
scene.add(saturnGroup);
const saturnRadius = 4000;
const saturnGeometry = new THREE.SphereGeometry(saturnRadius, 32, 32);
const saturnTexture = textureLoader.load('skybox/2k_saturn.jpg');
const saturnMaterial = new THREE.MeshStandardMaterial({
    map: saturnTexture,
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.8
});
const saturn = new THREE.Mesh(saturnGeometry, saturnMaterial);
saturnGroup.add(saturn);
const ringTexture = textureLoader.load('skybox/saturn_rings.png');
const ringRadius = 5000;
const ringThickness = 20;
const ringGeometry = new THREE.RingGeometry(ringRadius, ringRadius + ringThickness, 64);
const ringMaterial = new THREE.MeshStandardMaterial({
    map: ringTexture,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8
});
const saturnRings = new THREE.Mesh(ringGeometry, ringMaterial);
saturnRings.rotation.x = Math.PI / 2;
saturnGroup.add(saturnRings);
planetGroups.push({ group: saturnGroup, z: 80000 });

// --- Uranus Setup ---
const uranusGroup = new THREE.Group();
scene.add(uranusGroup);
const uranusRadius = 3000;
const uranusGeometry = new THREE.SphereGeometry(uranusRadius, 32, 32);
const uranusTexture = textureLoader.load('skybox/2k_uranus.jpg');
const uranusMaterial = new THREE.MeshStandardMaterial({
    map: uranusTexture,
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.8
});
const uranus = new THREE.Mesh(uranusGeometry, uranusMaterial);
uranusGroup.add(uranus);
planetGroups.push({ group: uranusGroup, z: 95000 });

// --- Neptune Setup ---
const neptuneGroup = new THREE.Group();
scene.add(neptuneGroup);
const neptuneRadius = 3000;
const neptuneGeometry = new THREE.SphereGeometry(neptuneRadius, 32, 32);
const neptuneTexture = textureLoader.load('skybox/2k_neptune.jpg');
const neptuneMaterial = new THREE.MeshStandardMaterial({
    map: neptuneTexture,
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.8
});
const neptune = new THREE.Mesh(neptuneGeometry, neptuneMaterial);
neptuneGroup.add(neptune);
planetGroups.push({ group: neptuneGroup, z: 110000 });

// Randomize planet positions
planetGroups.forEach(planet => {
    const angle = Math.random() * Math.PI * 2; // Random angle in radians
    const radius = planet.z; // Use original Z as radius
    planet.group.position.set(
        Math.cos(angle) * radius, // X
        Math.sin(angle) * radius, // Y
        0                         // Z = 0, XY plane
    );
    console.log(`${planet.group.name || 'Planet'} position:`, planet.group.position); // Debug
});


// Concentric circles (already updated to remove radial lines)
function createConcentricCircles() {
    const sunPosition = sunGroup.position; // (0, 0, 0)
    planetGroups.forEach(planet => {
        const planetPos = planet.group.position;
        const distance = sunPosition.distanceTo(planetPos);
        const angle = Math.atan2(planetPos.y, planetPos.x);

        const circleGeometry = new THREE.CircleGeometry(distance, 64);
        const vertices = circleGeometry.attributes.position.array;
        const ringVertices = new Float32Array(vertices.length - 3);
        for (let i = 3; i < vertices.length; i++) {
            ringVertices[i - 3] = vertices[i];
        }
        const ringGeometry = new THREE.BufferGeometry();
        ringGeometry.setAttribute('position', new THREE.BufferAttribute(ringVertices, 3));
        const circleMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
        const circle = new THREE.LineLoop(ringGeometry, circleMaterial);

        circle.position.copy(sunPosition);
        circle.rotation.x = Math.PI / 2;
        circle.rotation.y = angle;
        scene.add(circle);
    });
}

// createConcentricCircles(); // ** TOGGLE ORBITAL LINES ON AND OFF **

// Planet labels
const labelData = [
    { group: mercuryGroup, name: 'Mercury', radius: 1000 },
    { group: venusGroup, name: 'Venus', radius: 2000 },
    { group: earthGroup, name: 'Earth', radius: 2000 },
    { group: marsGroup, name: 'Mars', radius: 1500 },
    { group: jupiterGroup, name: 'Jupiter', radius: 5000 },
    { group: saturnGroup, name: 'Saturn', radius: 4000 },
    { group: uranusGroup, name: 'Uranus', radius: 3000 },
    { group: neptuneGroup, name: 'Neptune', radius: 3000 }
];

// Create and store label elements
const labels = [];
labelData.forEach(planet => {
    const label = document.createElement('div');
    label.className = 'planet-label';
    label.textContent = planet.name;
    document.body.appendChild(label); // Add to DOM
    labels.push({
        element: label,
        planetGroup: planet.group,
        radius: planet.radius
    });
});

// Create a special distance indicator for Earth
const earthDistanceIndicator = document.createElement('div');
earthDistanceIndicator.className = 'distance-indicator';
earthDistanceIndicator.style.color = 'white';
earthDistanceIndicator.style.fontFamily = 'Orbitron, sans-serif';
earthDistanceIndicator.style.fontSize = '18px';
earthDistanceIndicator.style.textAlign = 'center';
earthDistanceIndicator.style.position = 'absolute';
earthDistanceIndicator.style.display = 'none'; // Initially hidden
document.body.appendChild(earthDistanceIndicator);

// Function to update label positions
export function updatePlanetLabels() {
    // If on Earth's surface, hide all planet labels
    if (isEarthSurfaceActive) {
        labels.forEach(label => {
            label.element.style.display = 'none';
        });
        earthDistanceIndicator.style.display = 'none';
        return;
    }

    const vector = new THREE.Vector3();
    const cameraPosition = new THREE.Vector3();
    camera.getWorldPosition(cameraPosition); // Get camera's world position

    // Calculate distance to Earth for the indicator
    const earthPosition = earthGroup.position.clone();
    const spacecraftPosition = spacecraft.position.clone();
    const distanceToEarth = earthPosition.distanceTo(spacecraftPosition);
    const distanceToEntry = Math.max(0, distanceToEarth - (planetRadius + 500)); // 500 is the entry threshold
    
    // Update the distance indicator text
    earthDistanceIndicator.textContent = `DISTANCE TO ENTRY: ${Math.round(distanceToEntry)}`;

    labels.forEach(label => {
        // Get planet's world position
        label.planetGroup.getWorldPosition(vector);
        
        // Offset above the planet's surface
        vector.y += label.radius * 1.2;

        // Check if the planet is in front of the camera
        const directionToPlanet = vector.clone().sub(cameraPosition);
        const cameraForward = new THREE.Vector3(0, 0, -1); // Camera looks along negative Z
        cameraForward.applyQuaternion(camera.quaternion); // Align with camera rotation
        const dot = directionToPlanet.dot(cameraForward);

        if (dot > 0) { // Planet is in front of the camera
            // Project 3D position to 2D screen coordinates
            vector.project(camera);

            // Convert to screen space
            const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
            const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;

            // Position the label
            label.element.style.left = `${x}px`;
            label.element.style.top = `${y}px`;
            label.element.style.transform = 'translateX(-50%)';
            label.element.style.display = 'block'; // Show the label
            
            // If this is Earth, position the distance indicator below it
            if (label.planetGroup === earthGroup) {
                earthDistanceIndicator.style.left = `${x}px`;
                earthDistanceIndicator.style.top = `${y + 35}px`; // Increased from 20px to 35px for more spacing
                earthDistanceIndicator.style.transform = 'translateX(-50%)';
                earthDistanceIndicator.style.display = 'block'; // Show the distance indicator
            }
        } else {
            // Hide the label if the planet is behind the camera
            label.element.style.display = 'none';
            
            // If this is Earth, also hide the distance indicator
            if (label.planetGroup === earthGroup) {
                earthDistanceIndicator.style.display = 'none';
            }
        }
    });
}

// ... [Rest of your setup.js: renderer settings, spacecraft, hyperspace] ...



// Exports

// Renderer settings
renderer.setPixelRatio(window.devicePixelRatio);
renderer.autoClear = true;
renderer.sortObjects = false;
renderer.physicallyCorrectLights = false;

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(1, 1, -1).normalize();
scene.add(directionalLight);

const sideLight = new THREE.DirectionalLight(0xffffff, 0.5);
sideLight.position.set(-1, -1, 1).normalize();
scene.add(sideLight);

scene.background = new THREE.Color(0x000000);

// ... [Spacecraft setup unchanged] ...

// X-wing spacecraft
export const spacecraft = new THREE.Group();

// Materials
const metalMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.3, envMapIntensity: 1.0 });
const paintMaterial = new THREE.MeshStandardMaterial({ color: 0xe5e5e5, metalness: 0.2, roughness: 0.7 });
const redPaintMaterial = new THREE.MeshStandardMaterial({ color: 0xff3333, metalness: 0.2, roughness: 0.7 });
const darkMetalMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.9, roughness: 0.2 });
const glassMaterial = new THREE.MeshPhysicalMaterial({ color: 0x000000, metalness: 0, roughness: 0, transmission: 1, transparent: true, opacity: 0.3, envMapIntensity: 1.0 });
export const engineGlowMaterial = new THREE.MeshStandardMaterial({ color: 0xff00ff, emissive: 0xff00ff, emissiveIntensity: 2.5, transparent: true, opacity: 0.9 });
export const boostFlameMaterial = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, intensity: { value: 0.0 } },
    vertexShader: `
        varying vec3 vPosition;
        varying vec3 vNormal;
        void main() {
            vPosition = position;
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float time;
        uniform float intensity;
        varying vec3 vPosition;
        varying vec3 vNormal;
        float rand(vec2 co) {
            return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
        }
        void main() {
            float t = time * 3.0;
            float pulse = (sin(t) * 0.5 + 0.5) * 0.3;
            float glow = pow(0.9 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 1.5);
            vec3 coreColor = vec3(1.0, 0.0, 1.0);
            vec3 outerColor = vec3(0.8, 0.2, 1.0);
            vec3 color = mix(outerColor, coreColor, glow + pulse);
            glow *= (1.0 + intensity * 1.5);
            color *= (1.0 + intensity * 0.5);
            color *= 1.5 + intensity * 0.5;
            gl_FragColor = vec4(color, (glow + pulse) * (0.7 + intensity * 0.3));
        }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending
});
export const lightMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.0, transparent: true, opacity: 0.7 });

// Fuselage
const fuselageGeometry = new THREE.CylinderGeometry(0.3, 0.3, 3.5, 12);
const fuselage = new THREE.Mesh(fuselageGeometry, paintMaterial);
fuselage.rotation.z = Math.PI / 2;
spacecraft.add(fuselage);

const fuselageDetailGeometry = new THREE.CylinderGeometry(0.32, 0.32, 0.1, 12);
const detailPositions = [-1.5, -1.0, -0.5, 0, 0.5, 1.0, 1.5];
detailPositions.forEach(pos => {
    const detail = new THREE.Mesh(fuselageDetailGeometry, metalMaterial);
    detail.rotation.z = Math.PI / 2;
    detail.position.z = pos;
    fuselage.add(detail);
});

// Nose
const noseGeometry = new THREE.CylinderGeometry(0.3, 0.05, 1.2, 12);
const nose = new THREE.Mesh(noseGeometry, paintMaterial);
nose.position.z = 2.35;
nose.rotation.x = Math.PI / 2;
spacecraft.add(nose);

const noseRingGeometry = new THREE.TorusGeometry(0.31, 0.02, 8, 24);
const noseRing1 = new THREE.Mesh(noseRingGeometry, metalMaterial);
noseRing1.position.z = 2.0;
spacecraft.add(noseRing1);

const noseRing2 = new THREE.Mesh(noseRingGeometry, metalMaterial);
noseRing2.position.z = 2.3;
spacecraft.add(noseRing2);

// Cockpit
const cockpitGeometry = new THREE.SphereGeometry(0.25, 32, 24, 0, Math.PI * 2, 0, Math.PI / 1.5);
const cockpitOuter = new THREE.Mesh(cockpitGeometry, metalMaterial);
cockpitOuter.position.set(0, 0.25, 0);
spacecraft.add(cockpitOuter);

const cockpitGlassGeometry = new THREE.SphereGeometry(0.24, 32, 24, 0, Math.PI * 2, 0, Math.PI / 1.5);
const cockpitGlass = new THREE.Mesh(cockpitGlassGeometry, glassMaterial);
cockpitGlass.position.set(0, 0.25, 0);
spacecraft.add(cockpitGlass);

// Engines
const engineGeometry = new THREE.CylinderGeometry(0.15, 0.12, 0.8, 12);
const enginePositions = [
    { x: 0.4, y: 0.3, z: -1 },
    { x: -0.4, y: 0.3, z: -1 },
    { x: 0.4, y: -0.3, z: -1 },
    { x: -0.4, y: -0.3, z: -1 }
];
enginePositions.forEach(pos => {
    const engine = new THREE.Mesh(engineGeometry, metalMaterial);
    engine.position.set(pos.x, pos.y, pos.z);
    engine.rotation.x = Math.PI / 2;
    spacecraft.add(engine);

    const intakeGeometry = new THREE.TorusGeometry(0.15, 0.02, 8, 24);
    const intake = new THREE.Mesh(intakeGeometry, darkMetalMaterial);
    intake.position.set(pos.x, pos.y, pos.z - 0.4);
    spacecraft.add(intake);

    const innerGlowGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.1, 12);
    const innerGlow = new THREE.Mesh(innerGlowGeometry, engineGlowMaterial);
    innerGlow.position.set(pos.x, pos.y, pos.z + 0.35);
    innerGlow.rotation.x = Math.PI / 2;
    spacecraft.add(innerGlow);

    const glowSphereGeometry = new THREE.SphereGeometry(0.2, 16, 16);
    const glowSphere = new THREE.Mesh(glowSphereGeometry, boostFlameMaterial);
    glowSphere.position.set(pos.x, pos.y, pos.z - 0.4);
    glowSphere.visible = true;
    spacecraft.add(glowSphere);
});

let engineTime = 0;
export function updateEngineEffects(isBoost) {
    engineTime += 0.016;
    spacecraft.traverse((child) => {
        if (child.material === boostFlameMaterial) {
            child.material.uniforms.time.value = engineTime;
            child.material.uniforms.intensity.value = isBoost ? 1.0 : 0.0;
            child.scale.setScalar(isBoost ? 1.5 : 1.0);
        }
    });
}

// Wing creation
export function createWing(x, y, z, rotationZ) {
    const wingGroup = new THREE.Group();
    wingGroup.position.set(x, y, z);
    wingGroup.rotation.z = rotationZ;

    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, -0.1);
    wingShape.lineTo(2.5, -0.15);
    wingShape.lineTo(2.5, 0.15);
    wingShape.lineTo(0, 0.1);
    wingShape.lineTo(0, -0.1);

    const wingExtrudeSettings = { steps: 1, depth: 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3 };
    const wingGeometry = new THREE.ExtrudeGeometry(wingShape, wingExtrudeSettings);
    const wing = new THREE.Mesh(wingGeometry, paintMaterial);
    wingGroup.add(wing);

    const stripeGeometry = new THREE.BoxGeometry(0.5, 0.06, 0.08);
    const stripe1 = new THREE.Mesh(stripeGeometry, redPaintMaterial);
    stripe1.position.set(0.6, 0, 0);
    wingGroup.add(stripe1);

    const stripe2 = new THREE.Mesh(stripeGeometry, redPaintMaterial);
    stripe2.position.set(1.2, 0, 0);
    wingGroup.add(stripe2);

    const wingTipGeometry = new THREE.CylinderGeometry(0.1, 0.08, 0.4, 8);
    const wingTip = new THREE.Mesh(wingTipGeometry, metalMaterial);
    wingTip.position.set(2.5, 0, 0);
    wingTip.rotation.z = Math.PI / 2;
    wingGroup.add(wingTip);

    const cannonGeometry = new THREE.CylinderGeometry(0.04, 0.03, 1.2, 8);
    const cannonPositions = [{ x: 3.0, y: 0, z: 0.2 }, { x: 3.0, y: 0, z: -0.2 }];
    cannonPositions.forEach(pos => {
        const cannon = new THREE.Mesh(cannonGeometry, darkMetalMaterial);
        cannon.position.set(pos.x, pos.y, pos.z);
        cannon.rotation.x = Math.PI / 2;
        wingGroup.add(cannon);

        const ringGeometry = new THREE.TorusGeometry(0.04, 0.01, 8, 16);
        const positions = [-0.4, -0.2, 0, 0.2, 0.4];
        positions.forEach(ringPos => {
            const ring = new THREE.Mesh(ringGeometry, metalMaterial);
            ring.position.set(pos.x, pos.y, pos.z + ringPos);
            ring.rotation.x = Math.PI / 2;
            wingGroup.add(ring);
        });
    });

    return wingGroup;
}

export const topRightWing = createWing(0, 0.3, -0.5, -Math.PI / 8);
topRightWing.name = "topRightWing";
export const bottomRightWing = createWing(0, -0.3, -0.5, Math.PI / 8);
bottomRightWing.name = "bottomRightWing";
export const topLeftWing = createWing(0, 0.3, -0.5, Math.PI + Math.PI / 8);
topLeftWing.name = "topLeftWing";
export const bottomLeftWing = createWing(0, -0.3, -0.5, Math.PI - Math.PI / 8);
bottomLeftWing.name = "bottomLeftWing";
spacecraft.add(topRightWing);
spacecraft.add(bottomRightWing);
spacecraft.add(topLeftWing);
spacecraft.add(bottomLeftWing);

// Struts
function createEnhancedStrut(x, y, z, rotationZ) {
    const strutGroup = new THREE.Group();
    const strutGeometry = new THREE.BoxGeometry(0.6, 0.08, 0.08);
    const strut = new THREE.Mesh(strutGeometry, metalMaterial);
    strut.position.set(x, y, z - 0.5);
    strut.rotation.z = rotationZ;
    strutGroup.add(strut);

    const detailGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const detail1 = new THREE.Mesh(detailGeometry, darkMetalMaterial);
    detail1.position.set(x - 0.25, y, z - 0.5);
    detail1.rotation.z = rotationZ;
    strutGroup.add(detail1);

    const detail2 = new THREE.Mesh(detailGeometry, darkMetalMaterial);
    detail2.position.set(x + 0.25, y, z - 0.5);
    detail2.rotation.z = rotationZ;
    strutGroup.add(detail2);

    return strutGroup;
}

spacecraft.add(createEnhancedStrut(0, 0.15, 0, 0));
spacecraft.add(createEnhancedStrut(0, -0.15, 0, 0));

// Surface details
function addSurfaceDetails() {
    const panelLineGeometry = new THREE.BoxGeometry(0.01, 0.01, 0.5);
    const panelLineMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5, roughness: 0.8 });
    for (let i = 0; i < 8; i++) {
        const panelLine = new THREE.Mesh(panelLineGeometry, panelLineMaterial);
        panelLine.position.set(0.2, 0.1, -1 + i * 0.5);
        spacecraft.add(panelLine);
    }

    const detailGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const detailPositions = [
        { x: 0.2, y: 0.2, z: -1 },
        { x: -0.2, y: 0.2, z: -1 },
        { x: 0.2, y: -0.2, z: -1 },
        { x: -0.2, y: -0.2, z: -1 }
    ];
    detailPositions.forEach(pos => {
        const detail = new THREE.Mesh(detailGeometry, darkMetalMaterial);
        detail.position.set(pos.x, pos.y, pos.z);
        spacecraft.add(detail);
    });
}

addSurfaceDetails();

const xwingLight = new THREE.PointLight(0xffffff, 0.5);
xwingLight.position.set(0, 2, 0);
spacecraft.add(xwingLight);

spacecraft.position.set(40000, 40000, 40000);
const centerPoint = new THREE.Vector3(0, 0, 10000);
spacecraft.lookAt(centerPoint);
scene.add(spacecraft);

// Laser setup
const laserLength = 100;
const laserThickness = 0.15;
const laserMaterial = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.9 });
const laserGeometry = new THREE.BoxGeometry(laserThickness, laserThickness, laserLength);

let activeLasers = [];
let isFiring = false;
let firingInterval = null;

const wingtipObjects = [
    new THREE.Object3D(),
    new THREE.Object3D(),
    new THREE.Object3D(),
    new THREE.Object3D()
];
const wingtipOffsets = [
    new THREE.Vector3(3.0, 0, 0.2),
    new THREE.Vector3(3.0, 0, -0.2),
    new THREE.Vector3(-3.0, 0, 0.2),
    new THREE.Vector3(-3.0, 0, -0.2)
];
wingtipObjects[0].position.copy(wingtipOffsets[0]);
topRightWing.add(wingtipObjects[0]);
wingtipObjects[1].position.copy(wingtipOffsets[1]);
bottomRightWing.add(wingtipObjects[1]);
wingtipObjects[2].position.copy(wingtipOffsets[2]);
topLeftWing.add(wingtipObjects[2]);
wingtipObjects[3].position.copy(wingtipOffsets[3]);
bottomLeftWing.add(wingtipObjects[3]);

function createLaser(startPosition, direction) {
    const laser = new THREE.Mesh(laserGeometry, laserMaterial);
    laser.position.copy(startPosition);
    laser.lookAt(startPosition.clone().add(direction));
    laser.position.add(direction.clone().multiplyScalar(laserLength / 2));
    laser.userData = { direction: direction.clone(), speed: 2, lifetime: 1000, startTime: performance.now() };
    return laser;
}

export function fireLasers() {
    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(spacecraft.quaternion);
    wingtipObjects.forEach(obj => {
        const marker = new THREE.Mesh(new THREE.SphereGeometry(0.05), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
        obj.add(marker);
    });
}

export function startFiring() {
    if (isFiring) return;
    isFiring = true;
    firingInterval = setInterval(fireLasers, 100);
}

export function stopFiring() {
    isFiring = false;
    clearInterval(firingInterval);
}

export function updateLasers() {
    const currentTime = performance.now();
    for (let i = activeLasers.length - 1; i >= 0; i--) {
        const laser = activeLasers[i];
        laser.position.add(laser.userData.direction.clone().multiplyScalar(laser.userData.speed));
        if (currentTime - laser.userData.startTime > laser.userData.lifetime) {
            scene.remove(laser);
            activeLasers.splice(i, 1);
        }
    }
}

// Stars
const starGeometry = new THREE.BufferGeometry();
const starCount = 50000;
const starRange = 250000;
const starPositions = new Float32Array(starCount * 3);
for (let i = 0; i < starCount * 3; i += 3) {
    starPositions[i] = (Math.random() - 0.5) * starRange;
    starPositions[i + 1] = (Math.random() - 0.5) * starRange;
    starPositions[i + 2] = (Math.random() - 0.5) * starRange;
}
starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 2 });
export const stars = new THREE.Points(starGeometry, starMaterial);
scene.add(stars);

export function updateStars() {
    const spacecraftZ = spacecraft.position.z;
    const positions = stars.geometry.attributes.position.array;
    const halfRange = starRange / 2;
    for (let i = 0; i < starCount * 3; i += 3) {
        const starZ = positions[i + 2];
        positions[i + 2] -= 0.1;
        if (starZ < spacecraftZ - halfRange) {
            positions[i] = (Math.random() - 0.5) * starRange;
            positions[i + 1] = (Math.random() - 0.5) * starRange;
            positions[i + 2] = spacecraftZ + halfRange + (Math.random() * starRange);
        }
    }
    stars.geometry.attributes.position.needsUpdate = true;
}

export const PLANET_RADIUS = planetRadius;
export const PLANET_POSITION = earthGroup.position;

// Hyperspace
let isHyperspaceActive = false;
function activateHyperspace() {
    if (!isHyperspaceActive) {
        isHyperspaceActive = true;
        console.log("Hyperspace activated!");
        setTimeout(deactivateHyperspace, 2000);
    }
}

function deactivateHyperspace() {
    if (isHyperspaceActive) {
        isHyperspaceActive = false;
        console.log("Hyperspace deactivated!");
    }
}

window.addEventListener('keydown', (event) => {
    if (event.key === 'Shift') activateHyperspace();
});
window.addEventListener('keyup', (event) => {
    if (event.key === 'Shift') deactivateHyperspace();
});

