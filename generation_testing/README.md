# Simplified 3D Model Generator

This application allows you to generate 3D models from images using the Hunyuan3D-2 API from Tencent. It has been simplified for better reliability and faster loading.

## Features

- Upload an image to generate a 3D model
- Interactive 3D viewer with orbit controls
- Test connection and load sample model functionality
- Simplified parameters for faster generation
- **NEW:** Alternative direct API implementation for more reliable connections

## Quick Start

1. Make sure you have a `.env` file with your Hugging Face API key:
   ```
   HUGGINGFACE_API_KEY=your_api_key_here
   ```
2. Install dependencies:
   ```
   npm install
   ```
3. Start the server:
   ```
   npm start
   ```
4. Open your browser and navigate to `http://localhost:3000`

## Using the Direct API Approach (Alternative)

In addition to the default Gradio client implementation, this application now includes a direct API implementation that can be more reliable in some cases. There are two ways to use this:

### Option 1: Self-hosted Python server (recommended)

1. Install Python 3.8+ and the required dependencies:
   ```
   pip install -r requirements.txt
   ```

2. Start the Python server (in a separate terminal):
   ```
   python direct_api_server.py
   ```

3. Update your `.env` file to use the direct API server:
   ```
   HUGGINGFACE_API_KEY=your_api_key_here
   DIRECT_API_URL=http://localhost:8000
   API_MODE=async
   ```

### Option 2: Implement your own server

If you want to run your own implementation of the Hunyuan3D API server, it needs to provide these endpoints:

- `POST /generate` - For synchronous model generation
- `POST /send` - For starting an asynchronous job
- `GET /status/{uid}` - For checking the status of an asynchronous job

See the `direct_api_server.py` file for a reference implementation.

## Troubleshooting

### Connection Issues with the Default API
- If you experience "Connection errored out" issues with the default implementation, try using the alternative direct API approach
- The direct API approach provides better error handling and more reliable connections

### Direct API Server Issues
- Check the server logs in `hunyuan3d_server.log`
- Ensure you have the correct Python dependencies installed
- Verify that your Hugging Face API key has appropriate permissions
- Make sure the `DIRECT_API_URL` in your `.env` file points to the correct server address

### Server Connection Issues
- Click the "Test Server Connection" button to verify if the server is running
- Check the server console for any error messages
- Ensure your Hugging Face API key is correct

### Loading Takes Too Long
- Use the "Load Sample Model" button to test if the 3D viewer is working correctly
- The model generation process can take several minutes depending on the image
- We've reduced some parameters for faster generation, but quality may be lower

### Model Display Issues
- If the model appears too small or large, refresh the page and try again
- The application automatically scales the model to fit the viewport
- Use mouse controls to adjust the view: left-click to rotate, right-click to pan, scroll to zoom

### "Cannot find module" Errors
- Run `npm install` again to ensure all dependencies are installed
- Check if the node_modules directory exists
- If needed, delete node_modules and package-lock.json, then run `npm install` again

## Technical Improvements

1. **Simplified API Integration**:
   - Reduced parameters for faster processing (fewer steps, lower resolution)
   - Better error handling and logging

2. **Enhanced Frontend**:
   - Added server connection status indicator
   - Test functionality for easier debugging
   - Cache-busting for model loading

3. **Optimized 3D Viewer**:
   - Improved model positioning
   - Better handling of model scaling
   - Enhanced error reporting

4. **Added Sample Model**:
   - Preloaded sample model for testing
   
5. **NEW: Alternative Direct API Approach**:
   - Custom FastAPI server implementation
   - Both synchronous and asynchronous modes
   - Better error handling and retry logic
   - Progress tracking and real-time status updates

## License

This project is provided as-is with no warranty. Usage of the Hunyuan3D-2 API is subject to Tencent's terms of service. 