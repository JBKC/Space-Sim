// procedural-skybox.js
// This can be used for previewing and then integrated into your game

// Vertex shader for the skybox
const skyboxVertexShader = `
varying vec3 vWorldPosition;
varying vec2 vUv;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  vUv = uv;
  
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
}`;

// Fragment shader for a deep space skybox with stars and nebulae
const skyboxFragmentShader = `
varying vec3 vWorldPosition;
varying vec2 vUv;

// Noise function for procedural generation
float hash(float n) { return fract(sin(n) * 43758.5453123); }

// 3D noise function
float noise(vec3 x) {
  vec3 p = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  
  float n = p.x + p.y * 57.0 + p.z * 113.0;
  return mix(
    mix(
      mix(hash(n), hash(n + 1.0), f.x),
      mix(hash(n + 57.0), hash(n + 58.0), f.x),
      f.y
    ),
    mix(
      mix(hash(n + 113.0), hash(n + 114.0), f.x),
      mix(hash(n + 170.0), hash(n + 171.0), f.x),
      f.y
    ),
    f.z
  );
}

// Nebula effect 
float nebula(vec3 p) {
  const int steps = 6;
  float scale = 0.8;
  float result = 0.0;
  float weight = 1.0;
  
  for (int i = 0; i < steps; i++) {
    result += noise(p) * weight;
    weight *= 0.5;
    p *= 2.0;
  }
  
  return result;
}

// Star field generation
float stars(vec3 p) {
  float threshold = 0.97; // Adjust for star density
  float n = noise(p * 50.0);
  return (n > threshold) ? pow((n - threshold) / (1.0 - threshold), 12.0) : 0.0;
}

void main() {
  // Normalize the world position for direction
  vec3 direction = normalize(vWorldPosition);
  
  // Base deep space color (deep blue/purple)
  vec3 baseColor = vec3(0.01, 0.01, 0.04);
  
  // Add subtle nebula
  float nebulaValue = nebula(direction * 2.0);
  vec3 nebulaColor1 = vec3(0.5, 0.2, 0.5); // Purple
  vec3 nebulaColor2 = vec3(0.1, 0.2, 0.5); // Blue
  vec3 nebulaColor = mix(nebulaColor1, nebulaColor2, noise(direction * 4.0));
  
  // Star field
  float starValue = stars(direction);
  vec3 starColor = vec3(1.0, 1.0, 1.0);
  
  // Combine everything
  vec3 color = baseColor;
  color += nebulaColor * nebulaValue * 0.3; // Subtle nebulae
  color += starColor * starValue; // Stars
  
  // Distant galaxy effect
  float galaxyMask = pow(max(0.0, 1.0 - 2.0 * length(direction.xz - vec2(0.3, 0.0))), 3.0);
  color += vec3(0.4, 0.2, 0.1) * galaxyMask * 0.2;
  
  gl_FragColor = vec4(color, 1.0);
}`;

// Create a preview of the skybox
export function createSkyboxPreview(containerId = 'skybox-preview') {
  // Create container if it doesn't exist
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    container.style.width = '500px';
    container.style.height = '500px';
    container.style.position = 'absolute';
    container.style.top = '20px';
    container.style.right = '20px';
    container.style.border = '2px solid white';
    document.body.appendChild(container);
  }

  // Setup three.js preview scene
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  // Create skybox
  const skyboxGeometry = new THREE.BoxGeometry(900, 900, 900);
  const skyboxMaterial = new THREE.ShaderMaterial({
    vertexShader: skyboxVertexShader,
    fragmentShader: skyboxFragmentShader,
    side: THREE.BackSide
  });
  const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
  scene.add(skybox);

  // Add controls to rotate the view
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  camera.position.z = 0;
  controls.update();

  // Animation function
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  return {
    scene,
    camera,
    renderer,
    skybox,
    skyboxMaterial,
    container
  };
}

// Function to add the skybox to your existing game scene
export function addSkyboxToGame(gameScene) {
  const skyboxGeometry = new THREE.BoxGeometry(900, 900, 900);
  const skyboxMaterial = new THREE.ShaderMaterial({
    vertexShader: skyboxVertexShader,
    fragmentShader: skyboxFragmentShader,
    side: THREE.BackSide
  });
  const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
  gameScene.add(skybox);

  return {
    skybox,
    skyboxMaterial
  };
}