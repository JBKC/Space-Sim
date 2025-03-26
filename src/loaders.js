import * as THREE from 'three';

// Initialize THREE.js loading managers to track progress
const loadingManager = new THREE.LoadingManager();
const textureLoadingManager = new THREE.LoadingManager();

// Track all loaded textures for verification
const loadedTextures = new Set();
// Track textures that failed to load
const failedTextures = new Set();

/**
 * Force all textures in a scene to load by checking their image data
 * and forcing a needsUpdate
 * @param {THREE.Scene} scene - The scene containing objects with textures
 * @param {Function} renderCallback - Optional callback to render the scene after loading
 * @param {Boolean} aggressive - If true, attempt more aggressive loading techniques
 * @returns {Object} - Statistics about the loading process
 */
function forceLoadTextures(scene, renderCallback, aggressive = false) {
    if (!scene) {
        console.warn('No scene provided for texture force loading');
        return { total: 0, loaded: 0, failed: 0 };
    }
    
    console.log(`Force loading textures for scene: ${scene.name || 'unnamed scene'}`);
    
    let textureCount = 0;
    let loadedCount = 0;
    let failedCount = 0;
    const texturesInScene = new Map(); // Use a map to track textures and their parent materials
    
    // First pass: scan the scene for all textures
    scene.traverse(object => {
        if (object.isMesh && object.material) {
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            
            materials.forEach(material => {
                // Check for all texture properties
                const textureProps = [
                    'map', 'bumpMap', 'normalMap', 'emissiveMap', 'specularMap', 
                    'envMap', 'lightMap', 'aoMap', 'displacementMap', 'metalnessMap', 
                    'roughnessMap', 'alphaMap'
                ];
                
                textureProps.forEach(prop => {
                    if (material[prop] && material[prop].isTexture) {
                        textureCount++;
                        texturesInScene.set(material[prop], { 
                            material: material, 
                            property: prop,
                            object: object
                        });
                    }
                });
            });
        }
    });
    
    // Second pass: force load each texture
    texturesInScene.forEach((info, texture) => {
        // Skip textures that are data textures or already fully loaded
        if (texture.isDataTexture || 
            (texture.image && 
             ((texture.image instanceof HTMLImageElement && texture.image.complete && texture.image.width > 0) || 
              (Array.isArray(texture.image) && texture.image.every(img => img && img.complete && img.width > 0))))) {
            
            // Already loaded properly
            loadedCount++;
            return;
        }
        
        // Check if this texture previously failed to load
        if (failedTextures.has(texture)) {
            console.log(`Attempting to reload previously failed texture: ${texture.name || 'unnamed'}`);
        }
        
        try {
            // Force texture update
            texture.needsUpdate = true;
            
            // For cube textures
            if (texture.isCubeTexture && Array.isArray(texture.image)) {
                const allLoaded = texture.image.every(img => img && img.complete && img.width > 0);
                if (!allLoaded && aggressive) {
                    // Try to force cube texture reload
                    console.log(`Forcing reload of cube texture on ${info.object.name || 'unnamed object'}`);
                    texture.dispose();
                    info.material[info.property] = null;
                    failedCount++;
                    failedTextures.add(texture);
                }
            } 
            // For regular textures
            else if (texture.image) {
                if (texture.image instanceof HTMLImageElement) {
                    if (!texture.image.complete || texture.image.width === 0) {
                        console.log(`Texture not fully loaded - forcing update: ${texture.name || 'unnamed'}`);
                        
                        // Try to force image to load
                        const originalSrc = texture.image.src;
                        if (aggressive && originalSrc) {
                            // Add a timestamp to force a fresh load and bypass cache
                            const cacheBuster = `?t=${Date.now()}`;
                            texture.image.src = originalSrc.includes('?') 
                                ? `${originalSrc}&_=${Date.now()}`
                                : `${originalSrc}${cacheBuster}`;
                                
                            // Set up load event to track when the image is ready
                            texture.image.onload = () => {
                                console.log(`Reloaded image completed loading: ${texture.name || 'unnamed'}`);
                                texture.needsUpdate = true;
                                info.material.needsUpdate = true;
                                
                                // Remove from failed textures if it was there
                                failedTextures.delete(texture);
                                
                                // Render again when texture is loaded
                                if (renderCallback && typeof renderCallback === 'function') {
                                    renderCallback();
                                }
                            };
                        }
                    } else {
                        loadedCount++;
                    }
                } else {
                    // Handle other image types
                    console.log(`Unknown image type for texture: ${texture.name || 'unnamed'}`);
                    failedCount++;
                    failedTextures.add(texture);
                }
            } else {
                // Texture with no image data
                console.log(`Texture has no image data: ${texture.name || 'unnamed'}`);
                failedCount++;
                failedTextures.add(texture);
            }
            
            // Make sure material knows to update too
            info.material.needsUpdate = true;
            
        } catch (error) {
            console.error(`Error forcing texture to load: ${error.message}`);
            failedCount++;
            failedTextures.add(texture);
        }
    });
    
    // If there are too many failed textures, try clearing the cache and reloading
    if (failedCount > 0 && aggressive) {
        console.log(`${failedCount} textures failed to load. Attempting more aggressive reload...`);
        
        // Schedule a retry with cache-busting in a few seconds
        setTimeout(() => {
            // Convert failedTextures Set to an array for iteration
            [...failedTextures].forEach(texture => {
                if (texture && texture.image && texture.image.src) {
                    // Add cache busting
                    const currentSrc = texture.image.src;
                    texture.image.src = currentSrc.includes('?') 
                        ? `${currentSrc}&_retry=${Date.now()}`
                        : `${currentSrc}?_retry=${Date.now()}`;
                    
                    // Make sure texture update flag is set
                    texture.needsUpdate = true;
                }
            });
            
            // Force another render with the retry textures
            if (renderCallback && typeof renderCallback === 'function') {
                renderCallback();
            }
        }, 1000);
    }
    
    // Force a render to show the updated textures immediately
    if (renderCallback && typeof renderCallback === 'function') {
        console.log('Executing render callback to show updated textures');
        renderCallback();
    }
    
    // Final processing of materials to ensure updates
    scene.traverse(object => {
        if (object.isMesh && object.material) {
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            materials.forEach(material => material.needsUpdate = true);
        }
    });
    
    console.log(`Texture force loading complete: ${loadedCount}/${textureCount} textures loaded successfully, ${failedCount} failed`);
    return { total: textureCount, loaded: loadedCount, failed: failedCount };
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
                                    
                                    // Add to failed textures for potential reload
                                    failedTextures.add(material[prop]);
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

// Export the loading managers and functions for use in other modules
export { 
    loadingManager, 
    textureLoadingManager, 
    verifyTextureLoading,
    forceLoadTextures
}; 