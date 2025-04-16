// Assets and textures loading manager

import * as THREE from 'three';
import config from './config.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getTexture } from './textureRegistry.js';
import { getModel } from './modelRegistry.js'; // Import model registry helper
// Import asset status manager functions
import { registerAsset, updateAssetStatus, resetAssetStatus } from './assetStatusManager.js';

// Initialize THREE.js loading managers to track progress
let loadingManager = new THREE.LoadingManager();
let textureLoadingManager = new THREE.LoadingManager();
// Create GLTF loader instance outside the function
const gltfLoader = new GLTFLoader(loadingManager);

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


///// ASSET LOADERS /////

// Standard texture loader using explicit imports
export function loadTexture(category, name, onLoad) {
    const texturePath = getTexture(category, name);
    const assetId = `texture:${category}/${name}`; // Unique ID for tracking
    const displayName = `${name} Texture`; // User-friendly name

    registerAsset(assetId, displayName);
    updateAssetStatus(assetId, 'loading');

    if (!texturePath) {
        console.error(`Texture not found: ${category}/${name}`);
        updateAssetStatus(assetId, 'error');
        return new THREE.Texture(); // Return empty texture
    }

    // Use a dedicated loader instance to avoid conflicts if multiple loads happen
    const loaderInstance = new THREE.TextureLoader(textureLoadingManager);

    const threeTexture = loaderInstance.load(
        texturePath,
        (loadedTexture) => {
            updateAssetStatus(assetId, 'loaded');
            if (onLoad) onLoad(loadedTexture);
        },
        undefined, // onProgress - TextureLoader doesn't support detailed progress
        (error) => {
            console.error(`Error loading texture ${assetId}:`, error);
            updateAssetStatus(assetId, 'error');
            // Don't call original onLoad on error
        }
    );

    return threeTexture;
}

// Standard model loader using explicit imports
export function loadModelFromRegistry(category, name, onSuccess, onProgress, onError) {
    const modelPath = getModel(category, name);
    const assetId = `model:${category}/${name}`; // Unique ID
    const displayName = `${name} Model`; // User-friendly name

    registerAsset(assetId, displayName);
    updateAssetStatus(assetId, 'loading');

    if (!modelPath) {
        console.error(`Model not found in registry: ${category}/${name}`);
        updateAssetStatus(assetId, 'error');
        if (onError) onError(new Error(`Model not found in registry: ${category}/${name}`));
        return;
    }

    gltfLoader.load(
        modelPath,
        (gltf) => {
            updateAssetStatus(assetId, 'loaded');
            if (onSuccess) onSuccess(gltf);
        },
        (xhr) => { // onProgress
            // Optional: Can update status to 'loading' with percentage here if needed
            // updateAssetStatus(assetId, 'loading'); 
            if (onProgress) onProgress(xhr);
        },
        (error) => {
            console.error(`Error loading model ${assetId}:`, error);
            updateAssetStatus(assetId, 'error');
            if (onError) onError(error);
        }
    );
}

// General model loading function (OLD - Keep for compatibility during transition)
function modelLoader(modelName, onSuccess, onProgress, onError) {
    console.warn("Using OLD modelLoader with path guessing for:", modelName);
    console.log(`Loading model: ${modelName}`);
    console.log('Current config paths:', {
        assets: config.ASSETS_PATH,
        models: config.models.path,
        env: config.ENV
    });
    
    // Define paths to try
    // NOTE - just because one path works in development doesn't mean it will work in production
    const paths = [

        // Spacecraft has different format (.glb directly without the scene.gltf) - ATTEMPT TO LOAD FIRST
        `${config.models.path}/${modelName}`,
        `src/assets/models/${modelName}`,
        `/src/assets/models/${modelName}`,
        `/assets/models/${modelName}`,
        `${modelName}`,

        // Other assets
        `src/assets/models/${modelName}/scene.gltf`,
        `${config.models.path}/${modelName}/scene.gltf`,
        `/src/assets/models/${modelName}/scene.gltf`,
        `/assets/models/${modelName}/scene.gltf`,
        `${modelName}/scene.gltf`,

    ];

    
    function tryLoadModelPath(index) {
        if (index >= paths.length) {
            console.error(`All paths failed for ${modelName}`);
            if (onError) onError(new Error(`Failed to load ${modelName} after trying all paths`));
            return;
        }
        
        const path = paths[index];
        console.log(`Trying path ${index+1} for ${modelName}: ${path}`);
        
        gltfLoader.load(
            path,
            onSuccess,
            onProgress,
            (error) => {
                console.warn(`Path ${index+1} failed for ${modelName} (${path}):`, error);
                // Try the next path
                tryLoadModelPath(index + 1);
            }
        );
    }

    // Iterate through paths
    tryLoadModelPath(0);
}

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
                console.warn(`Failed to load texture from primary path: ${path}`, error);
                
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
                            console.warn(`Alternative path ${index+1} failed for texture: ${altPath}`, altError);
                            tryNextPath(index + 1);
                        }
                    );
                }
            }
        );
    };
    
    return textureLoader;
}


///// STATS / DISPLAY /////


// Function to reset loading stats when changing scenes
function resetLoadingStats() {
    // Create brand new loading managers for the new scene
    loadingManager = new THREE.LoadingManager();
    textureLoadingManager = new THREE.LoadingManager();
    
    // Set up the event handlers for the new managers
    setupLoadingManagerHandlers();
    
    // Call the new asset status reset function
    resetAssetStatus(); // Reset the detailed asset tracker

    // Reset all counters to zero (keep for old display logic if needed)
    loadingStats.assets.loaded = 0;
    loadingStats.assets.total = 0;
    loadingStats.textures.loaded = 0;
    loadingStats.textures.total = 0;
    
    // Update the display with reset values (keep for old display logic if needed)
    // updateAssetDisplay(0, 0, 'assets');
    // updateAssetDisplay(0, 0, 'textures');
    
    console.log("Loading stats AND detailed asset status reset for new scene.");
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
export { 
    loadingManager, 
    textureLoadingManager, 
    createEnhancedTextureLoader, // Keep old texture loader for compatibility
    loadTexture, 
    loadModelFromRegistry, 
    modelLoader, // Keep old model loader for compatibility
    updateAssetDisplay, // Keep old display function for now
    resetLoadingStats, // Keep exporting this, it now calls resetAssetStatus
}; 