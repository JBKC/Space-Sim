# Trellis 3D Model Generator

This application allows you to generate 3D models from images using the Trellis API.

## Features

- Drag and drop image upload interface
- 3D model generation from images using Microsoft's Trellis 3D AI
- Interactive 3D model viewer with rotation, pan, and zoom controls
- Real-time status updates during model generation
- Secure API key handling through a server

## Installation

1. Make sure you have Node.js installed (v14+ recommended)
2. Clone or download this repository
3. Navigate to the project directory
4. Install dependencies:
   ```
   npm install
   ```
5. Ensure the `.env` file exists with your Trellis API key:
   ```
   TRELLIS_API_KEY=your_api_key_here
   ```

## Running the Application

1. Start the server:
   ```
   node server.js
   ```
2. Open your browser and navigate to `http://localhost:3000`
3. Upload an image by dragging and dropping or using the file selector
4. Click the "Generate 3D Model" button
5. Wait for the model to be generated (this can take a few minutes)
6. The 3D model will be displayed in the viewer when ready

## Alternative Direct Client Option

If you're having issues with the server approach, you can use the direct client version:

1. Open `direct-client.html` directly in your browser
2. This version communicates directly with the Trellis API without a server
3. All features are the same, but the API key is exposed in the client-side code

## API Endpoints

The application interacts with the Trellis API using the following endpoints:

1. **Create Task (Server-Side)**: `POST https://api.piapi.ai/api/v1/task`
   - This endpoint is used to submit an image and create a new 3D model generation task
   - The response contains a `task_id` that is used to check the status
   - Request is made from the server to protect the API key

2. **Check Status (Server-Side)**: `GET https://api.piapi.ai/api/v1/task/{task_id}`
   - Replace `{task_id}` with the actual task ID received from the create task endpoint
   - This endpoint returns the current status of the task and, when completed, the output model URL
   - Request is made from the server to protect the API key

3. **Client-Side API**: 
   - Client ↔ Server Create: `POST http://localhost:3000/api/generate`
   - Client ↔ Server Status Check: `GET http://localhost:3000/api/status/{taskId}`
   - The status endpoint uses a path parameter (not a query parameter)

## API Response Format

The Trellis API returns responses in a nested format like this:

```json
{
  "code": 200,
  "data": {
    "task_id": "c1641492-2bd4-4469-80a3-3d7114446eae",
    "model": "Qubico/trellis",
    "task_type": "image-to-model",
    "status": "pending",
    "config": {
      "service_mode": "",
      "webhook_config": {
        "endpoint": "",
        "secret": ""
      }
    },
    "input": {
      "image": "[BASE64_IMAGE_DATA]"
    },
    "output": null,
    "meta": {
      "created_at": "2025-03-29T11:27:13.627104381Z",
      "started_at": "0001-01-01T00:00:00Z",
      "ended_at": "0001-01-01T00:00:00Z"
    }
  },
  "message": "success"
}
```

The application is specifically designed to handle this nested structure, extracting the `task_id` from within the `data` property.

## Troubleshooting

If you encounter the error "No task ID returned from server":

1. **Check Server Logs**: Look at the terminal where your server is running for detailed API responses and errors
   
2. **Check Browser Console**: Open the browser console (F12) and look for:
   - The raw API responses
   - Any errors parsing the response
   - The exact structure of the response

3. **Verify the API Response Format**: The Trellis API returns data in a nested structure with:
   ```
   { "code": 200, "data": { "task_id": "your-task-id-here", ... }, "message": "success" }
   ```
   
4. **Try the Direct Client**: Use the `direct-client.html` file to bypass the server and communicate directly with the API
   
5. **API Key Issues**: Ensure your API key in the `.env` file is:
   - Correct and properly formatted
   - Not expired
   - Has the right permissions

6. **Image Requirements**:
   - Make sure your image is not too large (max 1024x1024 pixels)
   - Use common formats like JPEG or PNG
   - Ensure the image is appropriate for 3D generation (clear object with good contrast)

7. **Network Issues**:
   - Check if your firewall or network settings might be blocking the API connection
   - Ensure you have a stable internet connection

## Interacting with 3D Models

- **Rotate**: Click and drag with the left mouse button
- **Pan**: Click and drag with the right mouse button or hold Shift while dragging
- **Zoom**: Use the mouse wheel or trackpad gestures

## Technologies Used

- Frontend: HTML, CSS, JavaScript, Three.js
- Backend: Node.js, Express
- 3D Generation: PiAPI's Trellis 3D model generation API

## Notes

- Image processing may take several minutes depending on the complexity
- Maximum image size: 1024x1024 pixels
- The generated 3D model is in GLB format

## Requirements

- Node.js v14+
- Modern web browser with WebGL support
- Internet connection for API access

## API Response Structure

The Trellis API response is structured with a nested format:

```json
{
  "code": 200,
  "data": {
    "task_id": "c1641492-2bd4-4469-80a3-3d7114446eae",
    "model": "Qubico/trellis",
    "task_type": "image-to-model",
    "status": "pending",
    ...
  },
  "message": "success"
}
```

The application is designed to handle this nested structure, extracting the `task_id` from the `data` property.

The application has been updated to handle the nested response structure where the task_id is inside a data property. 