# Rate Limiting with Bottleneck

This documentation explains how to use the rate limiting functionality in the space simulation project. The implementation uses [Bottleneck](https://www.npmjs.com/package/bottleneck), a lightweight and zero-dependency Task Scheduler and Rate Limiter for Node.js and the browser.

## Overview

The `src/rateLimit.js` file provides several utility functions and pre-configured limiters that can be used throughout the application without modifying any existing code. This implementation follows a non-intrusive approach, allowing you to add rate limiting where needed by wrapping existing functions.

## Available Limiters

Three pre-configured limiters are available:

1. **defaultLimiter**: General-purpose limiter with moderate constraints.
   - maxConcurrent: 5
   - minTime: 100ms

2. **apiLimiter**: More aggressive limiter for API calls or heavy operations.
   - maxConcurrent: 2
   - minTime: 500ms
   - With reservoir refill (100 tasks per minute)

3. **lightLimiter**: Less restrictive limiter for less critical operations.
   - maxConcurrent: 10
   - minTime: 50ms

## Core Functions

### `rateLimit(fn, limiterType = 'default')`

Wraps any function with rate limiting. Returns a new function that, when called, will be scheduled according to the rate limits.

```javascript
import { rateLimit } from './src/rateLimit.js';

const originalFunction = (param) => {
  // Your existing code
};

// Create a rate-limited version of the function
const rateLimitedFunction = rateLimit(originalFunction, 'api');

// Use it the same way as the original function
rateLimitedFunction('some parameter'); // This call will be rate-limited
```

### `createGroupLimiter(options = {})`

Creates a new limiter instance for a specific group of operations.

```javascript
import { createGroupLimiter } from './src/rateLimit.js';

const textureLoadingLimiter = createGroupLimiter({
  maxConcurrent: 3,
  minTime: 200
});

// Use the limiter directly
textureLoadingLimiter.schedule(() => loadTextureFromRegistry('texture1.jpg'));
```

### `rateLimitedFetch(url, options)`

A pre-wrapped version of the fetch API with rate limiting applied.

```javascript
import { rateLimitedFetch } from './src/rateLimit.js';

// Use instead of regular fetch
rateLimitedFetch('https://api.example.com/data')
  .then(response => response.json())
  .then(data => console.log(data));
```

### `createThrottledEventListener(eventType, element, callback, limiterType = 'light')`

Creates a throttled event listener that limits how often the callback function is executed.

```javascript
import { createThrottledEventListener } from './src/rateLimit.js';

// Throttle mousemove events
const removeListener = createThrottledEventListener('mousemove', window, (event) => {
  console.log(event.clientX, event.clientY);
});

// Later when needed:
removeListener(); // Removes the event listener
```

### `batchProcess(items, processFn, batchSize = 10, limiterType = 'default')`

Processes an array of items in batches with rate limiting.

```javascript
import { batchProcess } from './src/rateLimit.js';

const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// Process items with rate limiting
batchProcess(items, (item) => {
  return new Promise(resolve => {
    // Process the item
    resolve(item * 2);
  });
}).then(results => console.log(results));
```

## Common Use Cases in Space Simulation

### 1. Texture Loading

```javascript
import { rateLimit } from './src/rateLimit.js';

// Assuming this is your texture loading function
function loadTextureFromRegistry(textureUrl) {
  // Existing texture loading logic
}

// Create rate-limited version
const rateLimitedloadTextureFromRegistry = rateLimit(loadTextureFromRegistry, 'api');

// Use the rate-limited version when loading textures
const planetTexture = await rateLimitedloadTextureFromRegistry('planet_texture1.jpg');
```

### 2. Throttling Keyboard/Mouse Input

```javascript
import { createThrottledEventListener } from './src/rateLimit.js';

// Instead of:
// document.addEventListener('keydown', (event) => { ... });

// Use:
createThrottledEventListener('keydown', document, (event) => {
  // Your existing event handler logic
}, 'light');
```

### 3. API Calls

```javascript
import { rateLimitedFetch } from './src/rateLimit.js';

// Instead of:
// fetch('https://api.nasa.gov/planetary/...')

// Use:
rateLimitedFetch('https://api.nasa.gov/planetary/...')
  .then(response => response.json())
  .then(data => {
    // Process the data
  });
```

### 4. Batch Processing Celestial Objects

```javascript
import { batchProcess } from './src/rateLimit.js';

// Assuming you have an array of asteroids to update
const asteroids = [/* list of asteroid objects */];

// Process them in batches
batchProcess(asteroids, (asteroid) => {
  // Update asteroid position, rotation, etc.
  return updatedAsteroid;
}, 20, 'light');
```

## Example Demo

An example HTML file (`rate-limiting-example.html`) is included to demonstrate the rate limiting functionality. Open it in your browser to see how rate limiting works in action.

## Common Gotchas (From Bottleneck Documentation)

1. **Bottleneck is Job-based, not Request-based**: It's built to handle individual jobs (function calls), not HTTP requests directly.

2. **Arguments to the wrapped function matter**: Each unique set of arguments is considered a separate job.

3. **Be careful with `this` binding**: When using `rateLimit` with methods that need `this` context, the context is preserved.

4. **Don't create new limiters for every request**: The limiters in `rateLimit.js` are singleton instances. Use them across your application.

5. **Avoid nesting limiters**: Nesting limiters can lead to unexpected behavior and deadlocks.

## Custom Configuration

If you need to customize the limiters further, you can edit the `src/rateLimit.js` file to adjust the parameters based on your specific requirements. 