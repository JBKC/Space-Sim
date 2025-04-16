// src/cesiumRateLimit.js - Configure Cesium's built-in request scheduler for optimal tile loading

import * as Cesium from 'cesium';

/**
 * Configures Cesium's RequestScheduler to limit tile requests
 * This helps prevent overwhelming the server with too many concurrent requests
 * @param {Object} options - Configuration options
 */
export function configureCesiumRequestScheduler(options = {}) {
    // Set default options if not provided
    const config = {
        maximumRequestsPerServer: options.maximumRequestsPerServer || 6,
        throttleRequestsByServer: options.throttleRequestsByServer !== false,
        priorityHeightLimit: options.priorityHeightLimit || 120000,
        perServerRequestLimit: options.perServerRequestLimit || 12,
        requestQueueSize: options.requestQueueSize || 100,
    };
    
    console.log('Configuring Cesium RequestScheduler with:', config);
    
    // Configure Cesium's global RequestScheduler
    Cesium.RequestScheduler.maximumRequestsPerServer = config.maximumRequestsPerServer;
    Cesium.RequestScheduler.throttleRequestsByServer = config.throttleRequestsByServer;
    
    // Configure tile request throttling if the feature is available in this Cesium version
    try {
        // Check if TileRequestThrottleParameters exists in this Cesium version
        if (Cesium.TileRequestThrottleParameters) {
            // Configure high priority request parameters
            Cesium.TileRequestThrottleParameters.priorityHeightLimit = config.priorityHeightLimit;
            
            // These options may exist depending on your Cesium version
            if ('highPriorityLimit' in Cesium.TileRequestThrottleParameters) {
                Cesium.TileRequestThrottleParameters.highPriorityLimit = 
                    Math.min(config.maximumRequestsPerServer, 6);
            }
            
            if ('mediumPriorityLimit' in Cesium.TileRequestThrottleParameters) {
                Cesium.TileRequestThrottleParameters.mediumPriorityLimit = 
                    Math.min(config.maximumRequestsPerServer - 2, 4);
            }
            
            if ('lowPriorityLimit' in Cesium.TileRequestThrottleParameters) {
                Cesium.TileRequestThrottleParameters.lowPriorityLimit = 
                    Math.min(config.maximumRequestsPerServer - 4, 2);
            }
        } else {
            console.warn('Cesium.TileRequestThrottleParameters not available in this version of Cesium');
        }
    } catch (error) {
        console.warn('Error configuring TileRequestThrottleParameters:', error.message);
    }
    
    // Configure per-server request limits if available
    if (Cesium.RequestScheduler.perServerRequestLimit !== undefined) {
        Cesium.RequestScheduler.perServerRequestLimit = config.perServerRequestLimit;
    }
    
    // Set request queue size if available
    if (Cesium.RequestScheduler.requestQueueSize !== undefined) {
        Cesium.RequestScheduler.requestQueueSize = config.requestQueueSize;
    }
    
    // Additional configurations for newer Cesium versions
    if (Cesium.Cesium3DTileset && Cesium.Cesium3DTileset.maximumRequestsPerServer !== undefined) {
        Cesium.Cesium3DTileset.maximumRequestsPerServer = config.maximumRequestsPerServer;
    }
    
    // Configure imagery tile rate limiting
    if (Cesium.ImageryProvider && Cesium.ImageryProvider.maximumRequestsPerServer !== undefined) {
        Cesium.ImageryProvider.maximumRequestsPerServer = config.maximumRequestsPerServer;
    }
    
    return {
        // Return a method to get current status
        getStatus: () => {
            return {
                maximumRequestsPerServer: Cesium.RequestScheduler.maximumRequestsPerServer,
                throttleRequestsByServer: Cesium.RequestScheduler.throttleRequestsByServer,
                requestsInProgress: Cesium.RequestScheduler.requestHeap ? 
                    Cesium.RequestScheduler.requestHeap.length : 'Unknown'
            };
        },
        
        // Return a method to temporarily boost request limit (useful during initial load)
        temporaryBoost: (duration = 5000) => {
            const originalLimit = Cesium.RequestScheduler.maximumRequestsPerServer;
            console.log(`Temporarily boosting request limit from ${originalLimit} to ${originalLimit * 2} for ${duration}ms`);
            
            Cesium.RequestScheduler.maximumRequestsPerServer = originalLimit * 2;
            
            setTimeout(() => {
                Cesium.RequestScheduler.maximumRequestsPerServer = originalLimit;
                console.log(`Request limit restored to ${originalLimit}`);
            }, duration);
        }
    };
}

