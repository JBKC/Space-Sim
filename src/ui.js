// src/ui.js

////////// GENERAL APPEARANCE//////////

export const planetaryBlue = '#4fc3f7';

////////// CONTROLS DROPDOWN //////////

// Controls Dropdown (press Enter prompt in top left corner)
export function setupControlsDropdown() {
    const controlsPrompt = document.getElementById('controls-prompt');
    const controlsDropdown = document.getElementById('controls-dropdown');
    
    if (!controlsPrompt || !controlsDropdown) return;
    
    // Hide controls prompt on welcome screen
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen && welcomeScreen.style.display !== 'none') {
        controlsPrompt.style.display = 'none';
    }
}

// Toggle controls dropdown between visible and hidden
export function toggleControlsDropdown() {
    const controlsDropdown = document.getElementById('controls-dropdown');
    const controlsPrompt = document.getElementById('controls-prompt');
    if (!controlsDropdown || !controlsPrompt) return;
    
    if (controlsDropdown.style.display === 'none' || controlsDropdown.style.display === '') {
        controlsDropdown.style.display = 'block';
        controlsDropdown.style.zIndex = '10000'; // Ensure it's above everything else
        controlsPrompt.textContent = 'Press Enter to hide controls';
        
        // Log for debugging
        console.log('Controls dropdown visibility: ', controlsDropdown.style.display);
        console.log('Controls dropdown z-index: ', controlsDropdown.style.zIndex);
        console.log('Controls dropdown position: ', controlsDropdown.style.position);
    } else {
        controlsDropdown.style.display = 'none';
        controlsPrompt.textContent = 'Press Enter to view controls';
    }
}

// Edit controls dropdown content based on current scene (space vs surface)
export function updateControlsDropdown(isEarthSurfaceActive, isMoonSurfaceActive) {
    
    const controlsDropdown = document.getElementById('controls-dropdown');
    if (!controlsDropdown) {
        console.error('Controls dropdown element not found!');
        return;
    }

    // Select the options using their classes
    const hyperspaceOption = controlsDropdown.querySelector('.hyperspace-option');
    const orbitalPathsOption = controlsDropdown.querySelector('.orbital-paths-option');

    // Determine if we should hide options based on environment
    const shouldHide = isEarthSurfaceActive || isMoonSurfaceActive;

    // Handle hyperspace option visibility
    if (hyperspaceOption) {
        // Use style.display for <p> elements
        hyperspaceOption.style.display = shouldHide ? 'none' : 'block';
    } else {
        console.warn('Hyperspace option element (.hyperspace-option) not found inside #controls-dropdown'); 
    }
    
    // Handle orbital paths option visibility
    if (orbitalPathsOption) {
        orbitalPathsOption.style.display = shouldHide ? 'none' : 'block';
    } else {
        console.warn('Orbital paths option element (.orbital-paths-option) not found inside #controls-dropdown'); 
    }
}

// Show controls prompt when game starts
export function showControlsPrompt() {
    const controlsPrompt = document.getElementById('controls-prompt');
    if (controlsPrompt) {
        controlsPrompt.style.display = 'block';
    }
}


///// EXPLORATION / CELESTIAL BODY INFO /////


// Create data for popups on all celestial objects
export const planetInfo = {
    'mercury': {
        composition: 'Metallic core, silicate crust',
        atmosphere: 'Thin exosphere',
        gravity: '38% of Earth'
    },
    'venus': {
        composition: 'Rocky, iron core',
        atmosphere: 'Thick CO₂, sulfuric acid',
        gravity: '90% of Earth'
    },
    'earth': {
        composition: 'Iron core, silicate mantle',
        atmosphere: 'Nitrogen, oxygen',
        gravity: '9.81 m/s²'
    },
    'moon': {
        composition: 'Rocky, silicate crust',
        atmosphere: 'Thin exosphere',
        gravity: '16% of Earth'
    },
    'mars': {
        composition: 'Rocky, iron-nickel core',
        atmosphere: 'Thin CO₂',
        gravity: '38% of Earth'
    },
    'asteroid belt': {
        composition: 'Silicate rock, metals, carbon',
        atmosphere: 'None (vacuum of space)',
        gravity: 'Negligible'
    },
    'jupiter': {
        composition: 'Hydrogen, helium',
        atmosphere: 'Dynamic storms',
        gravity: '250% of Earth'
    },
    'saturn': {
        composition: 'Hydrogen, helium',
        atmosphere: 'Fast winds, methane',
        gravity: '107% of Earth'
    },
    'uranus': {
        composition: 'Icy, hydrogen, helium',
        atmosphere: 'Methane haze',
        gravity: '89% of Earth'
    },
    'neptune': {
        composition: 'Icy, rocky core',
        atmosphere: 'Methane clouds',
        gravity: '114% of Earth'
    },
    'imperial star destroyer': {
        affiliation: 'Galactic Empire',
        manufacturer: 'Kuat Drive Yards',
        crew: '40,000'
    },
    'lucrehulk': {
        affiliation: 'Confederacy of Independent Systems',
        manufacturer: 'Hoersch-Kessel Drive',
        crew: '200,000'
    },
    'death star': {
        affiliation: 'Galactic Empire',
        manufacturer: 'Imperial Military Research Department',
        crew: '1,700,000'
    }
};

