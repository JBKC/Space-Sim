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
const loadingStats = {
    assets: { loaded: 0, total: 0 },
    textures: { loaded: 0, total: 0 },
    // Track individual assets by name
    individualAssets: {}
};

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
    updateDetailedAssetDisplay();
}

// Initial setup of handlers
setupLoadingManagerHandlers();


///// ASSET LOADERS /////

// Standard texture loader using explicit imports
function loadTextureFromRegistry(category, name, onLoad) {
    const texture = getTexture(category, name);
    
    if (!texture) {
        console.error(`Texture not found: ${category}/${name}`);
        return new THREE.Texture(); // Return empty texture
    }
    
    console.log(`Loading texture: ${category}/${name} from registry`);
    
    // If we're using the direct import, we don't need textureLoader.load
    // Just create a THREE.js texture from the imported URL
    const threeTexture = new THREE.TextureLoader(textureLoadingManager).load(
        texture, 
        onLoad
    );
    
    return threeTexture;
}

// Standard model loader using explicit imports
function loadModelFromRegistry(category, name, onSuccess, onProgress, onError) {
    const modelPath = getModel(category, name);

    if (!modelPath) {
        console.error(`Model not found in registry: ${category}/${name}`);
        if (onError) onError(new Error(`Model not found in registry: ${category}/${name}`));
        return;
    }

    console.log(`Loading model from registry: ${category}/${name} from ${modelPath}`);
    gltfLoader.load(modelPath, onSuccess, onProgress, onError);
}


///// STATS / DISPLAY /////


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
    loadingStats.individualAssets = {}; // Clear individual asset tracking
    
    // Update the display with reset values
    updateAssetDisplay(0, 0, 'assets');
    updateAssetDisplay(0, 0, 'textures');
    updateDetailedAssetDisplay();
    
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
    
    // Update the summary display (keep for compatibility)
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
    
    // Update the detailed display
    updateDetailedAssetDisplay();
}

// Function to update the detailed asset display
function updateDetailedAssetDisplay() {
    // Get or create the detailed asset display element
    let detailedAssetDisplay = document.getElementById('detailed-asset-display');
    
    if (!detailedAssetDisplay) {
        detailedAssetDisplay = document.createElement('div');
        detailedAssetDisplay.id = 'detailed-asset-display';
        detailedAssetDisplay.style.cssText = 'position:absolute;bottom:10px;right:10px;background:rgba(0,0,0,0.7);color:#fff;font-family:monospace;font-size:14px;font-weight:bold;padding:10px;border-radius:5px;z-index:10000;text-align:right;max-height:50vh;overflow-y:auto;max-width:40vw;';
        document.body.appendChild(detailedAssetDisplay);
    }
    
    // Always show the display
    detailedAssetDisplay.style.display = 'block';
    
    // Get assets and ensure we're filtering out sub-textures
    const assetEntries = Object.entries(loadingStats.individualAssets)
        .filter(([name]) => {
            // Rigorously filter out all sub-textures or any textures with names matching common PBR patterns
            return !(
                name.startsWith('__subtexture__') || 
                name.toLowerCase().includes('subtexture') ||
                /\b(basecolor|diffuse|normal|roughness|metallic|specular|emissive|ao|opacity|albedo)\b/i.test(name) ||
                /(tex|texture|map)[\d_]+/i.test(name)
            );
        });
    
    // Count textures and models
    const textureCount = assetEntries.filter(([_, info]) => info.type === 'texture').length;
    const modelCount = assetEntries.filter(([_, info]) => info.type === 'model').length;
    
    if (assetEntries.length === 0) {
        detailedAssetDisplay.innerHTML = '<div style="text-align:center;">No assets loaded</div>';
        return;
    }
    
    // Create HTML for the detailed display
    let html = '<div style="text-align:center;margin-bottom:5px;font-size:16px;border-bottom:1px solid #555;padding-bottom:3px;">' +
               `Assets: ${textureCount + modelCount}` +
               '</div>';
    
    // Sort by type (textures first, then models) and then by name
    assetEntries.sort((a, b) => {
        if (a[1].type !== b[1].type) {
            return a[1].type === 'texture' ? -1 : 1;
        }
        return a[0].localeCompare(b[0]);
    });
    
    // Group by type
    const byType = {
        texture: [],
        model: []
    };
    
    assetEntries.forEach(([name, info]) => {
        byType[info.type]?.push([name, info]);
    });
    
    // Add textures section if any
    if (byType.texture.length > 0) {
        html += `<div style="margin-top:5px;font-size:15px;color:#aaa;">Textures (${byType.texture.length}):</div>`;
        
        byType.texture.forEach(([name, info]) => {
            const color = info.error ? '#f55' : (info.loaded ? '#5f5' : '#fff');
            const icon = info.error ? '❌' : (info.loaded ? '✓' : '⋯');
            html += `<div style="color:${color};margin:2px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${icon} ${name}</div>`;
        });
    }
    
    // Add models section if any
    if (byType.model.length > 0) {
        html += `<div style="margin-top:8px;font-size:15px;color:#aaa;">Models (${byType.model.length}):</div>`;
        
        byType.model.forEach(([name, info]) => {
            const color = info.error ? '#f55' : (info.loaded ? '#5f5' : '#fff');
            const icon = info.error ? '❌' : (info.loaded ? '✓' : '⋯');
            html += `<div style="color:${color};margin:2px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${icon} ${name}</div>`;
        });
    }
    
    // Update the display
    detailedAssetDisplay.innerHTML = html;
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
    updateDetailedAssetDisplay
};