const apiKeyInput = document.getElementById('apiKey');
const imageInput = document.getElementById('imageInput');
const testButton = document.getElementById('testButton');
const logsDiv = document.getElementById('logs');

const UPLOAD_URL = "https://api.tripo3d.ai/v2/openapi/upload"; // Using the URL from your example
const TASK_URL = 'https://api.tripo3d.ai/v2/openapi/task';

function logMessage(message, type = 'info') {
    const entry = document.createElement('span');
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    if (type === 'step') {
        entry.className = 'log-step';
    } else if (type === 'success') {
        entry.className = 'log-success';
    } else if (type === 'error') {
        entry.className = 'log-error';
    }
    logsDiv.appendChild(entry);
    logsDiv.appendChild(document.createElement('br')); // New line
    logsDiv.scrollTop = logsDiv.scrollHeight; // Scroll to bottom
}

async function runTest() {
    testButton.disabled = true;
    logsDiv.innerHTML = ''; // Clear previous logs

    const apiKey = apiKeyInput.value.trim();
    const imageFile = imageInput.files[0];

    if (!apiKey) {
        logMessage("API Key is missing.", 'error');
        testButton.disabled = false;
        return;
    }
    if (!imageFile) {
        logMessage("No image file selected.", 'error');
        testButton.disabled = false;
        return;
    }

    const fileExtension = imageFile.name.split('.').pop().toLowerCase();
    if (!['jpg', 'jpeg', 'png'].includes(fileExtension)) {
         logMessage("Invalid file type. Please use JPG or PNG.", 'error');
         testButton.disabled = false;
         return;
    }
    const mimeType = fileExtension === 'png' ? 'image/png' : 'image/jpeg';

    logMessage(`Using API Key: ${apiKey.substring(0, 8)}...`, 'info');

    // --- Step 1: Upload Image ---
    logMessage("Step 1: Uploading Image...", 'step');
    let fileToken = null;
    try {
        const formData = new FormData();
        // Use Blob directly as per your example
        formData.append('file', imageFile, imageFile.name); // Sending raw file

        logMessage(`POST to ${UPLOAD_URL}`, 'info');
        logMessage(`Authorization: Bearer ${apiKey.substring(0, 8)}...`, 'info');
        logMessage(`Body: FormData with 'file' field (${imageFile.name}, ${mimeType})`, 'info');

        const uploadResponse = await fetch(UPLOAD_URL, {
            method: 'POST',
            headers: {
                // Content-Type is set by browser for FormData
                'Authorization': `Bearer ${apiKey}`,
            },
            body: formData,
        });

        logMessage(`Upload Response Status: ${uploadResponse.status} ${uploadResponse.statusText}`, uploadResponse.ok ? 'info' : 'error');

        const uploadData = await uploadResponse.json();
        logMessage(`Upload Response Body: ${JSON.stringify(uploadData, null, 2)}`, 'info');

        if (!uploadResponse.ok) {
            throw new Error(`Upload failed: ${uploadResponse.statusText} - ${JSON.stringify(uploadData)}`);
        }

        // IMPORTANT: Adjust this based on the ACTUAL successful upload response structure
        if (uploadData && uploadData.data && uploadData.data.file_token) {
            fileToken = uploadData.data.file_token;
            logMessage(`File Token received: ${fileToken}`, 'success');
        } else {
             throw new Error(`'file_token' not found in upload response data. Response: ${JSON.stringify(uploadData)}`);
        }

    } catch (error) {
        logMessage(`Error during Step 1 (Upload): ${error.message}`, 'error');
        console.error("Upload Error:", error);
        testButton.disabled = false;
        return; // Stop if upload fails
    }

    // --- Step 2: Create Task ---
    logMessage("Step 2: Creating Task...", 'step');
    try {
        const taskPayload = {
            type: 'image_to_model', // As per your example
            file: {
                type: fileExtension, // Use actual file extension
                file_token: fileToken
            }
        };

        logMessage(`POST to ${TASK_URL}`, 'info');
        logMessage(`Authorization: Bearer ${apiKey.substring(0, 8)}...`, 'info');
        logMessage(`Body: ${JSON.stringify(taskPayload, null, 2)}`, 'info');

        const taskResponse = await fetch(TASK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiKey
            },
            body: JSON.stringify(taskPayload)
        });

        logMessage(`Task Response Status: ${taskResponse.status} ${taskResponse.statusText}`, taskResponse.ok ? 'info' : 'error');

        const taskData = await taskResponse.json();
        logMessage(`Task Response Body: ${JSON.stringify(taskData, null, 2)}`, 'info');

        if (!taskResponse.ok) {
            throw new Error(`Task creation failed: ${taskResponse.statusText} - ${JSON.stringify(taskData)}`);
        }

        // IMPORTANT: Adjust based on ACTUAL success response structure for task creation
        if (taskData && taskData.data && taskData.data.task_id) {
             logMessage(`Task created successfully! Task ID: ${taskData.data.task_id}`, 'success');
        } else {
             throw new Error(`'task_id' not found in task response data. Response: ${JSON.stringify(taskData)}`);
        }

    } catch (error) {
        logMessage(`Error during Step 2 (Task Creation): ${error.message}`, 'error');
        console.error("Task Creation Error:", error);
    } finally {
        testButton.disabled = false;
    }
}

testButton.addEventListener('click', runTest);