// Assets and textures loading manager

import * as THREE from 'three';
import config from './config.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { getTexture } from './textureRegistry.js';
import { getModel } from './modelRegistry.js'; // Import model registry helper

// Universal scaling factor for the entire solar system scene
export let universalScaleFactor = 1.0;

// Initialize THREE.js loading managers to track progress
let loadingManager = new THREE.LoadingManager();
let textureLoadingManager = new THREE.LoadingManager();

// Caches to avoid re-downloading + re-parsing assets when we stage loads.
// Keyed by `${category}:${name}`.
const modelPromiseCache = new Map();
const texturePromiseCache = new Map();

// Loader instances (recreated when managers reset)
let gltfLoader = createGLTFLoader();
let textureLoader = createTextureLoader();
let ktx2Loader = createKTX2Loader();

function createGLTFLoader() {
    const loader = new GLTFLoader(loadingManager);
    // Meshopt support (requires models to be meshopt-compressed; harmless otherwise)
    loader.setMeshoptDecoder(MeshoptDecoder);
    return loader;
}

function createTextureLoader() {
    return new THREE.TextureLoader(textureLoadingManager);
}

function createKTX2Loader() {
    const loader = new KTX2Loader(textureLoadingManager);
    // Transcoder files should live under /basis/ in production (copied in prebuild).
    loader.setTranscoderPath('/basis/');
    // WebGLRenderer is not available here; detectSupport() will be called once renderer exists.
    return loader;
}

// Call this once you have a renderer (e.g. in initSpace) to allow KTX2Loader to pick the right format.
export function configureTextureCompressionSupport(renderer) {
    if (!renderer) return;
    try {
        ktx2Loader.detectSupport(renderer);
    } catch (e) {
        console.warn('KTX2Loader detectSupport failed (texture compression will fallback):', e);
    }
}

// Store loading stats
const loadingStats = {
    assets: { loaded: 0, total: 0 },
    textures: { loaded: 0, total: 0 },
    // Track individual assets by name
    individualAssets: {}
};


///// ASSET LOADERS /////

// Standard texture loader using explicit imports (cached)
function loadTextureFromRegistry(category, name, onLoad) {
    const texturePath = getTexture(category, name);
    if (!texturePath) {
        console.error(`Texture not found: ${category}/${name}`);
        return new THREE.Texture(); // Return empty texture
    }

    // Kick off (or reuse) the cached async load, but return a Texture immediately for backwards compatibility.
    // If the caller passed onLoad, we invoke it once resolved.
    loadTextureFromRegistryAsync(category, name)
        .then((tex) => {
            if (typeof onLoad === 'function') onLoad(tex);
        })
        .catch((err) => console.error('Error loading texture:', err));

    // Return a placeholder texture immediately; most call sites only need a `Texture` reference.
    // Once the cached texture resolves, any materials referencing it will render correctly.
    const placeholder = new THREE.Texture();
    placeholder.needsUpdate = true;
    return placeholder;
}

// Standard model loader using explicit imports (cached)
function loadModelFromRegistry(category, name, onSuccess, onProgress, onError) {
    const modelPath = getModel(category, name);

    if (!modelPath) {
        console.error(`Model not found in registry: ${category}/${name}`);
        if (onError) onError(new Error(`Model not found in registry: ${category}/${name}`));
        return;
    }

    loadModelFromRegistryAsync(category, name, onProgress)
        .then((gltf) => {
            if (typeof onSuccess === 'function') onSuccess(gltf);
        })
        .catch((err) => {
            if (typeof onError === 'function') onError(err);
            else console.error('Error loading model:', err);
        });
}

// Async helpers (used for staged preloading)
export function loadModelFromRegistryAsync(category, name, onProgress) {
    const cacheKey = `${category}:${name}`;
    if (modelPromiseCache.has(cacheKey)) return modelPromiseCache.get(cacheKey);

    const promise = new Promise((resolve, reject) => {
        const modelPath = getModel(category, name);
        if (!modelPath) {
            reject(new Error(`Model not found in registry: ${category}/${name}`));
            return;
        }

        // For gltf models in directories, set resource path so embedded texture refs resolve.
        if (modelPath.endsWith('scene.gltf')) {
            const basePath = modelPath.substring(0, modelPath.lastIndexOf('/') + 1);
            gltfLoader.setResourcePath(basePath);
        }

        gltfLoader.load(modelPath, resolve, onProgress, reject);
    });

    modelPromiseCache.set(cacheKey, promise);
    return promise;
}

export function loadTextureFromRegistryAsync(category, name) {
    const cacheKey = `${category}:${name}`;
    if (texturePromiseCache.has(cacheKey)) return texturePromiseCache.get(cacheKey);

    const texturePath = getTexture(category, name);
    if (!texturePath) {
        return Promise.reject(new Error(`Texture not found: ${category}/${name}`));
    }

    const promise = new Promise((resolve, reject) => {
        const isKtx2 = typeof texturePath === 'string' && texturePath.toLowerCase().endsWith('.ktx2');
        const loader = isKtx2 ? ktx2Loader : textureLoader;
        loader.load(texturePath, resolve, undefined, reject);
    });

    texturePromiseCache.set(cacheKey, promise);
    return promise;
}

