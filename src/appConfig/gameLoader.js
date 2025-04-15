/**
 * Simple game loader without rate limiting
 * This is a replacement for the Bottleneck-based rate limiter
 */

// Track if the game is already loaded 
let gameLoaded = false;

/**
 * A simple wrapper for game initialization
 * This version doesn't do any rate limiting, but preserves the same API
 * @param {Function} startGameFn - The original startGame function
 * @returns {Function} - Wrapper around the startGame function
 */
export function createRateLimitedGameLoader(startGameFn) {
  return function(...args) {
    // Call the original function
    const result = startGameFn.apply(this, args);
    gameLoaded = true;
    return result;
  };
}

// Export a dummy limiter for compatibility
export const gameLoadLimiter = {
  schedule: (fn) => fn()
}; 