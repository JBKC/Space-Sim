// Procedural Terrain Sandbox with Fractal Noise, Realistic Lighting, Mars-Themed Colors, and Shadows

import * as THREE from 'https://cdn.skypack.dev/three@0.136.0';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'https://cdn.jsdelivr.net/npm/dat.gui@0.7.9/build/dat.gui.module.js';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// Camera setup
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 30, 60);

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.25);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(50, 100, 50);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.set(2048, 2048);
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 500;
directionalLight.shadow.camera.left = -100;
directionalLight.shadow.camera.right = 100;
directionalLight.shadow.camera.top = 100;
directionalLight.shadow.camera.bottom = -100;
scene.add(directionalLight);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Shader setup
const uniforms = {
  uTime: { value: 0 },
  uNoiseScale: { value: 0.05 },
  uDisplacementStrength: { value: 10.0 },
  uDetail: { value: 3.0 },
  uLacunarity: { value: 2.0 },
  uLowHeight: { value: 0.0 },
  uHighHeight: { value: 1.0 },
  uLightDir: { value: new THREE.Vector3(0.5, 1.0, 0.5).normalize() }
};

const vertexShader = `
  varying float vHeight;
  varying vec3 vNormal;
  varying vec3 vPosition;

  uniform float uNoiseScale;
  uniform float uDisplacementStrength;
  uniform float uDetail;
  uniform float uLacunarity;
  uniform float uLowHeight;
  uniform float uHighHeight;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  float fbm(vec2 p) {
    float base = noise(p);
    float detail = 0.0;
    float amp = 1.0;
    float freq = 1.0;
    for (int i = 1; i < 8; i++) {
      if (i >= int(uDetail)) break;
      freq *= uLacunarity;
      amp *= 0.5;
      detail += amp * noise(p * freq);
    }
    return base + detail;
  }

  void main() {
    vec3 pos = position;
    float height = fbm(pos.xz * uNoiseScale);
    float displaced = clamp(height, uLowHeight, uHighHeight);
    pos.y += displaced * uDisplacementStrength;
    vHeight = height;
    vPosition = pos;

    vec3 transformedNormal = normalize(normalMatrix * normal);
    vNormal = transformedNormal;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = `
  varying float vHeight;
  varying vec3 vNormal;
  varying vec3 vPosition;

  uniform vec3 uLightDir;
  uniform float uLowHeight;
  uniform float uHighHeight;

  void main() {
    vec3 yellow = vec3(0.72, 0.35, 0.1); // reddish sand
    vec3 mid = vec3(0.35, 0.15, 0.08);   // darker rock
    vec3 high = vec3(0.15, 0.07, 0.04);  // deepest rock tone

    vec3 baseColor = mix(yellow, mid, smoothstep(0.2, 0.6, vHeight));
    baseColor = mix(baseColor, high, smoothstep(0.6, 1.0, vHeight));

    if (vHeight < uLowHeight) {
      baseColor = yellow;
    }

    if (vHeight > uHighHeight) {
      baseColor = high; // ✅ Match high clamp to rock brown
    }

    float lighting = max(dot(normalize(vNormal), normalize(uLightDir)), 0.0);
    vec3 litColor = baseColor * 0.4 + baseColor * lighting * 0.6;

    gl_FragColor = vec4(litColor, 1.0);
  }
`;

const material = new THREE.ShaderMaterial({
  vertexShader,
  fragmentShader,
  uniforms,
  side: THREE.DoubleSide,
  wireframe: false,
});

const geometry = new THREE.PlaneGeometry(100, 100, 256, 256);
geometry.rotateX(-Math.PI / 2);

const terrain = new THREE.Mesh(geometry, material);
terrain.castShadow = true;
terrain.receiveShadow = true;
scene.add(terrain);

// GUI
const gui = new GUI();
gui.add(uniforms.uNoiseScale, 'value', 0.001, 0.2).name('Noise Scale');
gui.add(uniforms.uDisplacementStrength, 'value', 0.0, 50.0).name('Displacement');
gui.add(uniforms.uDetail, 'value', 1, 8, 1).name('Detail (Octaves)');
gui.add(uniforms.uLacunarity, 'value', 1.0, 4.0).name('Lacunarity');
gui.add(uniforms.uLowHeight, 'value', 0.0, 1.5).name('Low Height Plane'); // ✅ Extended range
gui.add(uniforms.uHighHeight, 'value', 0.0, 1.5).name('High Height Plane'); // ✅ Unchanged

// Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animate
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  uniforms.uTime.value += 0.01;
  renderer.render(scene, camera);
}
animate();
