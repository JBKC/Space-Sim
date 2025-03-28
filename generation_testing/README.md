# Simplified 3D Model Generator

This application allows you to generate 3D models from images using the Hunyuan3D-2 API from Tencent. It has been simplified for better reliability and faster loading.

## Features

- Upload an image to generate a 3D model
- Interactive 3D viewer with orbit controls
- Test connection and load sample model functionality
- Simplified parameters for faster generation

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

## Troubleshooting

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

## License

This project is provided as-is with no warranty. Usage of the Hunyuan3D-2 API is subject to Tencent's terms of service. 