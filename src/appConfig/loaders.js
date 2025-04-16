// Assets and textures loading manager

import * as THREE from 'three';
import config from './config.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getTexture } from './textureRegistry.js';
import { getModel } from './modelRegistry.js'; // Import model registry helper

// Initialize THREE.js loading managers to track progress
let loadingManager = new THREE.LoadingManager();
let textureLoadingManager = new THREE.LoadingManager();
// Create GLTF loader instance outside the function
const gltfLoader = new GLTFLoader(loadingManager);
// Texture loader for registry
const registryTextureLoader = new THREE.TextureLoader(textureLoadingManager);

// Store loading stats
const loadingStats = {
    assets: { loaded: 0, total: 0 },
    textures: { loaded: 0, total: 0 },
    // Track individual assets by name (using category/name format)
    individualAssets: {}
};

// --- New Asset Tracking Functions ---

// Register an asset when its load is requested
function registerAsset(type, name) {
    if (!name || name.toLowerCase().includes('subtexture')) return; // Skip subtextures immediately

    if (!loadingStats.individualAssets[name]) {
        console.log(`Registering asset: [${type}] ${name}`);
        loadingStats.individualAssets[name] = {
            type,
            loaded: false,
            error: false
        };
        // Update the display when a new asset starts loading
        updateDetailedAssetDisplay();
    }
}

// Update the status of a registered asset
function trackAssetStatusUpdate(type, name, loaded = false, error = false) {
    if (!name || name.toLowerCase().includes('subtexture')) return; // Ensure subtextures don't update status

    if (loadingStats.individualAssets[name]) {
        // Only log significant changes
        const changed = loadingStats.individualAssets[name].loaded !== loaded || loadingStats.individualAssets[name].error !== error;
        
        loadingStats.individualAssets[name].loaded = loaded;
        loadingStats.individualAssets[name].error = error;

        if (changed) {
             console.log(`Asset status update: [${type}] ${name} - Loaded: ${loaded}, Error: ${error}`);
            // Update the display on status change
            updateDetailedAssetDisplay();
        }
    } else {
        // This shouldn't happen if registerAsset is called first, but log if it does
         console.warn(`Attempted to update status for unregistered asset: [${type}] ${name}`);
    }
}

// --- Simplified Loading Manager Handlers ---
// These primarily handle overall progress if needed, but individual tracking is now separate.
function setupLoadingManagerHandlers() {
    loadingManager.onLoad = function() {
        console.log('Main Loading Manager: All models loaded.');
        // Optionally update overall asset count display here if needed
        // updateAssetDisplay(...);
    };

    loadingManager.onError = function(url) {
        console.error('Main Loading Manager: Error loading asset at URL:', url);
        // Generic error handling - specific asset errors are tracked via wrapped callbacks
    };

    textureLoadingManager.onLoad = function() {
         console.log('Texture Loading Manager: All textures loaded.');
        // Optionally update overall texture count display here if needed
        // updateAssetDisplay(...);
    };

    textureLoadingManager.onError = function(url) {
        console.error('Texture Loading Manager: Error loading texture at URL:', url);
         // Generic error handling - specific texture errors are tracked via wrapped callbacks
    };
    
    // onStart and onProgress can be kept simple or removed if not needed for overall counters
    loadingManager.onProgress = function(url, itemsLoaded, itemsTotal) {
        loadingStats.assets.loaded = itemsLoaded;
        loadingStats.assets.total = itemsTotal;
        // Optionally update overall summary display
    };
    
    textureLoadingManager.onProgress = function(url, itemsLoaded, itemsTotal) {
         loadingStats.textures.loaded = itemsLoaded;
         loadingStats.textures.total = itemsTotal;
         // Optionally update overall summary display
    };
}

// --- Asset Name Helper (Keep for reference or potential future use) ---
function getAssetNameFromUrl(url) {
    // (Existing implementation - may not be needed for primary tracking now)
    // ...
    // Let's simplify this as it's less critical now
     if (!url) return 'unknown_asset';
     const urlParts = url.split('/');
     let fileName = urlParts[urlParts.length - 1];
     // Basic cleanup
     fileName = fileName.split('?')[0]; // Remove query params
     fileName = fileName.replace(/\.[a-f0-9]{8,}\./, '.'); // Remove Vite hashes like .a1b2c3d4.
     return fileName;
}

// Initial setup of handlers
setupLoadingManagerHandlers();

// --- Updated Asset Loaders ---

