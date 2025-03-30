require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 8000;

// API Key from .env file
const API_KEY = process.env.TRIPO_API_KEY;

// Simplified middleware setup
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

// Ensure upload directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Set up file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Basic health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Server is running',
        api_key: API_KEY ? 'present' : 'missing'
    });
});

// Test API endpoint
app.post('/api/generate', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No image uploaded' });
        }
        
        console.log(`Image received: ${req.file.originalname} (${req.file.size} bytes)`);
        
        // For now, let's return a mock successful response
        // In a real implementation, we would call the Tripo3D API
        return res.json({
            success: true,
            message: 'Image uploaded successfully - this is a mock response',
            taskId: 'mock-task-' + Date.now()
        });
    } catch (error) {
        console.error('Error processing upload:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Mock status endpoint
app.get('/api/status/:taskId', (req, res) => {
    const taskId = req.params.taskId;
    
    // Return a mock completed status after a delay
    // This allows testing the UI flow
    if (taskId.startsWith('mock-task')) {
        // Return a "processing" status initially to simulate API delay
        setTimeout(() => {
            res.json({
                success: true,
                status: 'completed',
                modelUrl: 'https://models.readyplayer.me/63c3a60c7354fd89f2ad9211.glb'
            });
        }, 2000);
    } else {
        res.status(404).json({ success: false, error: 'Unknown task ID' });
    }
});

// Catch-all route to ensure index.html is served
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(port, () => {
    console.log('------------------------------------------');
    console.log(`🚀 Server running at http://localhost:${port}`);
    console.log('API Key Status:', API_KEY ? 'Found ✅' : 'Missing ❌');
    console.log('------------------------------------------');
});