// Create the info box design
export const planetInfoBox = document.createElement('div');
planetInfoBox.className = 'planet-info-box';
planetInfoBox.style.position = 'absolute';
planetInfoBox.style.fontFamily = 'Orbitron, sans-serif';
planetInfoBox.style.fontSize = '16px';
planetInfoBox.style.color = 'white';
planetInfoBox.style.backgroundColor = 'rgba(1, 8, 36, 0.8)';
planetInfoBox.style.border = `2px solid ${planetaryBlue}`;
planetInfoBox.style.borderRadius = '5px';
planetInfoBox.style.padding = '15px';
planetInfoBox.style.width = '320px';
planetInfoBox.style.pointerEvents = 'none';
planetInfoBox.style.zIndex = '1000';
planetInfoBox.style.display = 'none'; // Hidden by default
// Ensure the box isn't positioned off-screen initially
planetInfoBox.style.right = '';
planetInfoBox.style.left = '';
planetInfoBox.style.top = '';

// Create the exploration counter design
export const explorationCounter = document.createElement('div');
explorationCounter.className = 'exploration-counter';
explorationCounter.style.position = 'fixed';
explorationCounter.style.top = '20px';
explorationCounter.style.right = '20px';
explorationCounter.style.padding = '10px 15px';
explorationCounter.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
explorationCounter.style.color = planetaryBlue;
explorationCounter.style.fontFamily = 'Orbitron, sans-serif';
explorationCounter.style.fontSize = '16px';
explorationCounter.style.borderRadius = '5px';
explorationCounter.style.border = `1px solid ${planetaryBlue}`;
explorationCounter.style.zIndex = '1000';
explorationCounter.style.display = 'none'; // Initially hidden until game starts


///// Special Countdown Indicators for Enterable Objects /////

// Earth
export const earthDistanceIndicator = document.createElement('div');
earthDistanceIndicator.className = 'distance-indicator';
earthDistanceIndicator.style.color = 'white';
earthDistanceIndicator.style.fontFamily = 'Orbitron, sans-serif';
earthDistanceIndicator.style.fontSize = '18px';
earthDistanceIndicator.style.textAlign = 'center';
earthDistanceIndicator.style.position = 'absolute';
earthDistanceIndicator.style.display = 'none'; // Initially hidden
earthDistanceIndicator.style.backgroundColor = 'rgba(1, 8, 36, 0.6)';
earthDistanceIndicator.style.padding = '5px 10px';
earthDistanceIndicator.style.borderRadius = '5px';
earthDistanceIndicator.style.zIndex = '9999'; // Ensure it's on top of other elements
document.body.appendChild(earthDistanceIndicator);

// Moon
export const moonDistanceIndicator = document.createElement('div');
moonDistanceIndicator.className = 'distance-indicator';
moonDistanceIndicator.style.color = 'white';
moonDistanceIndicator.style.fontFamily = 'Orbitron, sans-serif';
moonDistanceIndicator.style.fontSize = '18px';
moonDistanceIndicator.style.textAlign = 'center';
moonDistanceIndicator.style.position = 'absolute';
moonDistanceIndicator.style.display = 'none'; // Initially hidden
moonDistanceIndicator.style.backgroundColor = 'rgba(1, 8, 36, 0.6)';
moonDistanceIndicator.style.padding = '5px 10px';
moonDistanceIndicator.style.borderRadius = '5px';
moonDistanceIndicator.style.zIndex = '9998'; // Ensure it's always just below the earth distance indicator
document.body.appendChild(moonDistanceIndicator);


///// Surface Message / Button Prompts /////

export const earthMsg = document.createElement('div');
earthMsg.id = 'earth-surface-message';
earthMsg.style.position = 'fixed';
earthMsg.style.top = '20px';
earthMsg.style.right = '20px';
earthMsg.style.color = '#b3e5fc';
earthMsg.style.fontFamily = 'Orbitron, sans-serif';
earthMsg.style.fontSize = '16px';
earthMsg.style.padding = '10px';
earthMsg.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
earthMsg.style.borderRadius = '5px';
earthMsg.style.zIndex = '9999';
earthMsg.style.boxShadow = '0 0 10px rgba(79, 195, 247, 0.3)'; // Added subtle blue glow
earthMsg.style.border = '1px solid rgba(79, 195, 247, 0.3)'; // Added subtle border
earthMsg.innerHTML = 'EARTH SURFACE<br>Press ESC to return to space<br>Press R to reset position';


