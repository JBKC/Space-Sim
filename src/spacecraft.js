import * as THREE from 'https://cdn.skypack.dev/three@0.136.0';
import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/loaders/GLTFLoader.js';
import config from './config.js';
import { loadingManager, textureLoadingManager } from './loaders.js';
import { createReticle } from './reticle.js';

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
    const loader = new GLTFLoader(loadingManager);
    const xWingModel = new THREE.Group(); // This will hold the loaded model
    xWingModel.name = 'xWingModel'; // Set a name for the model
    
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

                // Create solid contrail effects for exhausts (essentially attached to the model, but initially invisible)
                console.log("Creating boost effects for exhausts...");
                const contrails = {};
                
                // Define contrail materials
                const normalContrailMaterial = new THREE.MeshBasicMaterial({
                    color: 0xff00ff,
                    transparent: true, 
                    opacity: 0.0, // Start invisible
                    side: THREE.DoubleSide,
                    blending: THREE.AdditiveBlending
                });
                
                const boostContrailMaterial = new THREE.MeshBasicMaterial({
                    color: 0xFF5349, // Orange-red for boost
                    transparent: true, 
                    opacity: 0.0, // Start invisible
                    side: THREE.DoubleSide,
                    blending: THREE.AdditiveBlending
                });
                
                // Create contrail meshes for each exhaust
                Object.keys(exhaustAndTurretObjects).forEach(key => {
                    if (key.startsWith('exhaust_') && exhaustAndTurretObjects[key]) {
                        const exhaust = exhaustAndTurretObjects[key];
                        console.log(`Creating contrail for ${key}`);
                        
                        // Create a tapered cylindrical geometry for the contrail
                        // radiusTop, radiusBottom, height, radialSegments
                        const contrailGeometry = new THREE.CylinderGeometry(0.05, 0.15, 2.0, 8, 1, true);
                        
                        // Create two materials for normal and boost states
                        const normalMaterial = normalContrailMaterial.clone();
                        const boostMaterial = boostContrailMaterial.clone();
                        
                        // Create the contrail mesh with the normal material initially
                        const contrailMesh = new THREE.Mesh(contrailGeometry, normalMaterial);
                        
                        // Position the contrail behind the exhaust
                        contrailMesh.position.set(0, 0, -1.0); // Z axis is backward
                        
                        // Rotate the cylinder to point backward
                        contrailMesh.rotation.x = Math.PI / 2;
                        
                        // Add contrail to the exhaust
                        exhaust.add(contrailMesh);
                        
                        // Store references to the contrail and its materials
                        contrails[key] = {
                            mesh: contrailMesh,
                            normalMaterial: normalMaterial,
                            boostMaterial: boostMaterial
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
    
    // Add the spacecraft to the scene
    scene.add(spacecraft);
    


    //// DELETE WINGTIP STUFF

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
            

        } else {
            // Switch back to third-person view
            console.log("Switching to third-person view");
            
            // Remove cockpit model from spacecraft
            spacecraft.remove(cockpit);
            
            // Add X-wing model back to spacecraft
            loadModel.then((model) => {
                spacecraft.add(model);
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

    // Unified wing animation control system
    const wingAnimationController = (() => {
        // Constants
        const OPEN_ANGLE = Math.PI / 16;
        const DEFAULT_DURATION = 350; // Animation duration in milliseconds
        
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

    // Animation mixer function (unchanged)
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


    // Return an object containing the spacecraft and all necessary methods and attributes
    return {
        spacecraft,
        cockpit,
        lightMaterial,
        wingtipObjects,
        toggleView,
        
        // Add animation functions
        updateAnimations,
        setWingsOpen: wingAnimationController.setWingsOpen,
        toggleWings: wingAnimationController.toggleWings,
        setWingsPosition: wingAnimationController.setWingsPosition,
        
        // Add contrails system
        createContrails: function() {
            console.log("Creating solid contrail system");
            return xWingModel?.userData?.contrails || {};
        },
        
        updateContrails: function(isBoosting, deltaTime) {
            // Skip if model or contrails aren't loaded
    Object.keys(contrails).forEach(key => {
        const contrail = contrails[key];
        const exhaust = exhaustAndTurretObjects[key];
        
        // Update position history
        const currentPosition = new THREE.Vector3();
        exhaust.getWorldPosition(currentPosition);
        contrail.positionHistory.push(currentPosition);
        if (contrail.positionHistory.length > 10) {
            contrail.positionHistory.shift();
        }
        
        // Set path points from history
        const points = contrail.positionHistory.slice().reverse(); // Most recent first
        contrail.path.points = points;
        
        // Update geometry with tapering radius
        const radii = points.map((_, i) => 0.1 - i * 0.01); // Taper from 0.1 to 0
        const newGeometry = new THREE.TubeGeometry(
            contrail.path,
            points.length - 1,
            radii,
            8,
            false
        );
        
        // Update mesh
        contrail.mesh.geometry.dispose();
        contrail.mesh.geometry = newGeometry;
        
        // Handle material and opacity
        if (isBoosting) {
            contrail.mesh.material = contrail.boostMaterial;
            contrail.mesh.material.opacity = Math.min(0.8, contrail.mesh.material.opacity + 0.1);
        } else {
            if (contrail.mesh.material.opacity > 0) {
                contrail.mesh.material.opacity = Math.max(0, contrail.mesh.material.opacity - 0.1);
            }
            if (contrail.mesh.material.opacity <= 0) {
                contrail.mesh.material = contrail.normalMaterial;
                contrail.mesh.material.opacity = 0;
                    }
                }
            });
        },
        
        // Add engine effects function for compatibility with existing code
        updateEngineEffects: function(isBoosting, deltaTime) {
            // No need to call updateContrails here since we're handling it directly below
            // This was causing a reference error
            
            // Update solid contrail effects based on boost state
            const contrails = xWingModel?.userData?.contrails || {};
            
            // Iterate through each contrail
            Object.keys(contrails).forEach(key => {
                const contrail = contrails[key];
                
                if (isBoosting) {
                    // When boosting:
                    // 1. Switch to boost material if not already using it
                    if (contrail.mesh.material !== contrail.boostMaterial) {
                        contrail.mesh.material = contrail.boostMaterial;
                    }
                    
                    // 2. Make contrail visible with full opacity
                    contrail.mesh.material.opacity = 0.8;
                    
                    // 3. Stretch the contrail for more dramatic effect
                    if (contrail.mesh.scale.z < 1.5) {
                        contrail.mesh.scale.z = 1.5;
                    }
                    
                    // 4. Light pulsing effect
                    const pulseFactor = 0.1 * Math.sin(performance.now() / 100) + 0.9;
                    contrail.mesh.scale.x = pulseFactor;
                    contrail.mesh.scale.y = pulseFactor;
                } else {
                    // When not boosting, fade out the contrail
                    if (contrail.mesh.material.opacity > 0) {
                        // Gradually fade out
                        contrail.mesh.material.opacity -= 0.1;
                        
                        // If opacity reaches zero, switch back to normal material
                        if (contrail.mesh.material.opacity <= 0) {
                            contrail.mesh.material = contrail.normalMaterial;
                            contrail.mesh.material.opacity = 0;
                            
                            // Reset scale
                            contrail.mesh.scale.set(1, 1, 1);
                        }
                    }
                }
            });
            
            // For debugging
            if (Math.random() < 0.01) { // Limit logging to avoid console spam
                console.log(`Engine effects updated: boosting=${isBoosting}`);
            }
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