/**
 * Configures optimal Cesium terrain loading parameters
 * @param {Cesium.Viewer} viewer - The Cesium viewer instance
 * @param {Object} options - Configuration options
 */
export function optimizeTerrainLoading(viewer, options = {}) {
    if (!viewer || !viewer.scene) {
        console.error('Invalid Cesium viewer provided');
        return;
    }
    
    // Set default options if not provided
    const config = {
        maximumScreenSpaceError: options.maximumScreenSpaceError || 2,
        tileCacheSize: options.tileCacheSize || 100,
        loadingDescendantLimit: options.loadingDescendantLimit || 20,
        preloadAncestors: options.preloadAncestors !== false,
        preloadSiblings: options.preloadSiblings !== false,
        dynamicScreenSpaceError: options.dynamicScreenSpaceError !== false,
        dynamicScreenSpaceErrorFactor: options.dynamicScreenSpaceErrorFactor || 4.0,
        dynamicScreenSpaceErrorDensity: options.dynamicScreenSpaceErrorDensity || 0.00278,
    };
    
    console.log('Optimizing Cesium terrain loading with:', config);
    
    // Configure terrain loading parameters
    if (viewer.scene.globe) {
        // Control the detail level of terrain
        viewer.scene.globe.maximumScreenSpaceError = config.maximumScreenSpaceError;
        
        // Configure tile cache size if available
        if (viewer.scene.globe.tileCacheSize !== undefined) {
            viewer.scene.globe.tileCacheSize = config.tileCacheSize;
        }
    }
    
    // Configure 3D Tileset loading if available
    if (viewer.scene.primitives) {
        const primitives = viewer.scene.primitives;
        for (let i = 0; i < primitives.length; i++) {
            const primitive = primitives.get(i);
            if (primitive && primitive.constructor && primitive.constructor.name === 'Cesium3DTileset') {
                // Set loading parameters for 3D Tilesets
                primitive.maximumScreenSpaceError = config.maximumScreenSpaceError;
                primitive.loadingDescendantLimit = config.loadingDescendantLimit;
                primitive.preloadAncestors = config.preloadAncestors;
                primitive.preloadSiblings = config.preloadSiblings;
                primitive.dynamicScreenSpaceError = config.dynamicScreenSpaceError;
                primitive.dynamicScreenSpaceErrorFactor = config.dynamicScreenSpaceErrorFactor;
                primitive.dynamicScreenSpaceErrorDensity = config.dynamicScreenSpaceErrorDensity;
                
                console.log('Applied rate limiting to 3D Tileset:', primitive.url || primitive.name || 'unnamed');
            }
        }
    }
    
    // Return controller for runtime adjustments
    return {
        increaseDetail: () => {
            if (viewer.scene.globe) {
                viewer.scene.globe.maximumScreenSpaceError = Math.max(1, config.maximumScreenSpaceError / 2);
                console.log('Increased terrain detail (lower SSE):', viewer.scene.globe.maximumScreenSpaceError);
            }
        },
        decreaseDetail: () => {
            if (viewer.scene.globe) {
                viewer.scene.globe.maximumScreenSpaceError = config.maximumScreenSpaceError * 2;
                console.log('Decreased terrain detail (higher SSE):', viewer.scene.globe.maximumScreenSpaceError);
            }
        },
        resetDetail: () => {
            if (viewer.scene.globe) {
                viewer.scene.globe.maximumScreenSpaceError = config.maximumScreenSpaceError;
                console.log('Reset terrain detail to default:', config.maximumScreenSpaceError);
            }
        }
    };
} 