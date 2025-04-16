                    // Show transition before initializing Earth surface
                    showEarthTransition(() => {
                        resetMovementInputs();
                        let earthObjects = null; // Declare variable to hold init result
                        
                        // Initialize Earth once the transition is complete
                        if (!getEarthInitialized()) {
                            console.log('Initializing Earth surface');
                            earthObjects = initEarthSurface(); // Store the result
                            setEarthInitialized(true);
                            console.log('Earth surface initialized.');
                            // ... (schedule resetPosition) ...
                            setEarthTransition(false);
                            hideSpaceScene();
                            document.body.appendChild(earthMsg);
                        } else {
                            // If already initialized, still ensure transition flag is false
                            setEarthTransition(false); 
                        }

                        // AFTER potentially initializing or just setting flags, attempt focus
                        if (earthRenderer && earthRenderer.domElement) { 
                            console.log("Attempting to focus Earth renderer DOM element (post-init/flag check)...");
                            earthRenderer.domElement.focus();
                            setTimeout(() => { 
                                console.log("After focus attempt, Active Element:", document.activeElement ? document.activeElement.tagName : 'None');
                            }, 100);
                        } else {
                            console.error("Earth renderer DOM element not available to focus (post-init/flag check).");
                        }
                    });
                }

                // ELSE IF we are already on the Earth surface (initialized and transition done), update and render
                else if (isEarthSurfaceActive && getEarthInitialized() && !getEarthTransition()) {
                    
                    // Simplified check: If body has focus, try focusing canvas
                    if (earthRenderer && earthRenderer.domElement && document.activeElement === document.body) {
                         // console.log("Re-focusing Earth renderer (body had focus)..."); 
                         earthRenderer.domElement.focus();
                    }

                    // Force Earth DOM to the front as a failsafe
// ... existing code ... 