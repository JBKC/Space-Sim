import * as THREE from 'three';
import decode from '@here/quantized-mesh-decoder';

// Function to convert geodetic coordinates (lon, lat, height) to Cartesian (x, y, z)
function geodeticToCartesian(lon, lat, height) {
  const a = 6378137.0; // WGS84 semi-major axis in meters
  const b = 6356752.3142; // WGS84 semi-minor axis in meters
  const e2 = 1 - (b / a) ** 2; // First eccentricity squared
  const lonRad = lon * Math.PI / 180; // Convert to radians
  const latRad = lat * Math.PI / 180;
  const N = a / Math.sqrt(1 - e2 * Math.sin(latRad) ** 2); // Prime vertical radius of curvature
  const x = (N + height) * Math.cos(latRad) * Math.cos(lonRad);
  const y = (N + height) * Math.cos(latRad) * Math.sin(lonRad);
  const z = (N * (1 - e2) + height) * Math.sin(latRad);
  return [x, y, z];
}

// Function to create THREE.BufferGeometry from Quantized Mesh buffer
function createTerrainGeometry(buffer, bounds, heightScale = 1, scale = 1) {
  // Decode the Quantized Mesh data with tile bounds
  const decodedData = decode(buffer, { bounds });
  const vertices = decodedData.vertices; // [lon1, lat1, height1, lon2, lat2, height2, ...]
  const cartesianPositions = new Float32Array(vertices.length);

  // Convert geodetic coordinates to Cartesian
  for (let i = 0; i < vertices.length; i += 3) {
    const lon = vertices[i];
    const lat = vertices[i + 1];
    const height = vertices[i + 2] * heightScale; // Optional height exaggeration
    const [x, y, z] = geodeticToCartesian(lon, lat, height);
    cartesianPositions[i] = x;
    cartesianPositions[i + 1] = y;
    cartesianPositions[i + 2] = z;
  }

  // Compute the center to shift positions to origin
  let sumX = 0, sumY = 0, sumZ = 0;
  for (let i = 0; i < cartesianPositions.length; i += 3) {
    sumX += cartesianPositions[i];
    sumY += cartesianPositions[i + 1];
    sumZ += cartesianPositions[i + 2];
  }
  const count = cartesianPositions.length / 3;
  const centerX = sumX / count;
  const centerY = sumY / count;
  const centerZ = sumZ / count;

  // Center and scale the positions
  for (let i = 0; i < cartesianPositions.length; i += 3) {
    cartesianPositions[i] = (cartesianPositions[i] - centerX) * scale;
    cartesianPositions[i + 1] = (cartesianPositions[i] - centerY) * scale;
    cartesianPositions[i + 2] = (cartesianPositions[i] - centerZ) * scale;
  }

  // Create BufferGeometry
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(cartesianPositions, 3));
  geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(decodedData.indices), 1));
  geometry.computeVertexNormals(); // For lighting

  return geometry;
}

// Example: Fetch and render a terrain tile from Cesium Ion
async function renderCesiumTerrain(scene, assetId, accessToken, level, x, y) {
  // Compute tile bounds (TMS scheme)
  const n = 1 << level; // Number of tiles at this level
  const lonMin = (x / n) * 360 - 180;
  const lonMax = ((x + 1) / n) * 360 - 180;
  const latRadMin = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  const latMin = (latRadMin * 180) / Math.PI;
  const latRadMax = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n)));
  const latMax = (latRadMax * 180) / Math.PI;
  const bounds = { west: lonMin, south: latMin, east: lonMax, north: latMax };

  // Fetch the terrain tile from Cesium Ion
  const tileUrl = `https://assets.ion.cesium.com/${assetId}/tiles/${level}/${x}/${y}.terrain?v=1.2.0&access_token=${accessToken}`;
  const response = await fetch(tileUrl);
  const buffer = await response.arrayBuffer();

  // Create geometry
  const geometry = createTerrainGeometry(
    buffer,
    bounds,
    1, // heightScale: 1 = no exaggeration
    0.001 // scale: Convert meters to kilometers (adjust as needed)
  );

  // Create mesh and add to scene
  const material = new THREE.MeshStandardMaterial({ color: 0xaaaaaa });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  return mesh; // Optional: Return mesh for further manipulation
}

// Usage example
const scene = new THREE.Scene();
const assetId = '1'; // Replace with your Cesium Ion asset ID
const accessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJmM2NmMGU2Mi0zNDYxLTRhOTQtYmRiNi05Mzk0NTg4OTdjZDkiLCJpZCI6Mjg0MDk5LCJpYXQiOjE3NDE5MTI4Nzh9.ciqVryFsYbzdwKxd_nEANC8pHgU9ytlfylfpfy9Q56U'; // Replace with your Cesium Ion access token
const level = 10; // Example zoom level
const x = 162; // Example tile x coordinate
const y = 373; // Example tile y coordinate

renderCesiumTerrain(scene, assetId, accessToken, level, x, y)
  .then(mesh => console.log('Terrain rendered successfully'))
  .catch(err => console.error('Error rendering terrain:', err));