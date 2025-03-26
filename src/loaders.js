import * as THREE from 'three';

// Initialize THREE.js loading managers to track progress
const loadingManager = new THREE.LoadingManager();
const textureLoadingManager = new THREE.LoadingManager();

// Store loading stats
const loadingStats = {
    assets: { loaded: 0, total: 0 },
    textures: { loaded: 0, total: 0 }
};

// Track all loaded textures for verification
const loadedTextures = new Set();

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

/**
 * Function to verify textures are properly loaded and applied
 * This will force a needsUpdate on all textures to ensure they're visible
 * @param {THREE.Scene} scene - The scene to check
 */
function verifyTextureLoading(scene) {
    if (!scene) {
        console.warn('Scene not provided for texture verification');
        return { total: 0, updated: 0 };
    }
    
    console.log('Verifying texture loading for scene:', scene.name || 'unnamed scene');
    let textureCount = 0;
    let updatedCount = 0;
    let materialsUpdated = 0;
    
    // Traverse the scene and force update on all textures
    scene.traverse(object => {
        if (object.isMesh) {
            // Handle standard materials
            if (object.material) {
                const materials = Array.isArray(object.material) ? object.material : [object.material];
                
                materials.forEach(material => {
                    // Check for map, bumpMap, normalMap, etc.
                    const textureProps = [
                        'map', 'bumpMap', 'normalMap', 'emissiveMap', 'specularMap', 
                        'envMap', 'lightMap', 'aoMap', 'displacementMap', 'metalnessMap', 
                        'roughnessMap', 'alphaMap'
                    ];
                    
                    let materialNeedsUpdate = false;
                    
                    textureProps.forEach(prop => {
                        if (material[prop]) {
                            textureCount++;
                            
                            // Force texture to update
                            material[prop].needsUpdate = true;
                            
                            // Check if the image data is available and valid
                            if (material[prop].image) {
                                // For cube textures, check if all faces are loaded
                                if (Array.isArray(material[prop].image)) {
                                    const allImagesValid = material[prop].image.every(img => img && img.width > 0);
                                    if (!allImagesValid) {
                                        console.log(`Cube texture on ${object.name || 'unnamed object'} requires reload`);
                                        // This is a cube texture - just mark it as needing update for now
                                        material[prop].needsUpdate = true;
                                    }
                                } else if (!material[prop].image.complete || material[prop].image.width === 0) {
                                    // This texture's image hasn't fully loaded
                                    console.log(`Texture on ${object.name || 'unnamed object'} not fully loaded - forcing update`);
                                    material[prop].needsUpdate = true;
                                }
                            }
                            
                            updatedCount++;
                            materialNeedsUpdate = true;
                        }
                    });
                    
                    // If any textures were updated, make sure to update the material as well
                    if (materialNeedsUpdate) {
                        material.needsUpdate = true;
                        materialsUpdated++;
                    }
                });
            }
        }
    });
    
    // Finally, force a render to show the updated textures
    if (updatedCount > 0 && scene.userData && typeof scene.userData.forceRender === 'function') {
        scene.userData.forceRender();
    }
    
    console.log(`Texture verification complete: Updated ${updatedCount} textures on ${materialsUpdated} materials`);
    return { total: textureCount, updated: updatedCount, materials: materialsUpdated };
}

// Override the standard TextureLoader to keep track of loaded textures
const originalTextureLoaderLoad = THREE.TextureLoader.prototype.load;
THREE.TextureLoader.prototype.load = function(url, onLoad, onProgress, onError) {
    return originalTextureLoaderLoad.call(this, url, 
        (texture) => {
            // Add to our loaded textures set
            loadedTextures.add(texture);
            
            // Call the original onLoad if provided
            if (onLoad) onLoad(texture);
        },
        onProgress,
        onError
    );
};

// Set up onProgress handlers for the loading managers
loadingManager.onProgress = function(url, itemsLoaded, itemsTotal) {
    updateAssetDisplay(itemsLoaded, itemsTotal, 'assets');
};

textureLoadingManager.onProgress = function(url, itemsLoaded, itemsTotal) {
    updateAssetDisplay(itemsLoaded, itemsTotal, 'textures');
};

// Export the loading managers and functions for use in other modules
export { 
    loadingManager, 
    textureLoadingManager, 
    updateAssetDisplay,
    verifyTextureLoading
}; 