// Best-effort sync access for code paths that still expect immediate availability.
export function hasModelCached(category, name) {
    return modelPromiseCache.has(`${category}:${name}`);
}

export async function getModelCached(category, name) {
    return await loadModelFromRegistryAsync(category, name);
}

export async function getTextureCached(category, name) {
    return await loadTextureFromRegistryAsync(category, name);
}



///// ASSET STATS / DISPLAY /////

// Set up onProgress handlers for the loading managers
function setupLoadingManagerHandlers() {
    loadingManager.onStart = function(url) {
        const assetName = getAssetNameFromUrl(url);
        if (assetName) {
            trackAsset(assetName, 'model', false);
        }
    };

    loadingManager.onLoad = function() {
        updateAssetDisplay(loadingStats.assets.loaded, loadingStats.assets.total, 'assets');
    };
    
    loadingManager.onProgress = function(url, itemsLoaded, itemsTotal) {
        // Update counters
        loadingStats.assets.loaded = itemsLoaded;
        loadingStats.assets.total = itemsTotal;
        
        // Update specific asset status
        const assetName = getAssetNameFromUrl(url);
        if (assetName) {
            trackAsset(assetName, 'model', true);
        }
        
        updateAssetDisplay(itemsLoaded, itemsTotal, 'assets');
    };
    
    loadingManager.onError = function(url) {
        console.error('Error loading asset:', url);
        const assetName = getAssetNameFromUrl(url);
        if (assetName) {
            trackAsset(assetName, 'model', false, true);
        }
    };
    
    textureLoadingManager.onStart = function(url) {
        const textureName = getAssetNameFromUrl(url);
        if (textureName) {
            trackAsset(textureName, 'texture', false);
        }
    };

    textureLoadingManager.onLoad = function() {
        updateAssetDisplay(loadingStats.textures.loaded, loadingStats.textures.total, 'textures');
    };
    
    textureLoadingManager.onProgress = function(url, itemsLoaded, itemsTotal) {
        // Update counters
        loadingStats.textures.loaded = itemsLoaded;
        loadingStats.textures.total = itemsTotal;
        
        // Update specific texture status
        const textureName = getAssetNameFromUrl(url);
        if (textureName) {
            trackAsset(textureName, 'texture', true);
        }
        
        updateAssetDisplay(itemsLoaded, itemsTotal, 'textures');
    };
    
    textureLoadingManager.onError = function(url) {
        console.error('Error loading texture:', url);
        const textureName = getAssetNameFromUrl(url);
        if (textureName) {
            trackAsset(textureName, 'texture', false, true);
        }
    };
}