// Standard texture loader using explicit imports
function loadTexture(category, name, onLoad, onProgress, onError) { // Add onProgress/onError
    const texturePath = getTexture(category, name);
    const assetIdentifier = `${category}/${name}`; // Use category/name as unique ID

    if (!texturePath) {
        console.error(`Texture not found in registry: ${assetIdentifier}`);
        if (onError) onError(new Error(`Texture not found: ${assetIdentifier}`));
        trackAssetStatusUpdate('texture', assetIdentifier, false, true); // Track error
        return new THREE.Texture(); // Return empty texture
    }

    console.log(`Requesting texture load: ${assetIdentifier}`);
    registerAsset('texture', assetIdentifier); // Register asset before loading

    // Wrap callbacks
    const wrappedOnLoad = (texture) => {
        console.log(`Texture loaded successfully: ${assetIdentifier}`);
        trackAssetStatusUpdate('texture', assetIdentifier, true, false); // Mark as loaded
        if (onLoad) onLoad(texture); // Call original callback
    };

    const wrappedOnError = (errorEvent) => {
        console.error(`Error loading texture: ${assetIdentifier}`, errorEvent);
        trackAssetStatusUpdate('texture', assetIdentifier, false, true); // Mark error
        if (onError) onError(errorEvent); // Call original callback
    };

    // Use the specific loader instance
    const threeTexture = registryTextureLoader.load(
        texturePath,
        wrappedOnLoad,
        onProgress, // Pass through onProgress directly for now
        wrappedOnError
    );

    return threeTexture;
}


// Standard model loader using explicit imports
function loadModelFromRegistry(category, name, onSuccess, onProgress, onError) {
    const modelPath = getModel(category, name);
    const assetIdentifier = `${category}/${name}`; // Use category/name as unique ID

    if (!modelPath) {
        console.error(`Model not found in registry: ${assetIdentifier}`);
        if (onError) onError(new Error(`Model not found: ${assetIdentifier}`));
        trackAssetStatusUpdate('model', assetIdentifier, false, true); // Track error
        return;
    }

    console.log(`Requesting model load: ${assetIdentifier} from ${modelPath}`);
    registerAsset('model', assetIdentifier); // Register asset before loading

    // Wrap callbacks
    const wrappedOnSuccess = (gltf) => {
         console.log(`Model loaded successfully: ${assetIdentifier}`);
        trackAssetStatusUpdate('model', assetIdentifier, true, false); // Mark as loaded
        if (onSuccess) onSuccess(gltf); // Call original callback
    };

    const wrappedOnError = (errorEvent) => {
        console.error(`Error loading model: ${assetIdentifier}`, errorEvent);
        trackAssetStatusUpdate('model', assetIdentifier, false, true); // Mark error
        if (onError) onError(errorEvent); // Call original callback
    };

    gltfLoader.load(
        modelPath,
        wrappedOnSuccess,
        onProgress, // Pass through onProgress directly
        wrappedOnError
    );
}

// General model loading function (OLD - Deprecated)
function modelLoader(modelName, onSuccess, onProgress, onError) {
    console.error("Deprecated modelLoader called for:", modelName, " - Use loadModelFromRegistry instead.");
    if (onError) onError(new Error("Deprecated modelLoader function used."));
    // Old path guessing logic removed
}

// Create an enhanced texture loader that tries multiple paths (OLD - Deprecated)
function createEnhancedTextureLoader(config) {
     console.error("Deprecated createEnhancedTextureLoader called - Use loadTexture instead.");
     // Return the basic registry loader as a fallback
     return registryTextureLoader;
}

// --- STATS / DISPLAY ---

// Function to reset loading stats when changing scenes
function resetLoadingStats() {
    console.log("🔄 Resetting loading stats for new scene...");
    
    // Stop any ongoing loads managed by the old managers? (Potentially complex/risky)
    // For now, just reset tracking data. New managers aren't needed per scene with this model.

    // Reset counters and tracking
    loadingStats.assets.loaded = 0;
    loadingStats.assets.total = 0; // These might become less relevant
    loadingStats.textures.loaded = 0;
    loadingStats.textures.total = 0;
    loadingStats.individualAssets = {}; // Clear individual asset tracking

    // Update the display with reset values
    // updateAssetDisplay(0, 0, 'assets'); // Keep summary display? Maybe hide it.
    // updateAssetDisplay(0, 0, 'textures');
    updateDetailedAssetDisplay(); // Clear the detailed display

    console.log("✅ Loading stats reset complete.");
}

