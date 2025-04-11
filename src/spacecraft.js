// spacecraft.js

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import config from './config.js';
import { loadingManager, textureLoadingManager } from './loaders.js';
import { createReticle } from './reticle.js';
import { keys } from './movement.js';

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
    
    // Wing animation system
    let mixer = null;
    let animations = [];
    let wingsOpenAction = null;
    let wingsCloseAction = null;
    let currentAnimation = null;
    let animationState = 'open'; // 'open' or 'closed'

    // Wing animation constants
    const OPEN_ANGLE = Math.PI / 16;    // Angle of wings when open
    const DEFAULT_DURATION = 350;       // Time taken for wings to open/close in milliseconds
    
    // Create a purple/pink material for the engine greebles
    const purplePinkMaterial = new THREE.MeshStandardMaterial({
        color: 0xff00ff,         // Bright purple/pink
        emissive: 0xaa00aa,      // Slightly darker purple/pink for emissive
        emissiveIntensity: 5,  // Glowing
        metalness: 0.7,          // A bit metallic
        roughness: 0.3           // Fairly smooth
    });
    
    // Load the X-Wing glTF model
    const loader = new GLTFLoader(loadingManager);
    const xWingModel = new THREE.Group(); // This will hold the loaded model
    xWingModel.name = 'xWingModel'; // Set a name for the model
    
    // Debug object to track engine effects issues
    window.engineEffectsDebug = {
        xWingModel: xWingModel,
        checkContrails: function() {
            console.log("DEBUG CONTRAILS GLOBAL CHECK");
            console.log("xWingModel exists:", !!this.xWingModel);
            console.log("xWingModel userData:", this.xWingModel?.userData);
            console.log("Contrails:", this.xWingModel?.userData?.contrails);
            if (this.xWingModel?.userData?.contrails) {
                Object.keys(this.xWingModel.userData.contrails).forEach(key => {
                    const contrail = this.xWingModel.userData.contrails[key];
                    console.log(`Contrail ${key}:`, contrail.mesh);
                });
            }
            return "Check console for results";
        }
    };
    
    // Create a promise to load the model (async operation that will load the model when called - we don't want it to block)
    const loadModel = new Promise((resolve, reject) => {
        loader.load(
            `${config.models.path}/xwing_axespoints.glb`,
            (gltf) => {
                const model = gltf.scene;
                
                // Scale and position the model appropriately
                model.scale.set(1, 1, 1);
                // Add the model to our x-wing group
                xWingModel.add(model);

                ///// Change Engine Color /////

                console.log("===== CHECKING FOR ENGINE ELEMENTS =====");
                model.traverse((child) => {
                    if (child.isMesh) {
                        // ONLY color these exact elements - nothing else
                        const engineElements = [
                            'RightWingBottomEngineAndGreebles_3',
                            'RightWingTopEngineAndGreebles_3',
                            'LeftWingBottomEngineAndGreebles_3',
                            'LeftWingTopEngineAndGreebles_3'
                        ];
                        
                        // Only color if exact name match
                        if (engineElements.includes(child.name)) {
                            console.log(`✓ Found element: ${child.name}`);
                            child.material = purplePinkMaterial.clone();
                        }
                    }
                });


                ///// Find Wings /////
                
                // Create an object to track these elements
                const wings = {
                    topLeft: null,
                    bottomLeft: null,
                    topRight: null,
                    bottomRight: null,
                };
                

                // Find the Root object
                console.log("===== CHECKING FOR WING ELEMENTS =====");

                model.traverse((child) => {
                    if (child.name === 'Root') {
                        console.log("Found Root object");
                        
                        // Look for X-Wing under Root
                        child.children.forEach(xwingChild => {
                            if (xwingChild.name === 'X-Wing') {
                                console.log("Found X-Wing under Root with", xwingChild.children.length, "children");
                                
                                // Try to match the wings directly
                                xwingChild.children.forEach(wingChild => {
                                    // These are the exact names from the image
                                    if (wingChild.name === 'LeftWingTop') {
                                        wings.topLeft = wingChild;
                                        console.log('✓ Found element: LeftWingTop');
                                    }
                                    if (wingChild.name === 'LeftWingBottom') {
                                        wings.bottomLeft = wingChild;
                                        console.log('✓ Found element: LeftWingBottom');
                                    }
                                    if (wingChild.name === 'RightWingTop') {
                                        wings.topRight = wingChild;
                                        console.log('✓ Found element: RightWingTop');
                                    }
                                    if (wingChild.name === 'RightWingBottom') {
                                        wings.bottomRight = wingChild;
                                        console.log('✓ Found element: RightWingBottom');
                                    }
                                    
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

                // Store wings reference for later use in the export
                xWingModel.userData.wings = wings;


                // Explicitly set wings to open position after model is loaded
                if (wings.topLeft && wings.topRight && wings.bottomLeft && wings.bottomRight) {
                    console.log("Setting initial wing position to OPEN");
                    
                    // Set to open position (X shape)
                    wings.topRight.rotation.y = OPEN_ANGLE;
                    wings.bottomRight.rotation.y = -OPEN_ANGLE;
                    wings.topLeft.rotation.y = -OPEN_ANGLE;
                    wings.bottomLeft.rotation.y = OPEN_ANGLE;
                    
                    // Set the animation state to open
                    animationState = 'open';
                }
            
                
                ///// Find Exhausts and Turrets /////

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
            
                xWingModel.userData.exhaustAndTurret = exhaustAndTurretObjects; // Store references

                
                ///// Create Engine Boost Effects /////

                // Create material + shape
                console.log("Creating exhaust flames");
                const contrails = {};
                
                const flameMaterial = new THREE.MeshBasicMaterial({
                    color: 0xff00ff,
                    transparent: true,
                    side: THREE.DoubleSide
                });
                
                // Create a boost trail for each exhaust
                Object.keys(exhaustAndTurretObjects).forEach(key => {
                    if (key.startsWith('exhaust_') && exhaustAndTurretObjects[key]) {
                        const exhaust = exhaustAndTurretObjects[key];
                        console.log(`Creating flame trail for ${key}`);
                        
                        const FLAME_SIZE = 10;
                        
                        // Create a flame group to hold both parts
                        const flameGroup = new THREE.Group();
                        
                        // Primary (outer) flame
                        const primaryFlameGeometry = new THREE.ConeGeometry(0.3, FLAME_SIZE, 16, 1);
                        const primaryFlameMesh = new THREE.Mesh(primaryFlameGeometry, flameMaterial);
                        primaryFlameMesh.material.opacity = 0.3
                        primaryFlameMesh.rotation.x = -Math.PI / 2;
                        primaryFlameMesh.position.set(0, 0, -FLAME_SIZE/2);
                        primaryFlameMesh.userData.initialScale = 1.0;
                        primaryFlameMesh.userData.pulseFactor = 0;
                        
                        // Secondary (inner) flame - smaller and brighter
                        const secondaryFlameGeometry = new THREE.ConeGeometry(0.15, FLAME_SIZE * 0.7, 16, 1);
                        const secondaryFlameMesh = new THREE.Mesh(secondaryFlameGeometry, flameMaterial.clone());
                        secondaryFlameMesh.material.opacity = 0.9; // More opaque for brighter inner flame
                        secondaryFlameMesh.rotation.x = -Math.PI / 2;
                        secondaryFlameMesh.position.set(0, 0, -FLAME_SIZE * 0.4);
                        
                        // Add both flames to the group
                        flameGroup.add(primaryFlameMesh);
                        flameGroup.add(secondaryFlameMesh);
                        
                        // Add group to exhaust
                        exhaust.add(flameGroup);
                        
                        // Store reference to the group
                        contrails[key] = {
                            mesh: flameGroup,
                            primaryFlameMesh: primaryFlameMesh // Store reference to primary flame for pulsing
                        };
                    }
                });
                
                // Store contrails for later updates
                xWingModel.userData.contrails = contrails;
                
                
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
    
    // Do the same for the cockpit (first person view)
    const loadCockpitModel = new Promise((resolve, reject) => {
        loader.load(
            `${config.models.path}/x-wing_cockpit/scene.gltf`,
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
    

    ///// Load 3rd and 1st person models /////

    // 3rd person
    loadModel.then((model) => {
        
        spacecraft.add(model);
        
        // Position spacecraft after model is loaded (for space scene)
        spacecraft.position.set(40000, 40000, 40000);
        const centerPoint = new THREE.Vector3(0, 0, 10000);
        spacecraft.lookAt(centerPoint);
        

    }).catch(error => {
        console.error("Failed to load X-Wing model:", error);
    });
    
    // 1st person
    loadCockpitModel.then(() => {
        console.log("Cockpit model loaded successfully");
    }).catch(error => {
        console.error("Failed to load cockpit model:", error);
    });
    

    // Create a reticle that's attached to the spacecraft
    console.log("Creating reticle");
    const reticleComponent = createReticle(scene, spacecraft);

    // Store reticle references
    spacecraft.userData.reticle = reticleComponent.reticle;
    spacecraft.userData.updateReticle = reticleComponent.update;

    // Confirm reticle creation
    if (reticleComponent && reticleComponent.reticle) {
        console.log("✅ Reticle successfully created and attached to spacecraft");
    } else {
        console.error("❌ Failed to create or attach reticle");
    }
    
    // Function to toggle and track between first-person and third-person views
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
            console.log("Found xWingModel in spacecraft:", xWing ? "Yes" : "No");
            if (xWing) {
                console.log("Removing xWingModel from spacecraft. Contrails available:", xWing.userData?.contrails ? "Yes" : "No");
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
            

        } else {
            // Switch back to third-person view
            console.log("Switching to third-person view");
            
            // Remove cockpit model from spacecraft
            spacecraft.remove(cockpit);
            
            // Add X-wing model back to spacecraft
            loadModel.then((model) => {
                console.log("Adding xWingModel back to spacecraft. Contrails available:", model.userData?.contrails ? "Yes" : "No");
                
                // Log contrail details before adding the model back
                if (model.userData?.contrails) {
                    console.log("FLAMES:", Object.keys(model.userData.contrails).length, "found");
                }
                
                spacecraft.add(model);
                
                // Trigger update of engine effects right after adding the model
                // Pass the current boosting state to updateEngineEffects
                setTimeout(() => {
                    if (typeof updateEngineEffects === 'function') {
                        // Use the imported keys object to determine boosting state
                        const isCurrentlyBoosting = keys && keys.up;
                        console.log("Forcing engine effects update after view switch, boosting state:", isCurrentlyBoosting, "keys.up:", keys?.up);
                        updateEngineEffects(isCurrentlyBoosting);
                    }
                }, 100);
            });
            
        }
        
        // Call the callback with the current state if provided
        if (typeof callback === 'function') {
            console.log("Calling toggleView callback with isFirstPersonView:", isFirstPersonView);
            callback(isFirstPersonView);
        }
        
        return isFirstPersonView;
    }


    /////// WING ANIMATION SYSTEM ///////

    // Master controller for wing open / close animation
    const wingAnimationController = (() => {

        // Get wing references
        const getWings = () => {
            const wings = xWingModel?.userData?.wings || {};
            return {
                topLeft: wings.topLeft,
                topRight: wings.topRight,
                bottomLeft: wings.bottomLeft,
                bottomRight: wings.bottomRight
            };
        };
        
        // Check if wing objects are available
        const areWingsAvailable = () => {
            const wings = getWings();
            return wings.topLeft && wings.topRight && wings.bottomLeft && wings.bottomRight;
        };
        
        // Internal function to set wing positions directly
        const setWingPositions = (position) => {
            const wings = getWings();
            
            // Skip if wing objects aren't available
            if (!areWingsAvailable()) return false;
            
            // Clamp position between 0 and 1
            const normalizedPosition = Math.max(0, Math.min(1, position));
            
            // Calculate the target angles based on position
            const topRightAngle = OPEN_ANGLE * normalizedPosition;
            const bottomRightAngle = -OPEN_ANGLE * normalizedPosition;
            const topLeftAngle = -OPEN_ANGLE * normalizedPosition;
            const bottomLeftAngle = OPEN_ANGLE * normalizedPosition;
            
            // Set the rotations 
            wings.topRight.rotation.y = topRightAngle;
            wings.bottomRight.rotation.y = bottomRightAngle;
            wings.topLeft.rotation.y = topLeftAngle;
            wings.bottomLeft.rotation.y = bottomLeftAngle;
            
            // Update animation state if at extremes
            if (normalizedPosition >= 0.99) {
                animationState = 'open';
            } else if (normalizedPosition <= 0.01) {
                animationState = 'closed';
            }
            
            return true;
        };
        
        // Animate wings between positions
        const animateWings = (startPos, endPos, duration = DEFAULT_DURATION) => {
            const startTime = performance.now();
            
            function animate(time) {
                const elapsed = time - startTime;
                const progress = Math.min(1, elapsed / duration);
                
                // Use an easing function for smoother animation
                const easedProgress = 0.5 - 0.5 * Math.cos(progress * Math.PI);
                const currentPos = startPos + (endPos - startPos) * easedProgress;
                
                // Update wing positions
                setWingPositions(currentPos);
                
                // Continue animation if not complete
                if (progress < 1) {
                    requestAnimationFrame(animate);
                }
            }
            
            // Start the animation
            requestAnimationFrame(animate);
        };
        
        // Public API
        return {
            // Set wings to open or closed position with animation
            setWingsOpen: (open) => {
                const targetState = open ? 'open' : 'closed';
                
                // Don't restart animation if already in correct state
                if (animationState === targetState) return;
                
                // Calculate start and end positions
                const startPos = animationState === 'open' ? 1 : 0;
                const endPos = open ? 1 : 0;
                
                // Animate to target position
                animateWings(startPos, endPos);
                
                // Update animation state
                animationState = targetState;
            },
            
            // Toggle wings between open and closed
            toggleWings: () => {
                const newState = animationState !== 'open';
                wingAnimationController.setWingsOpen(newState);
                return `Wings now ${animationState}`;
            },
            
            // Directly set wing position (0-1)
            setWingsPosition: (position) => {
                if (!areWingsAvailable()) {
                    console.log("Wing objects not available - cannot set wing position directly");
                    return "Cannot set wing position - wings not available";
                }
                
                setWingPositions(position);
                return `Wings set to position ${position.toFixed(2)}`;
            },
            
            // Get current wing state
            getWingState: () => animationState
        };
    })();

    // Animation mixer == blends different animations together
    function updateAnimations(deltaTime) {
        // Skip if no mixer exists
        if (!mixer) {
            return;
        }
        // Clamp deltaTime to avoid large jumps
        const clampedDelta = Math.min(deltaTime, 0.1);
        // Update the animation mixer
        mixer.update(clampedDelta);
    }


    /////// ENGINE EFFECTS SYSTEM ///////

    // Engine effects function - shows flames only when boosting
    function updateEngineEffects(isBoosting, deltaTime) {
        // Skip if model isn't loaded or doesn't have contrails
        const contrails = xWingModel?.userData?.contrails || {};
        if (!contrails || Object.keys(contrails).length === 0) {
            return;
        }
        
        // Determine if we're boosting, either from parameter or directly from keys
        const isBoostActive = isBoosting || (keys && keys.up);
        
        // console.log("Engine effects update - boosting:", isBoostActive, 
        //             "param:", isBoosting, 
        //             "keys.up:", keys?.up);
        
        // Show/hide flames based on boosting state
        Object.keys(contrails).forEach(key => {
            const contrail = contrails[key];
            if (contrail && contrail.mesh) {
                // Set visibility based on boosting state
                contrail.mesh.visible = isBoostActive;
                
                // Apply pulsing effect to primary flame when visible
                if (isBoostActive && contrail.primaryFlameMesh) {
                    const primaryFlameMesh = contrail.primaryFlameMesh;
                    
                    // Update pulse factor
                    primaryFlameMesh.userData.pulseFactor = 
                        (primaryFlameMesh.userData.pulseFactor || 0) + (deltaTime || 0.016) * 4.0;
                    
                    // Calculate scale factor between 0.6 and 0.8 (60-80% of FLAME_SIZE)
                    const pulseScale = 0.6 + Math.sin(primaryFlameMesh.userData.pulseFactor) * 0.1;
                    
                    // Apply scale only to the z-axis (length) of the flame
                    primaryFlameMesh.scale.z = pulseScale;
                }
            }
        });
    }

    // Add the spacecraft to the scene (fallback)
    scene.add(spacecraft);

    ///// RETURN SPACECRAFT OBJECT /////

    // Return an object containing the spacecraft and all necessary attributes and methods
    // Note - referred to as spacecraftComponents in setup.js
    return {
        // attributes
        spacecraft,
        cockpit,
        reticle: reticleComponent.reticle,
        updateReticle: reticleComponent.update,

        // methods
        toggleView,
        updateAnimations,
        setWingsOpen: wingAnimationController.setWingsOpen,
        toggleWings: wingAnimationController.toggleWings,
        setWingsPosition: wingAnimationController.setWingsPosition,
        updateEngineEffects,

        get isFirstPersonView() {return isFirstPersonView},

    };
}