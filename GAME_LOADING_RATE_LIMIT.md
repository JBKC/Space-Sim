# Game Loading Rate Limiting

This document explains the rate limiting implementation for the initial loading of the space simulation game.

## Overview

The implementation uses [Bottleneck](https://www.npmjs.com/package/bottleneck), a lightweight and zero-dependency Task Scheduler and Rate Limiter for Node.js and the browser. The rate limiting is **specifically focused on the initial game loading** to prevent excessive server requests from repeated game starts.

## What's Rate Limited

- **ONLY** the initial game loading process is rate limited
- Once the game is loaded, no other operations are rate limited (per your requirements)

## Implementation Details

The rate limiting is implemented via two files:

1. **src/gameLoader.js**
   - Contains a dedicated Bottleneck limiter configured only for initial game loading
   - Provides a `createRateLimitedGameLoader` function that wraps the game start function
   - Tracks when the game has been loaded to avoid unnecessary rate limiting on subsequent interactions

2. **src/main.js** (modified)
   - The `startGame` function is wrapped with the rate limiter
   - The rate-limited version is used only for the initial click on the "Explore" button

## Configuration

The current rate limiting configuration for initial game loading:

```javascript
const gameLoadLimiter = new Bottleneck({
  maxConcurrent: 1,        // Only allow one game load at a time per client
  minTime: 3000,           // Minimum 3 seconds between game load attempts
  highWater: 2,            // Only queue up to 2 requests
  strategy: Bottleneck.strategy.LEAK // Drop new requests if queue is full
});
```

This means:
- Only one game loading operation can happen at a time
- There must be at least 3 seconds between game loading attempts
- At most 2 game loading requests can be queued
- If more requests come in while the queue is full, they will be dropped (not executed)

## What's NOT Rate Limited

The following aspects of the game are explicitly NOT rate limited:

- In-game operations
- Asset loading
- UI interactions
- Button presses inside the game
- Any other game functions

## How It Works

1. When a user clicks the "Explore" button, the click is processed through the rate limiter
2. If the user has already successfully loaded the game once in this session, the rate limiter is bypassed
3. If the rate limiter allows the request, the game starts normally
4. If the user clicks rapidly multiple times, only one request will be processed initially, with subsequent requests either queued (up to 2) or dropped

## Adjusting the Rate Limiting

To adjust the rate limiting parameters, edit the configuration in `src/gameLoader.js`. The main parameters you may want to adjust:

- `minTime`: The minimum time between allowed game loads (in milliseconds)
- `highWater`: How many game load requests can be queued before dropping new ones
- `maxConcurrent`: How many game loads can happen simultaneously (recommend keeping at 1)

## Important Notes

- This implementation rate-limits on a per-client basis only
- For server-side rate limiting across all users, additional server-side implementation would be required
- The rate limiting persists only for the current browser session 