/**
 * Application configuration
 * This file centralizes all environment-specific variables
 * Simplified for direct browser usage without Vite
 */

// Define environment variables directly for browser usage
const ENV = 'development';
const ASSETS_PATH = '/src/assets/';
const DRACO_PATH = '/src/assets/draco/';
const APP_TITLE = 'PLANETARY - Development';
const API_URL = 'http://localhost:3000/api';

// Function to ensure paths have correct format (no double slashes, etc.)
const formatPath = (path) => {
  // Remove leading slash if present for relative paths in browser environment
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  // Ensure path ends with a slash
  return cleanPath.endsWith('/') ? cleanPath : `${cleanPath}/`;
};

// Ensure asset paths are properly formatted
const formattedAssetsPath = formatPath(ASSETS_PATH);
const formattedDracoPath = formatPath(DRACO_PATH);

// Add debug logging for asset paths
console.log(`Environment: ${ENV}`);
console.log(`Asset Path: ${formattedAssetsPath}`);
console.log(`Draco Path: ${formattedDracoPath}`);

// Export the configuration object
export default {
  ENV,
  ASSETS_PATH: formattedAssetsPath,
  DRACO_PATH: formattedDracoPath,
  APP_TITLE,
  API_URL,
  
  // Asset paths
  textures: {
    path: `${formattedAssetsPath}textures`,
    skybox: `${formattedAssetsPath}textures/skybox`,
  },
  models: {
    path: `${formattedAssetsPath}models`,
  },
  
  // Derived settings
  isDevelopment: ENV === 'development',
  isProduction: ENV === 'production',
  
  // Service URLs
  services: {
    api: API_URL,
  }
}; 