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
    
    // Animation system
    let mixer = null;
    let animations = [];
    let wingsOpenAction = null;
    let wingsCloseAction = null;
    let currentAnimation = null;
    let animationState = 'open'; // 'open' or 'closed'
    
    // Materials
    const lightMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.0, transparent: true, opacity: 0.7 });

    // Create a purple/pink material for the engine greebles
    const purplePinkMaterial = new THREE.MeshStandardMaterial({
        color: 0xff00ff,         // Bright purple/pink
        emissive: 0xaa00aa,      // Slightly darker purple/pink for emissive
        emissiveIntensity: 5,  // Glowing
        metalness: 0.7,          // A bit metallic
        roughness: 0.3           // Fairly smooth
    });
    
    // Load the X-Wing glTF model
    const loader = new GLTFLoader();
    const xWingModel = new THREE.Group(); // This will hold the loaded model
    xWingModel.name = 'xWingModel'; // Set a name for the model
    
    // Promise to load the glTF model
    const loadModel = new Promise((resolve, reject) => {
        loader.load(
            '/xwing_axespoints.glb',
            (gltf) => {
                const model = gltf.scene;
                
                // Scale and position the model appropriately
                model.scale.set(1, 1, 1); // Adjust scale as needed
                
                // Add the model to our x-wing group
                xWingModel.add(model);

                // Change colors of specific engine and greebles elements
                model.traverse((child) => {
                    if (child.isMesh) {
                        // ONLY color these exact elements - nothing else
                        const exactWingElements = [
                            'RightWingBottomEngineAndGreebles_3',
                            'RightWingTopEngineAndGreebles_3',
                            'LeftWingBottomEngineAndGreebles_3',
                            'LeftWingTopEngineAndGreebles_3'
                        ];
                        
                        // Only color if exact name match
                        if (exactWingElements.includes(child.name)) {
                            console.log(`Found exact wing element: ${child.name} - changing to purple/pink`);
                            child.material = purplePinkMaterial.clone();
                        }
                    }
                });

                // Set up animation system if animations exist
                if (gltf.animations && gltf.animations.length > 0) {
                    console.log("===== ANIMATIONS DEBUG INFO =====");
                    console.log(`Found ${gltf.animations.length} animations in the X-Wing model`);
                    
                    // Create animation mixer
                    mixer = new THREE.AnimationMixer(model);
                    animations = gltf.animations;
                    
                    // List all animation names and details for debugging
                    animations.forEach((clip, index) => {
                        console.log(`Animation ${index}: "${clip.name}"`);
                        console.log(`  - Duration: ${clip.duration.toFixed(2)} seconds`);
                        console.log(`  - Tracks: ${clip.tracks.length}`);
                        if (clip.tracks.length > 0) {
                            console.log(`  - First track name: ${clip.tracks[0].name}`);
                        }
                    });
                    
                    // Try to find wing animations by common naming patterns
                    const openClipNames = ['open', 'Open', 'OPEN', 'wings_open', 'WingsOpen', 'wings-open', 'wings', 'Wings', 'x'];
                    const closeClipNames = ['close', 'Close', 'CLOSE', 'wings_close', 'WingsClose', 'wings-closed', 'fold', 'Fold'];
                    
                    let openClip = null;
                    let closeClip = null;
                    
                    // Search for wing animations
                    animations.forEach(clip => {
                        const lowerName = clip.name.toLowerCase();
                        console.log(`Checking if "${clip.name}" matches animation patterns...`);
                        
                        // Check for open animation
                        if (openClipNames.some(name => lowerName.includes(name.toLowerCase()))) {
                            console.log(`  ✓ Found potential OPEN animation: "${clip.name}"`);
                            openClip = clip;
                        }
                        // Check for close animation
                        else if (closeClipNames.some(name => lowerName.includes(name.toLowerCase()))) {
                            console.log(`  ✓ Found potential CLOSE animation: "${clip.name}"`);
                            closeClip = clip;
                        }
                    });
                    
                    // If no matches found, try another approach - use first animation as open
                    if (!openClip && animations.length > 0) {
                        console.log("No specific open animation found, using first animation as open");
                        openClip = animations[0];
                    }
                    
                    // If we have a second animation, use it as close
                    if (!closeClip && animations.length > 1) {
                        console.log("No specific close animation found, using second animation as close");
                        closeClip = animations[1];
                    }
                    // If only one animation, use it for both by playing in reverse
                    else if (!closeClip && openClip) {
                        console.log("Only one animation found, will use it in reverse for close");
                        closeClip = openClip;
                    }
                    
                    // Create animation actions if clips were found
                    if (openClip) {
                        wingsOpenAction = mixer.clipAction(openClip);
                        wingsOpenAction.setLoop(THREE.LoopOnce);
                        wingsOpenAction.clampWhenFinished = true;
                        console.log(`Wings open animation set up: "${openClip.name}"`);
                    }
                    
                    if (closeClip && closeClip !== openClip) {
                        wingsCloseAction = mixer.clipAction(closeClip);
                        wingsCloseAction.setLoop(THREE.LoopOnce);
                        wingsCloseAction.clampWhenFinished = true;
                        console.log(`Wings close animation set up: "${closeClip.name}"`);
                    }
                    // If only one animation was found, use it for both by playing in reverse
                    else if (closeClip === openClip) {
                        wingsCloseAction = mixer.clipAction(openClip);
                        wingsCloseAction.setLoop(THREE.LoopOnce);
                        wingsCloseAction.clampWhenFinished = true;
                        wingsCloseAction.timeScale = -1; // Play in reverse
                        console.log(`Using "${openClip.name}" in reverse for close animation`);
                    }
                    
                    // Start with wings open by default
                    if (wingsOpenAction) {
                        wingsOpenAction.reset();
                        wingsOpenAction.play();
                        currentAnimation = wingsOpenAction;
                        console.log("Playing wings open animation at startup");
                    }
                    
                    console.log("===== END ANIMATIONS DEBUG INFO =====");
                } else {
                    console.log("No animations found in the model");
                }

                // Initialize wings object to store wing references
                const wings = {
                    topLeft: null,
                    topRight: null,
                    bottomLeft: null,
                    bottomRight: null
                };
                
                // Find wing objects
                model.traverse((child) => {
                    if (child.isMesh) {
                        if (child.name === 'LeftWingTop') wings.topLeft = child;
                        if (child.name === 'RightWingTop') wings.topRight = child;
                        if (child.name === 'LeftWingBottom') wings.bottomLeft = child;
                        if (child.name === 'RightWingBottom') wings.bottomRight = child;
                    }
                });
                
                // If wings not found by exact names, try to find them by hierarchy path
                if (!wings.topLeft && !wings.topRight && !wings.bottomLeft && !wings.bottomRight) {
                    console.log("Wings not found by name, trying to find by hierarchy...");
                    model.traverse((child) => {
                        // Match the exact names from the hierarchy shown in the image
                        if (child.name === 'LeftWingTop') wings.topLeft = child;
                        if (child.name === 'LeftWingBottom') wings.bottomLeft = child;
                        if (child.name === 'RightWingTop') wings.topRight = child; 
                        if (child.name === 'RightWingBottom') wings.bottomRight = child;
                    });
                }
                
                // If wings still not found, try to match by parent-child relationship
                if (!wings.topLeft && !wings.topRight && !wings.bottomLeft && !wings.bottomRight) {
                    console.log("Wings still not found, trying to find by parent-child relationship...");
                    model.traverse((child) => {
                        // Look for the X-Wing parent object
                        if (child.name === 'X-Wing' && child.children) {
                            console.log("Found X-Wing parent object with", child.children.length, "children");
                            
                            // Debug - print all child names
                            child.children.forEach((wingChild, index) => {
                                console.log(`  Child ${index}: ${wingChild.name}`);
                            });
                            
                            // Try to find wings by their index position if names aren't matching
                            child.children.forEach((wingChild) => {
                                if (wingChild.name === 'LeftWingTop') wings.topLeft = wingChild;
                                if (wingChild.name === 'RightWingTop') wings.topRight = wingChild;
                                if (wingChild.name === 'LeftWingBottom') wings.bottomLeft = wingChild;
                                if (wingChild.name === 'RightWingBottom') wings.bottomRight = wingChild;
                            });
                        }
                    });
                }
                
                // If wings still not found, try a final fallback with exact names from the image
                if (!wings.topLeft && !wings.topRight && !wings.bottomLeft && !wings.bottomRight) {
                    console.log("Final attempt to find wings using exact names from image...");
                    
                    // Find the Root object
                    model.traverse((child) => {
                        if (child.name === 'Root') {
                            console.log("Found Root object");
                            
                            // Look for X-Wing under Root
                            child.children.forEach(xwingChild => {
                                if (xwingChild.name === 'X-Wing') {
                                    console.log("Found X-Wing under Root with", xwingChild.children.length, "children");
                                    
                                    // Try to match the wings directly
                                    xwingChild.children.forEach(wingChild => {
                                        console.log("Checking wing child:", wingChild.name);
                                        // These are the exact names from the image
                                        if (wingChild.name === 'LeftWingTop') wings.topLeft = wingChild;
                                        if (wingChild.name === 'LeftWingBottom') wings.bottomLeft = wingChild; 
                                        if (wingChild.name === 'RightWingTop') wings.topRight = wingChild;
                                        if (wingChild.name === 'RightWingBottom') wings.bottomRight = wingChild;
                                        if (wingChild.name === 'WingRotation') {
                                            console.log("Found WingRotation object, checking its children");
                                            wingChild.children.forEach(rotationChild => {
                                                console.log("  Rotation child:", rotationChild.name);
                                                if (rotationChild.name === 'LeftWingTop') wings.topLeft = rotationChild;
                                                if (rotationChild.name === 'LeftWingBottom') wings.bottomLeft = rotationChild;
                                                if (rotationChild.name === 'RightWingTop') wings.topRight = rotationChild;
                                                if (rotationChild.name === 'RightWingBottom') wings.bottomRight = rotationChild;
                                            });
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
                
                // Enhanced debug information about wing objects
                console.log("===== X-WING WING OBJECT DEBUG =====");
                console.log("Wing names being searched for: 'LeftWingTop', 'RightWingTop', 'LeftWingBottom', 'RightWingBottom'");
                console.log("Top Left Wing found:", wings.topLeft ? "YES ✓" : "NO ✗");
                console.log("Top Right Wing found:", wings.topRight ? "YES ✓" : "NO ✗");
                console.log("Bottom Left Wing found:", wings.bottomLeft ? "YES ✓" : "NO ✗");
                console.log("Bottom Right Wing found:", wings.bottomRight ? "YES ✓" : "NO ✗");
                
                // Let's also list all mesh names to help identify the correct wing object names
                console.log("All mesh names in the model:");
                const meshNames = [];
                model.traverse((child) => {
                    if (child.isMesh && child.name) {
                        meshNames.push(child.name);
                    }
                });
                console.log(meshNames);
                
                // Check specifically for the exhaust and turret elements
                console.log("===== CHECKING FOR EXHAUST AND TURRET ELEMENTS =====");
                const exhaustAndTurretElements = [
                    'exhaust_LB',
                    'exhaust_LT',
                    'exhaust_RB',
                    'exhaust_RT',
                    'turret_LB',
                    'turret_LT',
                    'turret_RB',
                    'turret_RT'
                ];
                
                // Create an object to track these elements
                const exhaustAndTurretObjects = {
                    exhaust_LB: null,
                    exhaust_LT: null,
                    exhaust_RB: null,
                    exhaust_RT: null,
                    turret_LB: null,
                    turret_LT: null,
                    turret_RB: null,
                    turret_RT: null
                };
                
                // Search for the elements in the model
                model.traverse((child) => {
                    if (exhaustAndTurretElements.includes(child.name)) {
                        console.log(`✓ Found element: ${child.name}`);
                        exhaustAndTurretObjects[child.name] = child;
                    }
                });
                
                // Log which elements were found and which were not
                console.log("Exhaust and Turret elements found:");
                console.log("exhaust_LB:", exhaustAndTurretObjects.exhaust_LB ? "YES ✓" : "NO ✗");
                console.log("exhaust_LT:", exhaustAndTurretObjects.exhaust_LT ? "YES ✓" : "NO ✗");
                console.log("exhaust_RB:", exhaustAndTurretObjects.exhaust_RB ? "YES ✓" : "NO ✗");
                console.log("exhaust_RT:", exhaustAndTurretObjects.exhaust_RT ? "YES ✓" : "NO ✗");
                console.log("turret_LB:", exhaustAndTurretObjects.turret_LB ? "YES ✓" : "NO ✗");
                console.log("turret_LT:", exhaustAndTurretObjects.turret_LT ? "YES ✓" : "NO ✗");
                console.log("turret_RB:", exhaustAndTurretObjects.turret_RB ? "YES ✓" : "NO ✗");
                console.log("turret_RT:", exhaustAndTurretObjects.turret_RT ? "YES ✓" : "NO ✗");
                
                // Summary log line
                console.log("Found exhaust and turret elements:", 
                    exhaustAndTurretObjects.exhaust_LB ? "exhaust_LB ✓" : "exhaust_LB ✗",
                    exhaustAndTurretObjects.exhaust_LT ? "exhaust_LT ✓" : "exhaust_LT ✗",
                    exhaustAndTurretObjects.exhaust_RB ? "exhaust_RB ✓" : "exhaust_RB ✗",
                    exhaustAndTurretObjects.exhaust_RT ? "exhaust_RT ✓" : "exhaust_RT ✗",
                    exhaustAndTurretObjects.turret_LB ? "turret_LB ✓" : "turret_LB ✗",
                    exhaustAndTurretObjects.turret_LT ? "turret_LT ✓" : "turret_LT ✗",
                    exhaustAndTurretObjects.turret_RB ? "turret_RB ✓" : "turret_RB ✗",
                    exhaustAndTurretObjects.turret_RT ? "turret_RT ✓" : "turret_RT ✗"
                );
                
                // Store these references for later use
                xWingModel.userData.exhaustAndTurret = exhaustAndTurretObjects;
                console.log("===================================");
                
                // Original log
                console.log("Found X-wing wings:", 
                    wings.topLeft ? "Top Left ✓" : "Top Left ✗",
                    wings.topRight ? "Top Right ✓" : "Top Right ✗",
                    wings.bottomLeft ? "Bottom Left ✓" : "Bottom Left ✗",
                    wings.bottomRight ? "Bottom Right ✓" : "Bottom Right ✗"
                );
                
                // Store wings reference for later use in the export
                xWingModel.userData.wings = wings;
                
                // Explicitly set wings to open position after model is loaded
                if (wings.topLeft && wings.topRight && wings.bottomLeft && wings.bottomRight) {
                    console.log("Setting initial wing position to OPEN");
                    // Define the open angle
                    const openAngle = Math.PI / 16;
                    
                    // Set to open position (X shape)
                    wings.topRight.rotation.y = openAngle;
                    wings.bottomRight.rotation.y = -openAngle;
                    wings.topLeft.rotation.y = -openAngle;
                    wings.bottomLeft.rotation.y = openAngle;
                    
                    // Set the animation state to open
                    animationState = 'open';
                }
                
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
                

                model.scale.set(1, 1, 1);
                
                // Add the model to our cockpit group
                cockpit.add(model);
                cockpit.name = 'cockpitModel';
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
    function toggleView(camera, callback) {
        if (!cockpitLoaded) {
            console.warn("Cockpit model not yet loaded. Cannot switch to first-person view.");
            return;
        }
        
        console.log("⭐ TOGGLING VIEW - Before: isFirstPersonView =", isFirstPersonView);
        isFirstPersonView = !isFirstPersonView;
        console.log("⭐ TOGGLING VIEW - After: isFirstPersonView =", isFirstPersonView);
        console.log("*** TOGGLED VIEW: isFirstPersonView is now:", isFirstPersonView, " ***");
        
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
                cockpitModel.position.set(0, 0, 0); // distance between the camera and the cockpit - set in camera.js
                console.log("Cockpit model positioned");
            } else {
                console.warn("Cockpit model not found");
            }
            
            // // Make HUD visible
            // hudGroup.visible = true;
            // camera.add(hudGroup);
            
            // // Position HUD in front of the camera
            // hudGroup.position.set(0d, 0, -0.3);
            
            hudGroup.visible = false;
            camera.remove(hudGroup);
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
        
        // Call the callback with the current state if provided
        if (typeof callback === 'function') {
            console.log("Calling toggleView callback with isFirstPersonView:", isFirstPersonView);
            callback(isFirstPersonView);
        }
        
        return isFirstPersonView;
    }

    // Function to update the animation mixer
    function updateAnimations(deltaTime) {
        // Skip if no mixer exists
        if (!mixer) {
            return;
        }
        
        // Clamp deltaTime to avoid large jumps
        const clampedDelta = Math.min(deltaTime, 0.1);
        
        // Update the animation mixer
        mixer.update(clampedDelta);
        
        // // Debug every 100 frames (~1-2 seconds) to avoid console spam
        // if (Math.random() < 0.01) {
        //     console.log(`Animation update: mixer active = ${mixer.time > 0}, current state = ${animationState}`);
        //     if (currentAnimation) {
        //         console.log(`Current animation: ${currentAnimation.getClip().name}, time: ${currentAnimation.time.toFixed(2)}`);
        //     }
        // }
    }
    
    // Function to control wing animations
    function setWingsOpen(open) {
        // Get the target state name for logs
        const targetState = open ? 'open' : 'closed';
        
        // Don't restart the same animation if already in the correct state
        if (animationState === targetState) {
            // Already in the target state
            return;
        }
        
        // console.log(`Setting wings to ${targetState} (currently ${animationState})`);
        
        // Get wing references - use the stored wing references if available
        const wings = xWingModel?.userData?.wings || {};
        const topLeft = wings.topLeft;
        const topRight = wings.topRight;
        const bottomLeft = wings.bottomLeft;
        const bottomRight = wings.bottomRight;
        
        // Check if we have the wing objects
        if (!topLeft || !topRight || !bottomLeft || !bottomRight) {
            console.log("Wing objects not available - cannot animate wings directly");
            
            // Fall back to using the animation system if available
            if (mixer && wingsOpenAction && wingsCloseAction) {
                console.log("Falling back to animation system");
                // Reset all running animations to avoid conflicts
                mixer.stopAllAction();
                
                // Play the appropriate animation
                if (open) {
                    wingsOpenAction.reset();
                    wingsOpenAction.setLoop(THREE.LoopOnce);
                    wingsOpenAction.clampWhenFinished = true;
                    wingsOpenAction.timeScale = 2.0; // Double speed for faster animation
                    wingsOpenAction.play();
                    currentAnimation = wingsOpenAction;
                } else {
                    wingsCloseAction.reset();
                    wingsCloseAction.setLoop(THREE.LoopOnce);
                    wingsCloseAction.clampWhenFinished = true;
                    wingsCloseAction.timeScale = 2.0; // Double speed for faster animation
                    wingsCloseAction.play();
                    currentAnimation = wingsCloseAction;
                }
            }
        } else {
            // Use smooth animation instead of immediate rotation
            // console.log("Using smooth wing animation for transition");
            
            // Calculate start and end positions
            const startPos = animationState === 'open' ? 1 : 0;
            const endPos = open ? 1 : 0;
            
            // Set animation duration (in milliseconds)
            const duration = 350; // 350ms for wing transition
            
            // Start the animation
            animateWingTransition(startPos, endPos, duration);
        }
        
        // Update animation state
        animationState = targetState;
    }
    
    // Internal function to animate wing transitions
    function animateWingTransition(startPos, endPos, duration) {
        const startTime = performance.now();
        
        function animate(time) {
            const elapsed = time - startTime;
            const progress = Math.min(1, elapsed / duration);
            
            // Use an easing function for smoother animation
            const easedProgress = 0.5 - 0.5 * Math.cos(progress * Math.PI);
            const currentPos = startPos + (endPos - startPos) * easedProgress;
            
            // Use the existing setWingsPosition function to update wing positions
            updateWingPosition(currentPos);
            
            // Continue animation if not complete
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        }
        
        // Start the animation
        requestAnimationFrame(animate);
    }
    
    // Internal function to update wing positions without changing the animation state
    function updateWingPosition(position) {
        // Get wing references
        const wings = xWingModel?.userData?.wings || {};
        const topLeft = wings.topLeft;
        const topRight = wings.topRight;
        const bottomLeft = wings.bottomLeft;
        const bottomRight = wings.bottomRight;
        
        // Skip if wing objects aren't available
        if (!topLeft || !topRight || !bottomLeft || !bottomRight) {
            return;
        }
        
        // Clamp position between 0 and 1
        const normalizedPosition = Math.max(0, Math.min(1, position));
        
        // Define the open and closed angles
        const openAngle = Math.PI / 16;
        
        // Calculate the target angles based on position
        const topRightAngle = openAngle * normalizedPosition;
        const bottomRightAngle = -openAngle * normalizedPosition;
        const topLeftAngle = -openAngle * normalizedPosition;
        const bottomLeftAngle = openAngle * normalizedPosition;
        
        // Set the rotations 
        topRight.rotation.y = topRightAngle;
        bottomRight.rotation.y = bottomRightAngle;
        topLeft.rotation.y = topLeftAngle;
        bottomLeft.rotation.y = bottomLeftAngle;
    }

    // Return an object containing the spacecraft and all necessary methods and attributes
    return {
        spacecraft,
        cockpit,
        lightMaterial,
        fireLasers,
        startFiring,
        stopFiring,
        updateLasers,
        wingtipObjects,
        toggleView,
        
        // Add animation functions
        updateAnimations,
        setWingsOpen,
        
        // Direct wing toggle function for debugging
        toggleWings: function() {
            console.log("Manually toggling wings from current state:", animationState);
            setWingsOpen(animationState !== 'open');
            return `Wings now ${animationState}`;
        },
        
        // Direct wing position control for debugging (0 = closed, 1 = fully open)
        setWingsPosition: function(position) {
            // console.log(`Setting wings to position: ${position} (0=closed, 1=open)`);
            
            // Get wing references
            const wings = xWingModel?.userData?.wings || {};
            const topLeft = wings.topLeft;
            const topRight = wings.topRight;
            const bottomLeft = wings.bottomLeft;
            const bottomRight = wings.bottomRight;
            
            // Check if we have the wing objects
            if (!topLeft || !topRight || !bottomLeft || !bottomRight) {
                console.log("Wing objects not available - cannot set wing position directly");
                return "Cannot set wing position - wings not available";
            }
            
            // Clamp position between 0 and 1
            const normalizedPosition = Math.max(0, Math.min(1, position));
            
            // Use the internal function to update wing positions
            updateWingPosition(normalizedPosition);
            
            // Update animation state if at extremes
            if (normalizedPosition >= 0.99) {
                animationState = 'open';
            } else if (normalizedPosition <= 0.01) {
                animationState = 'closed';
            }
            
            return `Wings set to position ${normalizedPosition.toFixed(2)}`;
        },
        
        // Export current state of isFirstPersonView
        get isFirstPersonView() {
            // console.log("DEBUG - Accessing isFirstPersonView property, value:", isFirstPersonView);
            return isFirstPersonView;
        },
        
        // Define wing objects for animation and other uses
        // Use actual wing objects if available, otherwise fall back to wingtip objects
        get topRightWing() {
            return xWingModel.userData.wings?.topRight || wingtipObjects[0];
        },
        get bottomRightWing() {
            return xWingModel.userData.wings?.bottomRight || wingtipObjects[1];
        },
        get topLeftWing() {
            return xWingModel.userData.wings?.topLeft || wingtipObjects[2];
        },
        get bottomLeftWing() {
            return xWingModel.userData.wings?.bottomLeft || wingtipObjects[3];
        },
        reticle: reticleComponent.reticle,
        updateReticle: reticleComponent.update,
    };
}