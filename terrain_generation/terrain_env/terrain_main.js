// Main setup imports
import { 
  init,
  update,
  renderer,
  scene,
  camera,
  spacecraft,
  renderScene
} from './terrain_setup.js';

// Function to ensure wings are open at startup
function initializeWingsOpen() {
  // Check every 500ms for 5 seconds to ensure spacecraft is fully loaded
  let attempts = 0;
  const maxAttempts = 10;
  
  const checkAndSetWings = function() {
      if (spacecraft && spacecraft.setWingsOpen) {
          console.log("🔄 STARTUP: Setting wings to OPEN position in main.js");
          spacecraft.setWingsOpen(true);
          return true;
      } else {
          console.log(`Waiting for spacecraft to initialize (attempt ${attempts+1}/${maxAttempts})`);
          attempts++;
          if (attempts < maxAttempts) {
              setTimeout(checkAndSetWings, 500);
          }
          return false;
      }
  };
  
  // Start the check process
  setTimeout(checkAndSetWings, 500);
}

// Add a global function to directly toggle wings for debugging
window.toggleWings = function() {
  if (spacecraft && spacecraft.toggleWings) {
      console.log("Manually toggling wings via global function");
      const result = spacecraft.toggleWings();
      console.log(result);
      return result;
  } else {
      console.error("spacecraft.toggleWings function not available");
      return "Error: Wings cannot be toggled";
  }
};

// Add a global function to directly set wing position for debugging
window.setWingsPosition = function(position) {
  if (spacecraft && spacecraft.setWingsPosition) {
      console.log(`Manually setting wing position to ${position} via global function`);
      const result = spacecraft.setWingsPosition(position);
      console.log(result);
      return result;
  } else {
      console.error("spacecraft.setWingsPosition function not available");
      return "Error: Wings position cannot be set";
  }
};

// Add a global function to animate wings for testing (animates from closed to open or vice versa)
window.animateWings = function(duration = 500) {
  if (!spacecraft) {
      console.error("spacecraft not available");
      return "Error: Wings cannot be animated";
  }
  
  if (spacecraft.setWingsOpen) {
      // Get current state
      const isCurrentlyOpen = spacecraft._spacecraftComponents?.animationState === 'open';
      
      // Toggle to opposite state - setWingsOpen now has smooth animations built-in
      console.log(`Animating wings from ${isCurrentlyOpen ? 'open' : 'closed'} to ${isCurrentlyOpen ? 'closed' : 'open'}`);
      spacecraft.setWingsOpen(!isCurrentlyOpen);
      
      return `Wings animating to ${isCurrentlyOpen ? 'closed' : 'open'} position`;
  } else if (spacecraft.setWingsPosition) {
      // Fall back to the original implementation if setWingsOpen is not available
      const startTime = performance.now();
      const startPos = spacecraft._spacecraftComponents?.animationState === 'open' ? 1 : 0;
      const endPos = startPos > 0.5 ? 0 : 1;
      
      console.log(`Animating wings from ${startPos} to ${endPos} over ${duration}ms`);
      
      function animate(time) {
          const elapsed = time - startTime;
          const progress = Math.min(1, elapsed / duration);
          
          // Use an easing function for smoother animation
          const easedProgress = 0.5 - 0.5 * Math.cos(progress * Math.PI);
          const currentPos = startPos + (endPos - startPos) * easedProgress;
          
          spacecraft.setWingsPosition(currentPos);
          
          if (progress < 1) {
              requestAnimationFrame(animate);
          }
      }
      
      requestAnimationFrame(animate);
      return `Animating wings from ${startPos} to ${endPos}`;
  } else {
      console.error("No wing animation methods available");
      return "Error: Wings cannot be animated";
  }
};


