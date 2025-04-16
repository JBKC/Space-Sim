// Assets and textures loading manager

import * as THREE from 'three';

// Initialize THREE.js loading managers to track progress
let loadingManager = new THREE.LoadingManager();
let textureLoadingManager = new THREE.LoadingManager();

// Store loading stats
const loadingStats = {
    assets: { loaded: 0, total: 0 },
    textures: { loaded: 0, total: 0 }
};

// Set up onProgress handlers for the loading managers
function setupLoadingManagerHandlers() {
    loadingManager.onProgress = function(url, itemsLoaded, itemsTotal) {
        updateAssetDisplay(itemsLoaded, itemsTotal, 'assets');
    };
    
    textureLoadingManager.onProgress = function(url, itemsLoaded, itemsTotal) {
        updateAssetDisplay(itemsLoaded, itemsTotal, 'textures');
    };
}

// Initial setup of handlers
setupLoadingManagerHandlers();

// Create an enhanced texture loader that tries multiple paths
function createEnhancedTextureLoader(config) {
    const textureLoader = new THREE.TextureLoader(textureLoadingManager);
    
    // Override the load method to try multiple paths
    const originalLoadMethod = textureLoader.load;
    
    textureLoader.load = function(path, onLoad, onProgress, onError) {
        console.log(`Attempting to load texture: ${path}`);
        
        // If the path looks like it's using config.textures, try to extract the texture name
        let textureName = path;
        let isFromTexturesPath = false;
        let isFromSkyboxPath = false;
        
        if (typeof path === 'string') {
            if (path.includes(config?.textures?.path)) {
                isFromTexturesPath = true;
                textureName = path.split('/').pop();
            } else if (path.includes(config?.textures?.skybox)) {
                isFromSkyboxPath = true;
                textureName = path.split('/').pop();
            }
        }
        
        // Try the original path first
        return originalLoadMethod.call(
            this, 
            path,
            onLoad,
            onProgress,
            // On error, try alternative paths
            (error) => {
                console.error(`Failed to load texture from primary path: ${path}`, error);
                
                // Generate alternative paths to try
                const alternativePaths = [];
                
                if (isFromTexturesPath) {
                    alternativePaths.push(
                        `src/assets/textures/${textureName}`,
                        `/src/assets/textures/${textureName}`,
                        `/assets/textures/${textureName}`,
                        `assets/textures/${textureName}`,
                        `textures/${textureName}`
                    );
                } else if (isFromSkyboxPath) {
                    alternativePaths.push(
                        `src/assets/textures/skybox/${textureName}`,
                        `/src/assets/textures/skybox/${textureName}`,
                        `/assets/textures/skybox/${textureName}`,
                        `assets/textures/skybox/${textureName}`,
                        `textures/skybox/${textureName}`
                    );
                }
                
                console.log(`Trying ${alternativePaths.length} alternative paths for texture: ${textureName}`);
                
                // Try alternative paths recursively
                tryNextPath(0);
                
                function tryNextPath(index) {
                    if (index >= alternativePaths.length) {
                        console.error(`All paths failed for texture: ${textureName}`);
                        if (onError) onError(new Error(`Failed to load texture after trying all paths: ${textureName}`));
                        return;
                    }
                    
                    const altPath = alternativePaths[index];
                    console.log(`Trying alternative path ${index+1} for texture: ${altPath}`);
                    
                    originalLoadMethod.call(
                        textureLoader,
                        altPath,
                        onLoad,
                        onProgress,
                        (altError) => {
                            console.error(`Alternative path ${index+1} failed for texture: ${altPath}`, altError);
                            tryNextPath(index + 1);
                        }
                    );
                }
            }
        );
    };
    
    return textureLoader;
}

// Function to reset loading stats when changing scenes
function resetLoadingStats() {
    // Create brand new loading managers for the new scene
    loadingManager = new THREE.LoadingManager();
    textureLoadingManager = new THREE.LoadingManager();
    
    // Set up the event handlers for the new managers
    setupLoadingManagerHandlers();

    // Reset all counters to zero
    loadingStats.assets.loaded = 0;
    loadingStats.assets.total = 0;
    loadingStats.textures.loaded = 0;
    loadingStats.textures.total = 0;
    
    // Update the display with reset values
    updateAssetDisplay(0, 0, 'assets');
    updateAssetDisplay(0, 0, 'textures');
    
    console.log("Loading stats reset for new scene - created new loading managers");
}

// Function to update the asset display
function updateAssetDisplay(loaded, total, type) {
    // Update the appropriate counter
    if (type === 'assets') {
        loadingStats.assets.loaded = loaded;
        loadingStats.assets.total = total;
    } else if (type === 'textures') {
        loadingStats.textures.loaded = loaded;
        loadingStats.textures.total = total;
    }
    
    // Get the asset display element
    const assetDisplay = document.getElementById('asset-display');
    if (!assetDisplay) return;
    
    // Update the display
    assetDisplay.innerHTML = `Assets: ${loadingStats.assets.loaded}/${loadingStats.assets.total}<br>` +
                           `Textures: ${loadingStats.textures.loaded}/${loadingStats.textures.total}`;
    
    // Set color based on completion
    const assetsComplete = loadingStats.assets.loaded === loadingStats.assets.total;
    const texturesComplete = loadingStats.textures.loaded === loadingStats.textures.total;
    
    if (assetsComplete && texturesComplete) {
        assetDisplay.style.color = '#0f0'; // Green when everything is loaded
    } else if (loadingStats.assets.loaded > 0 || loadingStats.textures.loaded > 0) {
        assetDisplay.style.color = '#ff0'; // Yellow during loading
    } else {
        assetDisplay.style.color = '#0fa'; // Default teal
    }
}

// Export the loading managers and functions for use in other modules
export { loadingManager, textureLoadingManager, createEnhancedTextureLoader, updateAssetDisplay, resetLoadingStats }; 