export const moonMsg = document.createElement('div');
moonMsg.id = 'moon-surface-message';
moonMsg.style.position = 'fixed';
moonMsg.style.top = '20px';
moonMsg.style.right = '20px';
moonMsg.style.color = '#b3e5fc'; // Changed from white to light blue
moonMsg.style.fontFamily = 'Orbitron, sans-serif';
moonMsg.style.fontSize = '16px';
moonMsg.style.padding = '10px';
moonMsg.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
moonMsg.style.borderRadius = '5px';
moonMsg.style.zIndex = '9999';
moonMsg.style.boxShadow = '0 0 10px rgba(79, 195, 247, 0.3)'; // Added subtle blue glow
moonMsg.style.border = '1px solid rgba(79, 195, 247, 0.3)'; // Added subtle border
moonMsg.innerHTML = 'MOON SURFACE<br>Press ESC to return to space<br>Press R to reset position';


///// Collision Warning /////
export const warningElement = document.createElement('div');
warningElement.id = 'collision-warning';
warningElement.textContent = "WASTED";
warningElement.style.position = 'fixed';
warningElement.style.top = '40%'; // Moved up from 50% to 40% to appear higher on screen
warningElement.style.left = '50%';
warningElement.style.transform = 'translate(-50%, -50%)';
warningElement.style.color = '#ff0000';
warningElement.style.fontFamily = 'Orbitron, sans-serif';
warningElement.style.fontSize = '32px';
warningElement.style.fontWeight = 'bold';
warningElement.style.zIndex = '10000';
warningElement.style.textShadow = '0 0 10px rgba(255, 0, 0, 0.7)';
warningElement.style.padding = '20px';
warningElement.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
warningElement.style.borderRadius = '5px';
warningElement.style.opacity = '1';
warningElement.style.transition = 'opacity 0.5s ease-out';


