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

// Store loading stats
// const loadingStats = {
//     assets: { loaded: 0, total: 0 },
//     textures: { loaded: 0, total: 0 }
// };

// New structure to track individual asset status
let loadingAssetStatus = {}; // { assetName: 'loading' | 'loaded' }

// Function to notify main.js about status updates
let onAssetStatusUpdateCallback = () => {};
export function setAssetStatusUpdateCallback(callback) {
    onAssetStatusUpdateCallback = callback;
}

// Helper to update status and notify
function updateAssetStatus(name, status) {
    loadingAssetStatus[name] = status;
    onAssetStatusUpdateCallback(loadingAssetStatus);
}

// Set up onProgress handlers for the loading managers (Less useful now)
function setupLoadingManagerHandlers() {
    // loadingManager.onProgress = function(url, itemsLoaded, itemsTotal) {
    //     // updateAssetDisplay(itemsLoaded, itemsTotal, 'assets');
    // };
    // loadingManager.onLoad = function() {
    //     console.log('Main loading manager complete.');
    // };
    
    // textureLoadingManager.onProgress = function(url, itemsLoaded, itemsTotal) {
    //     // updateAssetDisplay(itemsLoaded, itemsTotal, 'textures');
    // };
    // textureLoadingManager.onLoad = function() {
    //     console.log('Texture loading manager complete.');
    // };
}

// Initial setup of handlers
setupLoadingManagerHandlers();


///// ASSET LOADERS /////

// Standard texture loader using explicit imports
export function loadTexture(category, name, onLoad) {
    const assetName = `Texture: ${category}/${name}`;
    const texturePath = getTexture(category, name);
    
    if (!texturePath) {
        console.error(`Texture not found: ${category}/${name}`);
        updateAssetStatus(assetName, 'error'); // Mark as error
        return new THREE.Texture(); // Return empty texture
    }
    
    console.log(`Loading texture: ${category}/${name} from registry`);
    updateAssetStatus(assetName, 'loading');
    
    // Use the THREE.TextureLoader directly for imported URLs
    const threeTexture = new THREE.TextureLoader(textureLoadingManager).load(
        texturePath, 
        (loadedTexture) => { // Wrap onLoad to update status
            updateAssetStatus(assetName, 'loaded');
            if (onLoad) onLoad(loadedTexture); // Call original onLoad if provided
        },
        undefined, // onProgress - not easily trackable per asset here
        (error) => { // onError
             console.error(`Error loading texture ${assetName}:`, error);
             updateAssetStatus(assetName, 'error');
        }
    );
    
    return threeTexture;
}

// Standard model loader using explicit imports
export function loadModelFromRegistry(category, name, onSuccess, onProgress, onError) {
    const assetName = `Model: ${category}/${name}`;
    const modelPath = getModel(category, name);

    if (!modelPath) {
        console.error(`Model not found in registry: ${category}/${name}`);
        updateAssetStatus(assetName, 'error');
        if (onError) onError(new Error(`Model not found in registry: ${category}/${name}`));
        return;
    }

    console.log(`Loading model from registry: ${category}/${name} from ${modelPath}`);
    updateAssetStatus(assetName, 'loading');
    
    gltfLoader.load(
        modelPath, 
        (gltf) => { // Wrap onSuccess
            updateAssetStatus(assetName, 'loaded');
            if (onSuccess) onSuccess(gltf);
        }, 
        onProgress, // Keep original onProgress
        (error) => { // Wrap onError
            console.error(`Error loading model ${assetName}:`, error);
            updateAssetStatus(assetName, 'error');
            if (onError) onError(error);
        }
    );
}

// General model loading function (OLD - Keep for compatibility during transition)
export function modelLoader(modelName, onSuccess, onProgress, onError) {
    console.warn("Using OLD modelLoader with path guessing for:", modelName);
    const assetName = `Model (Old): ${modelName}`;
    updateAssetStatus(assetName, 'loading'); // Track old loads too
    
    // Function to wrap callbacks
    const wrapSuccess = (gltf) => {
        updateAssetStatus(assetName, 'loaded');
        if (onSuccess) onSuccess(gltf);
    };
    const wrapError = (error) => {
        console.error(`Error loading model (Old) ${assetName}:`, error);
        updateAssetStatus(assetName, 'error');
        if (onError) onError(error);
    };
    const wrapFinalError = (error) => {
        console.error(`Final Error loading model (Old) ${assetName}:`, error);
        updateAssetStatus(assetName, 'error');
        if (onError) onError(error); 
    }

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
            wrapFinalError(new Error(`Failed to load ${modelName} after trying all paths`));
            return;
        }
        
        const path = paths[index];
        console.log(`Trying path ${index+1} for ${modelName}: ${path}`);
        
        gltfLoader.load(
            path,
            wrapSuccess, // Use wrapped success
            onProgress,
            (error) => {
                console.warn(`Path ${index+1} failed for ${modelName} (${path}):`, error);
                // Don't mark as error yet, just try next path
                tryLoadModelPath(index + 1);
            }
        );
    }

    tryLoadModelPath(0);
}

// createEnhancedTextureLoader (OLD - Keep for compatibility, but needs updating if used)
function createEnhancedTextureLoader(config) {
    console.warn("Using OLD createEnhancedTextureLoader");
    const textureLoader = new THREE.TextureLoader(textureLoadingManager);
    const originalLoadMethod = textureLoader.load;

    textureLoader.load = function(path, onLoad, onProgress, onError) {
        const assetName = `Texture (Old): ${path.split('/').pop()}`;
        updateAssetStatus(assetName, 'loading');

        const wrapLoad = (loadedTexture) => {
            updateAssetStatus(assetName, 'loaded');
            if (onLoad) onLoad(loadedTexture);
        };
        const wrapError = (error) => {
             console.error(`Error loading texture (Old) ${assetName}:`, error);
             updateAssetStatus(assetName, 'error');
             if (onError) onError(error);
        };

        return originalLoadMethod.call(this, path, wrapLoad, onProgress, (error) => {
            console.warn(`Failed texture (Old) primary path: ${path}`, error);
            // ... (existing fallback logic, calling wrapLoad/wrapError on alternatives) ...
            // Ensure wrapError is called if all fallbacks fail
        });
    };
    return textureLoader;
}


///// STATS / DISPLAY /////

// Function to reset loading stats when changing scenes
function resetLoadingStats() {
    // Reset individual asset tracking
    loadingAssetStatus = {};
    onAssetStatusUpdateCallback(loadingAssetStatus); // Notify UI to clear
    
    console.log("Loading asset status reset for new scene");
    
    // Recreate managers if needed, or just ensure they are clean
    // loadingManager = new THREE.LoadingManager();
    // textureLoadingManager = new THREE.LoadingManager();
    // setupLoadingManagerHandlers();
}

// OLD updateAssetDisplay function (no longer used by registry loaders)
function updateAssetDisplay(loaded, total, type) {
     console.warn("OLD updateAssetDisplay called - should migrate away");
    // ... (keep existing code for now) ...
}

// Export the loading managers and functions for use in other modules
export { loadingManager, textureLoadingManager, setAssetStatusUpdateCallback, loadTexture, loadModelFromRegistry, modelLoader, createEnhancedTextureLoader, updateAssetDisplay, resetLoadingStats }; 