// keyPress event listeners for controls
document.addEventListener('keyPress', (event) => {
  // Check if we're in the welcome screen (main menu)
  const welcomeScreen = document.getElementById('welcome-screen');
  const isInMainMenu = welcomeScreen && welcomeScreen.style.display !== 'none';
  
  // Skip handling most keys when in main menu except for game start (Enter key)
  if (isInMainMenu && event.key !== 'Enter') {
      return;
  }
  
  if (event.code === 'Space') {
      isSpacePressed = true;
      // Also update the keys object used by scenes
      if (spacecraft && spacecraft.userData) {
          spacecraft.userData.keys = spacecraft.userData.keys || {};
          spacecraft.userData.keys.space = true;
      }
  }
  if (event.code === 'ArrowUp') {
      isBoosting = true;
      console.log('Boost activated - speed should increase');
      
      // Visual indication for debug purposes
      const coordsDiv = document.getElementById('coordinates');
      if (coordsDiv) {
          coordsDiv.style.color = '#4fc3f7'; // Keep blue color consistent
      }
  }
  // Only allow hyperspace if not on Earth's surface and not in main menu
  if ((event.code === 'ShiftLeft' || event.code === 'ShiftRight') && !isEarthSurfaceActive && !isInMainMenu) {
      startHyperspace();
  }
  // Reset position in Earth surface mode
  if (event.code === 'KeyR' && isEarthSurfaceActive) {
      console.log('R pressed - resetting position in San Francisco');
      resetEarthPosition();
  }
  // Reset position in Moon surface mode
  if (event.code === 'KeyR' && isMoonSurfaceActive) {
      console.log('R pressed - resetting position on the Moon');
      resetMoonPosition();
  }
  // Toggle first-person/third-person view with 'C' key
  if (event.code === 'KeyC') {
      console.log('===== C KEY PRESSED - TOGGLE COCKPIT VIEW =====');
      console.log('Is on Earth surface:', isEarthSurfaceActive);
      console.log('Has spacecraft:', !!spacecraft);
      console.log('Has earth spacecraft:', !!earthSpacecraft);
      
      if (isEarthSurfaceActive && earthSpacecraft) {
          console.log('C pressed - toggling cockpit view in Earth scene');
          if (typeof earthSpacecraft.toggleView === 'function') {
              const result = earthSpacecraft.toggleView(earthCamera, (isFirstPerson) => {
                  // Reset camera state based on new view mode
                  console.log(`Resetting Earth camera state for ${isFirstPerson ? 'cockpit' : 'third-person'} view`);
                  console.log('Earth camera reset callback executed');
                  // If you have access to Earth's camera state, reset it here
              });
              console.log('Earth toggle view result:', result);
          } else {
              console.warn('Toggle view function not available on Earth spacecraft');
          }
      } else if (isMoonSurfaceActive && moonSpacecraft) {
          console.log('C pressed - toggling cockpit view in Moon scene');
          if (typeof moonSpacecraft.toggleView === 'function') {
              const result = moonSpacecraft.toggleView(moonCamera, (isFirstPerson) => {
                  // Reset camera state based on new view mode
                  console.log(`Resetting Moon camera state for ${isFirstPerson ? 'cockpit' : 'third-person'} view`);
                  console.log('Moon camera reset callback executed');
                  // If you have access to Moon's camera state, reset it here
              });
              console.log('Moon toggle view result:', result);
          } else {
              console.warn('Toggle view function not available on Moon spacecraft');
          }
      } else if (spacecraft) {
          console.log('C pressed - toggling cockpit view in Space scene');
          if (typeof spacecraft.toggleView === 'function') {
              const result = spacecraft.toggleView(spaceCamera, (isFirstPerson) => {
                  // Reset camera state based on new view mode
                  console.log(`Resetting space camera state for ${isFirstPerson ? 'cockpit' : 'third-person'} view`);
                  // Use the imported createCameraState function
                  const viewMode = isFirstPerson ? 'cockpit' : 'space';
                  
                  // Reset camera state with new view mode
                  spaceCamera.position.copy(spaceCamera.position);
                  spaceCamera.quaternion.copy(spaceCamera.quaternion);
              });
              console.log('Toggle view result:', result);
          } else {
              console.warn('Toggle view function not available on Space spacecraft');
          }
      }
  }
  // Enhanced ESC key to exit Moon surface or Earth surface
  if (event.code === 'Escape') {
      if (isMoonSurfaceActive) {
          console.log('ESC pressed - exiting Moon surface');
          exitMoonSurface();
          // Reset the first entry flag so next time we enter Moon, it's treated as a first entry
          isFirstMoonEntry = true;
      } else if (isEarthSurfaceActive) {
          console.log('ESC pressed - exiting Earth surface');
          exitEarthSurface();
          // Reset the first entry flag so next time we enter Earth, it's treated as a first entry
          isFirstEarthEntry = true;
      }
  }
});

// keyRelease event listeners for controls
document.addEventListener('keyRelease', (event) => {
  if (event.code === 'Space') {
      isSpacePressed = false;
      // Also update the keys object used by scenes
      if (spacecraft && spacecraft.userData) {
          spacecraft.userData.keys = spacecraft.userData.keys || {};
          spacecraft.userData.keys.space = false;
      }
  }
  if (event.code === 'ArrowUp') {
      isBoosting = false;
      console.log('Boost deactivated - speed should return to normal');
      
      // Reset visual indication
      const coordsDiv = document.getElementById('coordinates');
      if (coordsDiv) {
          coordsDiv.style.color = '#4fc3f7'; // Keep blue color consistent
      }
  }
});

