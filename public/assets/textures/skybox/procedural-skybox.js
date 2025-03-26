// procedural-skybox.js
// Basic version for testing

// Simple vertex shader
const skyboxVertexShader = `
varying vec3 vWorldPosition;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// Simple fragment shader - just a solid color with a gradient
const skyboxFragmentShader = `
varying vec3 vWorldPosition;

void main() {
  // Normalize direction vector
  vec3 direction = normalize(vWorldPosition);
  
  // Create a simple gradient from top to bottom
  vec3 color = mix(
    vec3(0.1, 0.2, 0.5),  // Blue at bottom
    vec3(0.2, 0.4, 0.8),  // Lighter blue at top
    direction.y * 0.5 + 0.5
  );
  
  gl_FragColor = vec4(color, 1.0);
}`;

// Create a preview of the skybox
export function createSkyboxPreview(containerId = 'skybox-preview') {
  console.log("Creating skybox preview in container:", containerId);

  // Get the container
  let container = document.getElementById(containerId);
  if (!container) {
    console.warn("Container not found, creating a default one");
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

  console.log("Container dimensions:", container.clientWidth, container.clientHeight);

  // Setup three.js preview scene
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);

  // Create renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  console.log("THREE.js scene set up");

  // Create a simple cube skybox
  const skyboxGeometry = new THREE.BoxGeometry(10, 10, 10);
  const skyboxMaterial = new THREE.ShaderMaterial({
    vertexShader: skyboxVertexShader,
    fragmentShader: skyboxFragmentShader,
    side: THREE.BackSide
  });

  const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
  scene.add(skybox);

  console.log("Skybox added to scene");

  // Position camera inside the box
  camera.position.set(0, 0, 0);

  // Add orbit controls if available
  let controls;
  if (typeof THREE.OrbitControls !== 'undefined') {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.update();
    console.log("OrbitControls enabled");
  } else {
    console.warn("OrbitControls not available");

    // Add a simple rotation if controls aren't available
    let rotationSpeed = 0.001;
    function updateCamera() {
      camera.rotation.y += rotationSpeed;
    }

    // Override the animate function to include camera rotation
    const originalAnimate = animate;
    animate = function() {
      updateCamera();
      originalAnimate();
    };
  }

  // Animation function
  function animate() {
    requestAnimationFrame(animate);
    if (controls) controls.update();
    renderer.render(scene, camera);
  }

  console.log("Starting animation loop");
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

// Basic function to add the skybox to an existing game scene
export function addSkyboxToGame(gameScene) {
  const skyboxGeometry = new THREE.BoxGeometry(10, 10, 10);
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