// VR Status Indicator
export function createVRStatusIndicator() {
    const vrStatusContainer = document.createElement('div');
    vrStatusContainer.id = 'vr-status-container';
    vrStatusContainer.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        z-index: 1000;
    `;

    // Create status indicator
    const vrStatusIndicator = document.createElement('div');
    vrStatusIndicator.id = 'vr-status-indicator';
    vrStatusIndicator.style.cssText = `
        display: flex;
        align-items: center;
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-family: Arial, sans-serif;
        margin-bottom: 8px;
        cursor: pointer;
    `;

    // VR icon (simplified headset shape using CSS)
    const vrIcon = document.createElement('div');
    vrIcon.style.cssText = `
        width: 24px;
        height: 16px;
        border: 2px solid white;
        border-radius: 8px;
        position: relative;
        margin-right: 8px;
    `;

    // VR status text
    const vrStatusText = document.createElement('span');
    vrStatusText.id = 'vr-status-text';
    
    // VR instructions panel (hidden by default)
    const vrInstructions = document.createElement('div');
    vrInstructions.id = 'vr-instructions';
    vrInstructions.style.cssText = `
        background: rgba(0, 0, 0, 0.85);
        color: white;
        padding: 15px;
        border-radius: 8px;
        width: 300px;
        font-family: Arial, sans-serif;
        line-height: 1.4;
        display: none;
    `;
    vrInstructions.innerHTML = `
        <h3 style="margin-top: 0; color: #0ff;">VR Instructions</h3>
        <p><b>On Quest or other VR device:</b></p>
        <ol style="padding-left: 20px;">
            <li>Click the "ENTER VR" button on screen</li>
            <li>Put on your headset</li>
            <li>Use controller triggers for acceleration</li>
            <li>Controller thumbsticks to steer</li>
        </ol>
        <p><b>Testing on local network:</b></p>
        <ol style="padding-left: 20px;">
            <li>Make sure computer and Quest are on the same WiFi</li>
            <li>Find your computer's local IP address</li>
            <li>On Quest browser, go to: http://[your-ip]:5173</li>
        </ol>
        <button id="close-vr-instructions" style="
            background: #0ff;
            color: black;
            border: none;
            padding: 8px 15px;
            border-radius: 4px;
            cursor: pointer;
            margin-top: 10px;
        ">Close</button>
    `;

    // Add event listeners
    vrStatusIndicator.addEventListener('click', () => {
        const instructionsEl = document.getElementById('vr-instructions');
        if (instructionsEl) {
            instructionsEl.style.display = instructionsEl.style.display === 'none' ? 'block' : 'none';
        }
    });

    // Assembly
    vrStatusIndicator.appendChild(vrIcon);
    vrStatusIndicator.appendChild(vrStatusText);
    vrStatusContainer.appendChild(vrStatusIndicator);
    vrStatusContainer.appendChild(vrInstructions);
    
    document.body.appendChild(vrStatusContainer);
    
    // Initial check
    updateVRStatus();
    
    // Add close button functionality
    document.getElementById('close-vr-instructions').addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('vr-instructions').style.display = 'none';
    });
    
    return vrStatusContainer;
}

// Update VR status function (call this when needed)
export function updateVRStatus() {
    const statusText = document.getElementById('vr-status-text');
    const statusIcon = document.getElementById('vr-status-indicator')?.querySelector('div');
    
    if (!statusText || !statusIcon) return;
    
    // Debug info to console
    console.log("Checking WebXR support...");
    console.log("navigator.xr available:", !!navigator.xr);
    
    // Update XR debug panel if available
    if (typeof window.updateXRDebugInfo === 'function') {
        window.updateXRDebugInfo();
    }
    
    // Check for Quest browser specifically
    const isQuestBrowser = 
        navigator.userAgent.includes('Quest') || 
        navigator.userAgent.includes('Oculus') ||
        // Sometimes Meta Quest doesn't identify itself in user agent
        (navigator.userAgent.includes('Mobile VR') && navigator.userAgent.includes('Android'));
    
    if (isQuestBrowser) {
        console.log("Meta Quest browser detected!");
        
        // Force VR Ready status for Quest browsers, even without navigator.xr
        if (window.isInXRSession) {
            statusText.textContent = 'VR Active (Quest)';
            statusText.style.color = '#0ff'; // Cyan
            statusIcon.style.borderColor = '#0ff';
        } else {
            statusText.textContent = 'VR Ready (Quest)';
            statusText.style.color = '#0f0'; // Green
            statusIcon.style.borderColor = '#0f0';
        }
        return;
    }
    
    if (navigator.xr) {
        // Add debug information
        console.log("Using isSessionSupported to check VR compatibility");
        
        // Queue multiple session type checks for the most comprehensive detection
        Promise.all([
            // Primary check for fully immersive VR
            navigator.xr.isSessionSupported('immersive-vr')
                .then(supported => {
                    console.log("immersive-vr support:", supported);
                    return { type: 'immersive-vr', supported };
                })
                .catch(err => {
                    console.error("Error checking immersive-vr support:", err);
                    return { type: 'immersive-vr', supported: false, error: err };
                }),
                
            // Some browsers implement this for AR
            navigator.xr.isSessionSupported('immersive-ar')
                .then(supported => {
                    console.log("immersive-ar support:", supported);
                    return { type: 'immersive-ar', supported };
                })
                .catch(err => {
                    console.error("Error checking immersive-ar support:", err);
                    return { type: 'immersive-ar', supported: false, error: err };
                })
        ])
        .then(results => {
            // Get the primary VR support check
            const immersiveVR = results.find(r => r.type === 'immersive-vr');
            
            // If we detected Quest browser, be more optimistic about support
            if (isQuestBrowser) {
                statusText.textContent = 'VR Ready (Quest)';
                statusText.style.color = '#0f0'; // Green
                statusIcon.style.borderColor = '#0f0';
                
                if (window.isInXRSession) {
                    statusText.textContent = 'VR Active';
                    statusText.style.color = '#0ff'; // Cyan
                    statusIcon.style.borderColor = '#0ff';
                }
                return;
            }
            
            // Use standard detection logic
            if (immersiveVR && immersiveVR.supported) {
                statusText.textContent = 'VR Ready';
                statusText.style.color = '#0f0'; // Green
                statusIcon.style.borderColor = '#0f0';
                
                // Check if we're in an XR session
                if (window.isInXRSession) {
                    statusText.textContent = 'VR Active';
                    statusText.style.color = '#0ff'; // Cyan
                    statusIcon.style.borderColor = '#0ff';
                }
            } else {
                // If any XR capability is detected but not full VR, show limited
                const anyXRSupport = results.some(r => r.supported);
                
                if (anyXRSupport) {
                    statusText.textContent = 'VR Supported (Limited)';
                    statusText.style.color = '#ff0'; // Yellow
                    statusIcon.style.borderColor = '#ff0';
                } else {
                    statusText.textContent = 'VR Not Supported';
                    statusText.style.color = '#f00'; // Red
                    statusIcon.style.borderColor = '#f00';
                }
            }
        });
    } else {
        statusText.textContent = 'VR Not Supported';
        statusText.style.color = '#f00'; // Red
        statusIcon.style.borderColor = '#f00';
        console.log("WebXR API not available in this browser");
    }
}