// Function to update the overall asset display (Summary - consider removing/hiding)
function updateAssetDisplay(loaded, total, type) {
     // This function might be less useful now with the detailed display.
     // We can choose to hide the summary element in main.js or keep it updated.
     // For now, let's keep it updating based on LoadingManagers progress.
    
    if (type === 'assets') {
        loadingStats.assets.loaded = loaded;
        loadingStats.assets.total = total;
    } else if (type === 'textures') {
        loadingStats.textures.loaded = loaded;
        loadingStats.textures.total = total;
    }
    
    const assetDisplay = document.getElementById('asset-display');
    if (!assetDisplay) return;
    
    // Update the summary display
    assetDisplay.innerHTML = `Assets: ${loadingStats.assets.loaded}/${loadingStats.assets.total}<br>` +
                           `Textures: ${loadingStats.textures.loaded}/${loadingStats.textures.total}`;

    // Update color based on overall completion from LoadingManagers
    const assetsComplete = loadingStats.assets.loaded >= loadingStats.assets.total;
    const texturesComplete = loadingStats.textures.loaded >= loadingStats.textures.total;

    if (assetsComplete && texturesComplete) {
        assetDisplay.style.color = '#0f0'; // Green
    } else if (loadingStats.assets.loaded > 0 || loadingStats.textures.loaded > 0) {
        assetDisplay.style.color = '#ff0'; // Yellow
    } else {
        assetDisplay.style.color = '#fff'; // White default
    }
}

// Function to update the detailed asset display
function updateDetailedAssetDisplay() {
    let detailedAssetDisplay = document.getElementById('detailed-asset-display');
    
    if (!detailedAssetDisplay) {
        detailedAssetDisplay = document.createElement('div');
        detailedAssetDisplay.id = 'detailed-asset-display';
        detailedAssetDisplay.style.cssText = 'position:absolute;bottom:10px;right:10px;background:rgba(0,0,0,0.7);color:#fff;font-family:monospace;font-size:14px;font-weight:bold;padding:10px;border-radius:5px;z-index:10000;text-align:right;max-height:50vh;overflow-y:auto;max-width:40vw;';
        document.body.appendChild(detailedAssetDisplay);
    }
    
    detailedAssetDisplay.style.display = 'block'; // Keep visible
    
    const assetEntries = Object.entries(loadingStats.individualAssets);
        // Note: Subtexture filtering now happens in registerAsset and trackAssetStatusUpdate

    const textureCount = assetEntries.filter(([_, info]) => info.type === 'texture').length;
    const modelCount = assetEntries.filter(([_, info]) => info.type === 'model').length;
    const totalTracked = textureCount + modelCount;

    if (totalTracked === 0) {
        detailedAssetDisplay.innerHTML = '<div style="text-align:center;">Initializing...</div>';
        return;
    }
    
    let html = `<div style="text-align:center;margin-bottom:5px;font-size:16px;border-bottom:1px solid #555;padding-bottom:3px;">Loading Assets (${totalTracked})</div>`;
    
    assetEntries.sort((a, b) => {
        if (a[1].type !== b[1].type) {
            return a[1].type === 'texture' ? -1 : 1;
        }
        return a[0].localeCompare(b[0]); // Sort by name 'category/name'
    });
    
    const byType = { texture: [], model: [] };
    assetEntries.forEach(([name, info]) => {
        byType[info.type]?.push([name, info]);
    });
    
    if (byType.texture.length > 0) {
        html += `<div style="margin-top:5px;font-size:15px;color:#aaa;">Textures (${byType.texture.length}):</div>`;
        byType.texture.forEach(([name, info]) => {
            const displayName = name.split('/').pop(); // Show only the final name part
            const color = info.error ? '#f55' : (info.loaded ? '#5f5' : '#fff');
            const icon = info.error ? '❌' : (info.loaded ? '✓' : '⋯');
            html += `<div style="color:${color};margin:2px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${name}">${icon} ${displayName}</div>`;
        });
    }
    
    if (byType.model.length > 0) {
        html += `<div style="margin-top:8px;font-size:15px;color:#aaa;">Models (${byType.model.length}):</div>`;
        byType.model.forEach(([name, info]) => {
            const displayName = name.split('/').pop(); // Show only the final name part
            const color = info.error ? '#f55' : (info.loaded ? '#5f5' : '#fff');
            const icon = info.error ? '❌' : (info.loaded ? '✓' : '⋯');
            html += `<div style="color:${color};margin:2px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${name}">${icon} ${displayName}</div>`;
        });
    }
    
    detailedAssetDisplay.innerHTML = html;
}

// Export the necessary functions
export { 
    loadingManager, // Keep exporting managers if used elsewhere (e.g., progress bar)
    textureLoadingManager, 
    loadTexture, 
    loadModelFromRegistry, 
    resetLoadingStats,
    // Potentially hide or remove these if they are no longer the primary interface:
    updateAssetDisplay, // Summary display updater
    updateDetailedAssetDisplay // Might be called externally? Unlikely.
    // Deprecated: modelLoader, createEnhancedTextureLoader
    // Internal helpers not needed externally: getAssetNameFromUrl, trackAsset, registerAsset, trackAssetStatusUpdate
};