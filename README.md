# Tripo3D Model Generator (v2 API)

This is a web application that generates 3D models from images using the Tripo3D API v2 endpoints.

## Features

- Upload images via drag & drop or file selector
- Convert images directly to 3D models using Tripo3D's v2 API
- Automatic background removal and texturing
- 3D model viewer with OrbitControls
- Download generated 3D models (GLB, FBX formats)

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd generation_tripo
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with your Tripo3D API key (v2 format):
```
TRIPO_API_KEY=your-tripo-api-key-here
PORT=8000
```

4. Start the server:
```bash
npm run dev
```

5. Open your browser and go to http://localhost:8000

## How it works

1. User uploads an image
2. Image is converted to base64 and sent directly to the Tripo3D v2 API
3. The server polls the Tripo3D API for job status
4. Once the 3D model is generated, it's loaded into the viewer
5. User can download the generated 3D model

## API Endpoints

- `POST /api/generate`: Uploads an image and initiates 3D model generation
- `GET /api/status/:taskId`: Checks the status of a 3D model generation task
- `GET /health`: Health check endpoint

## Tripo3D v2 API

This implementation uses the official Tripo3D v2 API. Key features:
- Bearer token authentication
- Image-to-model and text-to-model capabilities
- Support for multiple model versions (v1.4, v2.0, v2.5)
- Advanced texturing options with PBR support
- Auto-sizing and orientation

## Dependencies

- Express.js: Web server
- Three.js: 3D rendering
- Axios: HTTP requests
- Multer: File upload handling
- Dotenv: Environment variable management

## License

MIT 