// Helper to extract asset name from URL
function getAssetNameFromUrl(url) {
    if (!url) return 'unknown';
    
    // Extract the file name from the URL
    const urlParts = url.split('/');
    let fileName = urlParts[urlParts.length - 1];
    
    // For gltf models, use the directory name instead (more descriptive)
    if (fileName === 'scene.gltf' && urlParts.length > 1) {
        fileName = urlParts[urlParts.length - 2];
    }
    
    // First, unconditionally add 'subtexture' to the name for any file that looks like a texture inside a model
    // This ensures they get filtered out in the display
    if (/\.(jpe?g|png|webp|tga|tif|tiff|bmp|exr|hdr)$/i.test(fileName) && 
        (/models\//i.test(url) || /scene\.gltf/i.test(url))) {
        
        // Check more specifically for texture naming patterns
        if (/\b(basecolor|diffuse|normal|roughness|metallic|specular|emissive|ao|opacity|albedo)\b/i.test(fileName)) {
            console.log(`Detected sub-texture in model (type 1): ${fileName}`);
            return `subtexture ${fileName.replace(/\.\w+$/, '')}`;
        }
        
        // Check for numeric texture patterns
        if (/(tex|texture|map)[\d_]+/i.test(fileName)) {
            console.log(`Detected sub-texture in model (type 2): ${fileName}`);
            return `subtexture ${fileName.replace(/\.\w+$/, '')}`;
        }
    }
    
    // Clean up the name for regular assets
    fileName = fileName.replace(/\.\w+$/, ''); // Remove file extension
    fileName = fileName.replace(/[-_]/g, ' '); // Replace dashes and underscores with spaces
    fileName = fileName.replace(/(\d+k)/i, (match) => match.toUpperCase()); // Capitalize resolution indicators like 2k
    
    return fileName;
}

// Track individual asset loading status
function trackAsset(name, type, loaded = false, error = false) {
    if (!name) return;
    
    // Skip sub-textures (they start with 'subtexture')
    if (name.toLowerCase().startsWith('subtexture')) {
        return;
    }
    
    // Create entry if it doesn't exist
    if (!loadingStats.individualAssets[name]) {
        loadingStats.individualAssets[name] = {
            type,
            loaded: false,
            error: false
        };
    }
    
    // Update status
    loadingStats.individualAssets[name].loaded = loaded;
    loadingStats.individualAssets[name].error = error;
    
    // Update the display
    updateAssetDisplay();
}

// Initial setup of handlers
setupLoadingManagerHandlers();

// Function to reset loading stats when changing scenes
function resetLoadingStats() {
    // Create brand new loading managers for the new scene
    loadingManager = new THREE.LoadingManager();
    textureLoadingManager = new THREE.LoadingManager();

    // Recreate loader instances so they attach to the fresh managers
    gltfLoader = createGLTFLoader();
    textureLoader = createTextureLoader();
    ktx2Loader = createKTX2Loader();
    
    // Set up the event handlers for the new managers
    setupLoadingManagerHandlers();

    // Reset all counters to zero
    loadingStats.assets.loaded = 0;
    loadingStats.assets.total = 0;
    loadingStats.textures.loaded = 0;
    loadingStats.textures.total = 0;
    loadingStats.individualAssets = {}; // Clear individual asset tracking
    
    // Update the display with reset values
    updateAssetDisplay(0, 0, 'assets');
    updateAssetDisplay(0, 0, 'textures');
    updateAssetDisplay();
    
    console.log("Loading stats reset for new scene - created new loading managers");
}

// Function to update the asset counter
function updateAssetDisplay(loaded, total, type) {
    // Check if we're in VR mode - if so, don't show the asset display
    if (window.isInXRSession === true) {
        // If we're in VR, make sure the display is hidden and return early
        let existingDisplay = document.getElementById('asset-display');
        if (existingDisplay) {
            existingDisplay.style.display = 'none';
            console.log('Asset display suppressed due to XR session');
        }
        return;
    }

    // Update the appropriate counter
    if (type === 'assets') {
        loadingStats.assets.loaded = loaded;
        loadingStats.assets.total = total;
    } else if (type === 'textures') {
        loadingStats.textures.loaded = loaded;
        loadingStats.textures.total = total;
    }

    let summaryDisplay = document.getElementById('asset-display');
    
    if (!summaryDisplay) {
        summaryDisplay = document.createElement('div');
        summaryDisplay.id = 'asset-display'; // Keep ID for potential CSS rules
        summaryDisplay.style.cssText = 'position:absolute;bottom:10px;right:10px;background:rgba(0,0,0,0.7);color:#fff;font-family:monospace;font-size:14px;font-weight:bold;padding:10px;border-radius:5px;z-index:10000;text-align:right;'; // Removed max-height/width/overflow
        document.body.appendChild(summaryDisplay);
    }
    
    // Only show the display if we're not in VR mode
    if (!window.isInXRSession) {
        summaryDisplay.style.display = 'block';
    }
    
    // Calculate remaining models and textures
    const totalModels = loadingStats.assets.total;
    const totalTextures = loadingStats.textures.total;
    const remainingModels = totalModels - loadingStats.assets.loaded;
    const remainingTextures = totalTextures - loadingStats.textures.loaded;

    let modelStatus = '';
    let textureStatus = '';
    
    // Determine model status string
    if (remainingModels > 0) {
        modelStatus = `${remainingModels} models remaining`;
    } else if (totalModels > 0) {
        modelStatus = 'All models loaded';
    }
    
    // Determine texture status string
    if (remainingTextures > 0) {
        textureStatus = `${remainingTextures} textures remaining`;
    } else if (totalTextures > 0) {
        textureStatus = 'All textures loaded';
    }

    // Combine status lines
    const statusLines = [modelStatus, textureStatus].filter(line => line !== "");
    let displayText = statusLines.join('<br>');
    if (displayText === "" && (totalModels > 0 || totalTextures > 0)) {
         // If lines are empty but we expect assets, show initial loading state
         displayText = 'Loading...';
    } else if (displayText === "") {
         // If nothing is expected to load yet
         displayText = 'Ready'; // Or maybe just empty?
    }

    // Determine color (Green only if EVERYTHING is loaded)
    let displayColor = '#fff'; // Default white
    if (remainingModels === 0 && remainingTextures === 0 && (totalModels > 0 || totalTextures > 0)) {
        displayColor = '#0f0'; // Green
    }

    // Update the display
    summaryDisplay.innerHTML = displayText;
    summaryDisplay.style.color = displayColor;
    
}


// Export the loading managers and functions for use in other modules
export { 
    loadingManager, 
    textureLoadingManager, 
    loadTextureFromRegistry, 
    loadModelFromRegistry, 
    updateAssetDisplay,
    resetLoadingStats,
    getAssetNameFromUrl,
    trackAsset,
};