/**
 * assetStatusManager.js
 * Manages the loading status of individual assets for the current scene.
 */

// Stores assets: { id: { name: 'display name', status: 'pending' | 'loading' | 'loaded' | 'error' } }
let currentAssets = {};
let subscribers = [];

// Notify subscribers of changes
function notifySubscribers() {
  subscribers.forEach(callback => callback(Object.values(currentAssets)));
}

/**
 * Resets the list of assets being tracked (call on scene change).
 */
export function resetAssetStatus() {
  console.log('Asset Status Manager: Resetting tracked assets.');
  currentAssets = {};
  notifySubscribers();
}

/**
 * Registers an asset that is expected to be loaded.
 * @param {string} id - Unique identifier (e.g., 'texture:planets/earth')
 * @param {string} name - User-friendly display name (e.g., 'Earth Texture')
 */
export function registerAsset(id, name) {
  if (!currentAssets[id]) {
    // console.log(`Asset Status Manager: Registering ${name} (${id})`);
    currentAssets[id] = { id, name, status: 'pending' };
    notifySubscribers();
  } else {
    // If already registered, ensure status is at least pending
    if (currentAssets[id].status !== 'loading' && currentAssets[id].status !== 'loaded' && currentAssets[id].status !== 'error') {
        currentAssets[id].status = 'pending';
        notifySubscribers();
    }
  }
}

/**
 * Updates the status of a registered asset.
 * @param {string} id - Unique identifier
 * @param {'loading' | 'loaded' | 'error'} status - The new status
 */
export function updateAssetStatus(id, status) {
  if (currentAssets[id]) {
    // console.log(`Asset Status Manager: Updating ${currentAssets[id].name} (${id}) to ${status}`);
    if (currentAssets[id].status !== status) { // Only update if status changed
        currentAssets[id].status = status;
        notifySubscribers();
    }
  } else {
    console.warn(`Asset Status Manager: Attempted to update status for unregistered asset ID: ${id}`);
  }
}

/**
 * Subscribes a callback function to status changes.
 * @param {function} callback - Function to call with the updated asset list.
 */
export function subscribeToAssetStatus(callback) {
  subscribers.push(callback);
  // Immediately call with current state
  callback(Object.values(currentAssets));
}

/**
 * Unsubscribes a callback function.
 * @param {function} callback - The callback to remove.
 */
export function unsubscribeFromAssetStatus(callback) {
  subscribers = subscribers.filter(sub => sub !== callback);
} 