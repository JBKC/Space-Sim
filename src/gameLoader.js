import Bottleneck from 'bottleneck';

// Create a single limiter specifically for initial game loading
const gameLoadLimiter = new Bottleneck({
  maxConcurrent: 1,        // Only allow one game load at a time per client
  minTime: 3000,           // Minimum 3 seconds between game load attempts
  highWater: 2,            // Only queue up to 2 requests
  strategy: Bottleneck.strategy.LEAK // Drop new requests if queue is full
});

// Track if the game is already loaded to avoid unnecessary limiter usage
let gameLoaded = false;

/**
 * Rate-limited wrapper for game initialization
 * Only applies rate limiting to the initial game load function
 * @param {Function} startGameFn - The original startGame function
 * @returns {Function} - Rate-limited version of the startGame function
 */
export function createRateLimitedGameLoader(startGameFn) {
  return function(...args) {
    // If game is already loaded, bypass the rate limiter
    if (gameLoaded) {
      return startGameFn.apply(this, args);
    }
    
    // Use the limiter for initial game loading
    return gameLoadLimiter.schedule(() => {
      // Set the gameLoaded flag to true after first successful load
      const result = startGameFn.apply(this, args);
      gameLoaded = true;
      return result;
    });
  };
}

// Export the limiter for advanced usage if needed
export { gameLoadLimiter }; 