#!/bin/bash
# Start both the Node.js server and Python direct API server

# Function to handle termination
cleanup() {
  echo "Shutting down servers..."
  kill $NODE_PID $PYTHON_PID 2>/dev/null
  exit 0
}

# Set up trap for SIGINT (Ctrl+C) and SIGTERM
trap cleanup SIGINT SIGTERM

echo "=== Starting Hunyuan3D Generation System ==="
echo

# Check for Python
if ! command -v python3 &> /dev/null; then
  echo "Error: Python 3 is required but not found"
  exit 1
fi

# Check for Node.js
if ! command -v node &> /dev/null; then
  echo "Error: Node.js is required but not found"
  exit 1
fi

# Install Python dependencies if needed
if [ ! -f ".python_deps_installed" ]; then
  echo "Installing Python dependencies..."
  python3 -m pip install -r requirements.txt && touch .python_deps_installed
fi

# Install Node.js dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing Node.js dependencies..."
  npm install
fi

# Start Python API server
echo "Starting Python direct API server on port 8000..."
python3 direct_api_server.py --host 0.0.0.0 --port 8000 &
PYTHON_PID=$!

# Wait a moment to ensure Python server starts
sleep 2

# Check if Python server started successfully
if ! curl -s http://localhost:8000/health > /dev/null; then
  echo "Error: Failed to start Python API server"
  kill $PYTHON_PID 2>/dev/null
  exit 1
fi
echo "Python API server running with PID $PYTHON_PID"

# Start Node.js server
echo "Starting Node.js server on port 3000..."
node server.js &
NODE_PID=$!

# Wait a moment to ensure Node.js server starts
sleep 2

# Check if Node.js server started successfully
if ! curl -s http://localhost:3000 > /dev/null; then
  echo "Error: Failed to start Node.js server"
  kill $NODE_PID $PYTHON_PID 2>/dev/null
  exit 1
fi
echo "Node.js server running with PID $NODE_PID"

echo
echo "=== All servers started successfully ==="
echo "Python direct API server: http://localhost:8000"
echo "Node.js application: http://localhost:3000"
echo
echo "Press Ctrl+C to stop all servers"

# Wait for both processes to finish (which will only happen if they crash)
wait $NODE_PID $PYTHON_PID

# If we get here, one of the servers crashed
echo "Error: One of the servers exited unexpectedly"
cleanup 