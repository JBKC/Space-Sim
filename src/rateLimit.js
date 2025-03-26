import Bottleneck from '/node_modules/bottleneck/lib/Bottleneck.js';

// Create default limiter instances for different use cases
const defaultLimiter = new Bottleneck({
  maxConcurrent: 5,   // Maximum number of tasks to execute at the same time
  minTime: 100,       // Minimum time between task executions in milliseconds
  highWater: 100,     // Maximum size of queue before rejecting requests
  strategy: Bottleneck.strategy.LEAK, // Strategy for handling queue overflows
  penalty: 5000       // Penalty to add when reaching highWater (only relevant with strategy BLOCK)
});

// Create a more aggressive limiter for API calls or heavy operations
const apiLimiter = new Bottleneck({
  maxConcurrent: 2,
  minTime: 500,
  reservoir: 100,      // Maximum number of tasks to execute before refilling (per interval)
  reservoirRefreshAmount: 100, // How many tasks to add when refilling the reservoir
  reservoirRefreshInterval: 60 * 1000, // How often to refill the reservoir (60 seconds)
});

// Create a light limiter for less critical operations
const lightLimiter = new Bottleneck({
  maxConcurrent: 10,
  minTime: 50
});

// Helper function to wrap any function with rate limiting
export function rateLimit(fn, limiterType = 'default') {
  const limiter = getLimiter(limiterType);
  
  return function(...args) {
    return limiter.schedule(() => fn.apply(this, args));
  };
}

// Helper function to get the appropriate limiter based on type
function getLimiter(type) {
  switch(type) {
    case 'api':
      return apiLimiter;
    case 'light':
      return lightLimiter;
    case 'default':
    default:
      return defaultLimiter;
  }
}

// Group limiter for related operations
export function createGroupLimiter(options = {}) {
  return new Bottleneck({
    maxConcurrent: options.maxConcurrent || 3,
    minTime: options.minTime || 200,
    ...options
  });
}

// Wrap fetch with rate limiting
export const rateLimitedFetch = rateLimit(fetch, 'api');

// Export the limiters for direct usage
export { defaultLimiter, apiLimiter, lightLimiter };

// Function to limit event handling
export function createThrottledEventListener(eventType, element, callback, limiterType = 'light') {
  const limiter = getLimiter(limiterType);
  const throttledCallback = function(event) {
    limiter.schedule(() => callback(event));
  };
  
  element.addEventListener(eventType, throttledCallback);
  
  // Return a function to remove the event listener
  return () => element.removeEventListener(eventType, throttledCallback);
}

// Function to batch process items with rate limiting
export async function batchProcess(items, processFn, batchSize = 10, limiterType = 'default') {
  const limiter = getLimiter(limiterType);
  const results = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchPromises = batch.map(item => 
      limiter.schedule(() => processFn(item))
    );
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }
  
  return results;
}

// Usage example (as a comment):
/*
// Import where needed
import { rateLimit, rateLimitedFetch, createThrottledEventListener, batchProcess } from './rateLimit.js';

// Example 1: Rate limit a function
const loadTexture = (url) => { 
  return new Promise(resolve => {
    // Texture loading logic here
    resolve(texture);
  });
};
const rateLimitedLoadTexture = rateLimit(loadTexture, 'api');

// Example 2: Rate limit fetch API calls
rateLimitedFetch('https://api.example.com/data')
  .then(response => response.json())
  .then(data => console.log(data));

// Example 3: Throttle event listeners
const removeListener = createThrottledEventListener('mousemove', window, (event) => {
  console.log(event.clientX, event.clientY);
});
// Later when needed: removeListener();

// Example 4: Batch process with rate limiting
const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
batchProcess(items, (item) => {
  return new Promise(resolve => {
    setTimeout(() => resolve(item * 2), 100);
  });
}).then(results => console.log(results));
*/ 