// Start the game with the selected mode
function startGame(mode) {
  console.log('Starting game in mode:', mode);
  gameMode = mode;
  setGameMode(mode);
  const welcomeScreen = document.getElementById('welcome-screen');
  if (welcomeScreen) {
      welcomeScreen.style.display = 'none';
  }
  
  // Show coordinates when game starts
  const coordsDiv = document.getElementById('coordinates');
  if (coordsDiv) {
      coordsDiv.style.display = 'block';
  }
  
  // Show the stats displays now that we're in the game
  stats.dom.style.display = 'block';
  fpsDisplay.style.display = 'block';
  assetDisplay.style.display = 'block';
  
  // Show the controls prompt and initialize dropdown state
  showControlsPrompt();
  updateControlsDropdown(isEarthSurfaceActive, isMoonSurfaceActive);

  // Ensure wings are open at startup
  initializeWingsOpen();

  if (!isAnimating) {
      isAnimating = true;
      animate();
  }
}


// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});


// Main animation loop
function animate(currentTime = 0) {
  if (!isAnimating) {
      console.log("Animation stopped - isAnimating is false");
      return;
  }
  
  requestAnimationFrame(animate);
  
  // Begin stats measurement for this frame
  stats.begin();

  // Calculate delta time in seconds for smooth movement
  const deltaTime = (currentTime - lastFrameTime) / 1000;
  lastFrameTime = currentTime;
  

  try {
      // Handle laser firing when spacebar is pressed
      if (isSpacePressed) {
          // Get the current active scene and spacecraft
          let activeScene = scene;
          let activeSpacecraft = spacecraft;
          let sceneType = 'space';
          
          // Don't fire lasers if in space scene and hyperspace is active
          if (!(sceneType === 'space' && isHyperspace)) {
              // Get the key states
              const slowMode = document.querySelector('[data-key="ArrowDown"]')?.classList.contains('active') || false;
              // LASER FIRING DISABLED
              // fireLaser(activeSpacecraft, activeScene, sceneType, isBoosting, keys.down);
          }
      }
      

      // CASE 0 = terrain (planet surface) view
        // If we just exited a planet surface, make sure space container is visible
        const spaceContainer = document.getElementById('space-container');
        if (spaceContainer && spaceContainer.style.display === 'none') {
            spaceContainer.style.display = 'block';
            console.log('Restored space-container visibility');
        }
        
        // Fix for controls dropdown visibility - check if controls should be visible
        const controlsPrompt = document.getElementById('controls-prompt');
        const controlsDropdown = document.getElementById('controls-dropdown');
        if (controlsPrompt && controlsDropdown && controlsPrompt.textContent === 'Press Enter to hide controls') {
            controlsDropdown.style.display = 'block';
            controlsDropdown.style.zIndex = '10000'; // Ensure it's above everything else
            console.log('Force-restoring controls dropdown visibility');
        }

        try {
            // Initialize space scene if needed
            if (!spaceInitialized) {
                console.log('Initializing Outer Space');
                const spaceObjects = init();
                spaceInitialized = true;
                console.log('Space initialized successfully', spaceObjects);
            }
            
            // Main frame update function - pass isBoosting and isHyperspace values
            update(isBoosting, isHyperspace, deltaTime);
            
            // Update Moon's position relative to Earth using global coordinates
            updateMoonPosition();
            
            // Update hyperspace streaks if active
            if (isHyperspace) {
                updateStreaks();
                
                // Make doubly sure the hyperspace progress bar is visible during hyperspace
                const progressContainer = document.getElementById('hyperspace-progress-container');
                if (progressContainer && progressContainer.style.display !== 'block') {
                    console.log('Force-restoring hyperspace progress visibility during active hyperspace');
                    progressContainer.style.display = 'block';
                    progressContainer.style.zIndex = '10000';
                    progressContainer.style.opacity = '1';
                    progressContainer.style.visibility = 'visible';
                }
            }
            
            // Update coordinates display - only show in space mode
            const coordsDiv = document.getElementById('coordinates');
            if (coordsDiv) {
                if (spacecraft) {
                    // Format coordinates to 1 decimal place
                    coordsDiv.textContent = `X: ${spacecraft.position.x.toFixed(1)}, Y: ${spacecraft.position.y.toFixed(1)}, Z: ${spacecraft.position.z.toFixed(1)}`;
                    
                    // Console log the spacecraft global coordinates
                    // console.log(`Spacecraft Global Coordinates: X: ${spacecraft.position.x.toFixed(1)}, Y: ${spacecraft.position.y.toFixed(1)}, Z: ${spacecraft.position.z.toFixed(1)}`);
                }
                coordsDiv.style.display = 'block';
            }
            
            // Ensure exploration counter is visible in space view
            const explorationCounter = document.querySelector('.exploration-counter');
            if (explorationCounter) {
                explorationCounter.style.display = 'block';
            }
            
            // Render the scene
            renderScene();
        } catch (e) {
            console.error('Space animation error:', e);
        }
      


  } catch (e) {
      console.error('Main animation loop error:', e);
  }
  
  // End stats measurement for this frame
  stats.end();

}
