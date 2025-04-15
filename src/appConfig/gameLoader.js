import Bottleneck from 'bottleneck';

/**
 * Game loader with Bottleneck rate limiting
 * Ensures only one game loading process runs concurrently.
 */

// Create a Bottleneck limiter instance
// maxConcurrent: 1 ensures only one startGameFn runs at a time
// minTime: 0 means no delay is enforced between subsequent loads if the previous one finished
const gameLoadLimiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 0
});

// Track if the game is already loaded
let gameLoaded = false;

/**
 * A wrapper for game initialization that uses Bottleneck rate limiting.
 * @param {Function} startGameFn - The original startGame function
 * @returns {Function} - Wrapper around the startGame function that schedules it via Bottleneck
 */
export function createRateLimitedGameLoader(startGameFn) {
  return async function(...args) { // Make the wrapper async to handle the promise from schedule
    if (gameLoaded) {
      console.log("Game already loaded, skipping.");
      return; // Or handle reloading if necessary
    }

    try {
      // Use limiter.schedule() which returns a promise
      const result = await gameLoadLimiter.schedule(() => {
        console.log("Scheduling game load...");
        // Call the original function
        return startGameFn.apply(this, args);
      });
      gameLoaded = true;
      console.log("Game loaded successfully.");
      return result;
    } catch (error) {
      // Handle potential errors during scheduling or execution
      console.error("Error during game loading:", error);
      // Potentially reset gameLoaded state or perform cleanup
      throw error; // Re-throw the error if needed
    }
  };
}

// Export the actual Bottleneck limiter instance
export { gameLoadLimiter }; 