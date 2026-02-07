#!/usr/bin/env node

/**
 * Environment switching script
 * This script makes it easy to switch between development and production environments
 * Usage: node scripts/switch-env.js [dev|prod]
 */

import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

// Get the target environment from command line arguments
const targetEnv = process.argv[2]?.toLowerCase();

if (!targetEnv || (targetEnv !== 'dev' && targetEnv !== 'prod')) {
  console.error('Please specify an environment: "dev" or "prod"');
  console.log('Usage: node scripts/switch-env.js [dev|prod]');
  process.exit(1);
}

// console.log(`Switching to ${targetEnv === 'dev' ? 'development' : 'production'} environment...`);

// Execute the appropriate build command
const buildCommand = targetEnv === 'dev' ? 'npm run build:dev' : 'npm run build:prod';

try {
  console.log(`Running: ${buildCommand}`);
  const { stdout: buildStdout, stderr: buildStderr } = await execPromise(buildCommand);
  
  if (buildStderr && !buildStderr.includes('INFO')) {
    console.error('Build error:', buildStderr);
  } else {
    console.log('Build output:', buildStdout);
    console.log(`Successfully built ${targetEnv === 'dev' ? 'development' : 'production'} environment!`);
  }
  
  // Update an environment indicator file
  fs.writeFileSync('.env.current', `CURRENT_ENV=${targetEnv}\n`);
  
  console.log(`\nEnvironment switched to ${targetEnv === 'dev' ? 'development' : 'production'}`);
  console.log(`\nTo run the ${targetEnv === 'dev' ? 'development' : 'production'} server:`);
  console.log(`npm run preview:${targetEnv}`);
  
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
} 