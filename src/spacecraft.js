import * as THREE from 'three';
import { createReticle } from './reticle.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// AXES: x = yaw, y = pitch, z = roll

// Function to create and return the spacecraft with all its attributes
export function createSpacecraft(scene) {
    // X-wing spacecraft
    const spacecraft = new THREE.Group();
    spacecraft.name = 'spacecraft';
    
    // First person cockpit view
    const cockpit = new THREE.Group();
    cockpit.name = 'cockpit';
    
    // Flag to track view mode (false = third-person, true = first-person)
    let isFirstPersonView = false;
    let cockpitLoaded = false;
    
    // Materials for engine effects
    const engineGlowMaterial = new THREE.MeshStandardMaterial({ color: 0xff00ff, emissive: 0xff00ff, emissiveIntensity: 2.5, transparent: true, opacity: 0.9 });
    const boostFlameMaterial = new THREE.ShaderMaterial({
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
    const lightMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.0, transparent: true, opacity: 0.7 });

    // Load the X-Wing glTF model
    const loader = new GLTFLoader();
    const xWingModel = new THREE.Group(); // This will hold the loaded model
    xWingModel.name = 'xWingModel'; // Set a name for the model
    
    // Promise to load the glTF model
    const loadModel = new Promise((resolve, reject) => {
        loader.load(
            '/star_wars_x-wing/scene.gltf',
            (gltf) => {
                const model = gltf.scene;
                
                // Scale and position the model appropriately
                model.scale.set(0.5, 0.5, 0.5); // Adjust scale as needed
                
                // Add the model to our x-wing group
                xWingModel.add(model);
                
                // Add engine glow effects
                addEngineEffects(xWingModel);
                
                resolve(xWingModel);
            },
            (xhr) => {
                console.log((xhr.loaded / xhr.total * 100) + '% loaded');
            },
            (error) => {
                console.error('An error happened loading the X-Wing model:', error);
                reject(error);
            }
        );
    });
    
    // Load the cockpit model for first-person view
    const loadCockpitModel = new Promise((resolve, reject) => {
        loader.load(
            '/x-wing_cockpit/scene.gltf',
            (gltf) => {
                const model = gltf.scene;
                
                // Scale and position the cockpit model appropriately
                model.scale.set(1000, 1000, 1000);
                // model.rotation.y = Math.PI; // Face forward
                
                // Position the cockpit
                model.position.set(0, 0, 0);
                
                // Add the model to our cockpit group
                cockpit.add(model);
                cockpit.name = 'cockpitModel'; // Set a name for the cockpit
                cockpitLoaded = true;
                
                resolve(cockpit);
            },
            (xhr) => {
                console.log('Cockpit: ' + (xhr.loaded / xhr.total * 100) + '% loaded');
            },
            (error) => {
                console.error('An error happened loading the cockpit model:', error);
                reject(error);
            }
        );
    });
    
    // Function to add engine glow effects to the model
    function addEngineEffects(model) {
        // Create engine glow meshes at the appropriate positions
        const enginePositions = [
            { x: -0.7, y: 0.15, z: -0.8 },
            { x: 0.7, y: 0.15, z: -0.8 },
            { x: -0.7, y: -0.15, z: -0.8 },
            { x: 0.7, y: -0.15, z: -0.8 }
        ];
        
        enginePositions.forEach(pos => {
            // Create engine glow
            const glowSphereGeometry = new THREE.SphereGeometry(0.1, 16, 16);
            const glowSphere = new THREE.Mesh(glowSphereGeometry, boostFlameMaterial);
            glowSphere.position.set(pos.x, pos.y, pos.z);
            model.add(glowSphere);
        });
    }
    
    // Engine effects update function
    let engineTime = 0;
    function updateEngineEffects(isBoost, isSlow) {
        engineTime += 0.016;
        spacecraft.traverse((child) => {
            if (child.material === boostFlameMaterial) {
                child.material.uniforms.time.value = engineTime;
                
                // Handle the three states: boost, normal, slow
                if (isBoost) {
                    // Boost mode - high intensity
                    child.material.uniforms.intensity.value = 1.0;
                    child.scale.setScalar(1.5);
                } else if (isSlow) {
                    // Slow mode - very low intensity
                    child.material.uniforms.intensity.value = 0.0;
                    child.scale.setScalar(0.7);
                } else {
                    // Normal mode - normal intensity
                    child.material.uniforms.intensity.value = 0.0;
                    child.scale.setScalar(1.0);
                }
            }
        });
    }

    // Load the model first, then add to spacecraft group
    loadModel.then((model) => {
        spacecraft.add(model);
        
        // Position spacecraft after model is loaded
        spacecraft.position.set(40000, 40000, 40000);
        const centerPoint = new THREE.Vector3(0, 0, 10000);
        spacecraft.lookAt(centerPoint);
        
        // Add a light to the spacecraft
        const xwingLight = new THREE.PointLight(0xffffff, 0.5);
        xwingLight.position.set(0, 2, 0);
        spacecraft.add(xwingLight);
    }).catch(error => {
        console.error("Failed to load X-Wing model:", error);
    });
    
    // Also load the cockpit model
    loadCockpitModel.then(() => {
        console.log("Cockpit model loaded successfully");
    }).catch(error => {
        console.error("Failed to load cockpit model:", error);
    });
    
    // Create a reticle that's attached to the spacecraft
    console.log("Creating reticle as part of spacecraft creation");
    const reticleComponent = createReticle(scene, spacecraft);
    spacecraft.userData.reticle = reticleComponent.reticle;
    spacecraft.userData.updateReticle = reticleComponent.update;
    
    // Add the spacecraft to the scene
    scene.add(spacecraft);
    
    // Create HUD elements for cockpit view
    const hudGroup = new THREE.Group();
    hudGroup.name = "cockpitHUD";
    hudGroup.visible = false; // Initially hidden
    
    // Create targeting reticle for HUD
    const reticleGeometry = new THREE.RingGeometry(0.01, 0.012, 32);
    const reticleMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x00ff00, 
        transparent: true, 
        opacity: 0.7,
        side: THREE.DoubleSide
    });
    const hudReticle = new THREE.Mesh(reticleGeometry, reticleMaterial);
    hudReticle.position.set(0, 0, -0.2); // Position in front of the camera
    hudReticle.name = "hudReticle"; // Add a name for the reticle
    hudGroup.add(hudReticle);
    
    // Create targeting brackets
    const createBracket = (x, y, size, rotation) => {
        const bracket = new THREE.Mesh(
            new THREE.BoxGeometry(size, 0.002, 0.001),
            reticleMaterial
        );
        bracket.position.set(x, y, -0.2);
        bracket.rotation.z = rotation;
        hudGroup.add(bracket);
        return bracket;
    };
    
    // Add brackets around the reticle
    createBracket(0.02, 0.02, 0.01, 0);
    createBracket(0.02, -0.02, 0.01, 0);
    createBracket(-0.02, 0.02, 0.01, 0);
    createBracket(-0.02, -0.02, 0.01, 0);
    
    createBracket(0.02, 0.02, 0.01, Math.PI/2);
    createBracket(0.02, -0.02, 0.01, Math.PI/2);
    createBracket(-0.02, 0.02, 0.01, Math.PI/2);
    createBracket(-0.02, -0.02, 0.01, Math.PI/2);
    
    // Laser setup
    const laserLength = 100;
    const laserThickness = 0.15;
    const laserMaterial = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.9 });
    const laserGeometry = new THREE.BoxGeometry(laserThickness, laserThickness, laserLength);

    let activeLasers = [];
    let isFiring = false;
    let firingInterval = null;

    // Define wingtip positions for lasers
    const wingtipObjects = [
        new THREE.Object3D(),
        new THREE.Object3D(),
        new THREE.Object3D(),
        new THREE.Object3D()
    ];
    
    // Add wingtip objects to the spacecraft
    wingtipObjects.forEach((obj, index) => {
        // Position will be adjusted when model is loaded
        spacecraft.add(obj);
        
        // After model is loaded, position the wingtip objects at appropriate locations
        loadModel.then(() => {
            const positions = [
                { x: 0.7, y: 0.15, z: 0.7 },   // top right
                { x: 0.7, y: -0.15, z: 0.7 },  // bottom right
                { x: -0.7, y: 0.15, z: 0.7 },  // top left
                { x: -0.7, y: -0.15, z: 0.7 }  // bottom left
            ];
            
            obj.position.set(positions[index].x, positions[index].y, positions[index].z);
        });
    });

    function createLaser(startPosition, direction) {
        const laser = new THREE.Mesh(laserGeometry, laserMaterial);
        laser.position.copy(startPosition);
        laser.lookAt(startPosition.clone().add(direction));
        laser.position.add(direction.clone().multiplyScalar(laserLength / 2));
        laser.userData = { direction: direction.clone(), speed: 2, lifetime: 1000, startTime: performance.now() };
        return laser;
    }

    function fireLasers() {
        const forward = new THREE.Vector3(0, 0, 1);
        forward.applyQuaternion(spacecraft.quaternion);
        wingtipObjects.forEach(obj => {
            const worldPosition = new THREE.Vector3();
            obj.getWorldPosition(worldPosition);
            
            const laser = createLaser(worldPosition, forward);
            scene.add(laser);
            activeLasers.push(laser);
        });
    }

    function startFiring() {
        if (isFiring) return;
        isFiring = true;
        firingInterval = setInterval(fireLasers, 100);
    }

    function stopFiring() {
        isFiring = false;
        clearInterval(firingInterval);
    }

    function updateLasers() {
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
    
    // Function to toggle between first-person and third-person views
    function toggleView(camera) {
        if (!cockpitLoaded) {
            console.warn("Cockpit model not yet loaded. Cannot switch to first-person view.");
            return;
        }
        
        isFirstPersonView = !isFirstPersonView;
        
        if (isFirstPersonView) {
            // Switch to first-person view
            console.log("Switching to first-person view");
            
            // Remove X-wing model from spacecraft
            const xWing = spacecraft.getObjectByName('xWingModel');
            if (xWing) {
                spacecraft.remove(xWing);
            }
            
            // Add cockpit model to spacecraft
            spacecraft.add(cockpit);
            
            // Position cockpit correctly for first-person view
            cockpit.position.set(0, 0, 0);
            cockpit.rotation.set(0, 0, 0);
            
            // Adjust the cockpit to be centered on camera
            const cockpitModel = cockpit.getObjectByName('cockpitModel');
            if (cockpitModel) {
                cockpitModel.position.set(0, -0.08, 0);
            }
            
            // Make HUD visible
            hudGroup.visible = true;
            camera.add(hudGroup);
            
            // Position HUD in front of the camera
            hudGroup.position.set(0, 0, -0.3);
            
        } else {
            // Switch back to third-person view
            console.log("Switching to third-person view");
            
            // Remove cockpit model from spacecraft
            spacecraft.remove(cockpit);
            
            // Add X-wing model back to spacecraft
            loadModel.then((model) => {
                spacecraft.add(model);
            });
            
            // Hide HUD
            hudGroup.visible = false;
            camera.remove(hudGroup);
        }
        
        return isFirstPersonView;
    }

    // Function to update cockpit elements
    function updateCockpit(deltaTime = 0.016) {
        if (!isFirstPersonView) return;
        
        // Animate HUD elements
        hudGroup.children.forEach((element, index) => {
            // Rotate the main reticle
            if (index === 0) { // First element is the main reticle
                element.rotation.z += deltaTime * 0.5; // Slowly rotate the reticle
            }
        });
    }

    // Return an object containing the spacecraft and all necessary methods and attributes
    return {
        spacecraft,
        cockpit,
        engineGlowMaterial,
        boostFlameMaterial,
        lightMaterial,
        updateEngineEffects,
        fireLasers,
        startFiring,
        stopFiring,
        updateLasers,
        wingtipObjects,
        toggleView,
        // Define dummy wing objects to maintain compatibility
        topRightWing: wingtipObjects[0],
        bottomRightWing: wingtipObjects[1],
        topLeftWing: wingtipObjects[2],
        bottomLeftWing: wingtipObjects[3],
        reticle: reticleComponent.reticle,
        updateReticle: reticleComponent.update,
        updateCockpit
    };
}