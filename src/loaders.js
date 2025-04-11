import * as THREE from 'three';

// Initialize THREE.js loading managers to track progress
const loadingManager = new THREE.LoadingManager();
const textureLoadingManager = new THREE.LoadingManager();

// Store loading stats
const loadingStats = {
    assets: { loaded: 0, total: 0 },
    textures: { loaded: 0, total: 0 }
};

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

// Set up onProgress handlers for the loading managers
loadingManager.onProgress = function(url, itemsLoaded, itemsTotal) {
    updateAssetDisplay(itemsLoaded, itemsTotal, 'assets');
};

textureLoadingManager.onProgress = function(url, itemsLoaded, itemsTotal) {
    updateAssetDisplay(itemsLoaded, itemsTotal, 'textures');
};

// Export the loading managers and function for use in other modules
export { loadingManager, textureLoadingManager, updateAssetDisplay }; 