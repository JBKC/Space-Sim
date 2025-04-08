# PLANETARY - Space Simulation

A 3D space exploration simulation built with THREE.js and Vite.

## Project Setup

### Prerequisites

- Node.js (v14 or higher)
- npm (v7 or higher)

### Installation

```bash
# Install dependencies
npm install
```

## Development

```bash
# Start development server
npm run dev
```

This will start a local development server at http://localhost:3000.

## Building for Production or Development

The project supports both development and production environments with different configurations.

### Development Build

```bash
# Build for development environment
npm run build:dev
```

This creates a development build in the `dist-dev` directory with:
- Source maps enabled
- Minimal minification
- Environment-specific variables from `.env.development`

### Production Build

```bash
# Build for production environment
npm run build:prod
```

This creates a production build in the `dist` directory with:
- No source maps
- Full minification and optimizations
- Console logs removed
- Environment-specific variables from `.env.production`

## Previewing Builds

After building, you can preview the builds using:

```bash
# Preview development build
npm run preview:dev

# Preview production build
npm run preview:prod
```

## Switching Environments

A helper script is included to easily switch between environments:

```bash
# Switch to development environment
node switch-env.js dev

# Switch to production environment
node switch-env.js prod
```

This script will build the appropriate version and set up environment indicators.

## Project Structure

```
planetary/
├── public/               # Static assets that don't need processing
├── src/                  # Source code
│   ├── assets/           # Assets that need processing
│   │   ├── draco/        # Draco decoder files
│   │   ├── models/       # 3D models
│   │   └── textures/     # Textures and skybox images
│   ├── main.js           # Main entry point
│   ├── setup.js          # Main scene setup
│   ├── config.js         # Environment-specific configuration
│   └── [other modules]   # Various application modules
├── .env.development      # Development environment variables
├── .env.production       # Production environment variables
├── vite.config.js        # Vite config for development
├── vite.config.prod.js   # Vite config for production
└── package.json          # Project metadata and scripts
```

## Environment Variables

The application uses environment variables to handle differences between development and production:

- `VITE_APP_ENV` - Current environment ("development" or "production")
- `VITE_APP_TITLE` - Application title displayed in the browser
- `VITE_ASSETS_PATH` - Path to assets directory
- `VITE_DRACO_PATH` - Path to Draco decoder files
- `VITE_API_URL` - API URL for any backend services

These variables are defined in the `.env.development` and `.env.production` files and accessed through the `config.js` module.

## License

[Add your license information here]
# Additional note about large files
