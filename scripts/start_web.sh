#!/bin/bash
# RB300 Web Viewer Launcher

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$SCRIPT_DIR/../../share/rb300_webui/web"

echo "Starting RB300 Web Viewer..."
echo "Script directory: $SCRIPT_DIR"
echo "Web directory: $WEB_DIR"
echo ""

if [ ! -d "$WEB_DIR" ]; then
    echo "Error: Web directory not found!"
    echo "Falling back to source directory..."
    WEB_DIR="/home/sunrise/ros2_ws/src/rb300_ros2/rb300_webui/web"
fi

echo "Using web directory: $WEB_DIR"
echo ""
echo "Starting rosbridge on port 9090..."
echo "Starting HTTP server on port 8000..."
echo ""
echo "Open your browser to: http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Kill any existing processes on ports
fuser -k 9090/tcp 2>/dev/null
fuser -k 8000/tcp 2>/dev/null
sleep 1

# Start rosbridge
source /opt/ros/humble/setup.bash
source ~/ros2_ws/install/setup.bash

ros2 launch rb300_webui web_bridge.launch.py &
ROSBRIDGE_PID=$!

# Start HTTP server
cd "$WEB_DIR"
python3 -m http.server 8000 &
HTTP_PID=$!

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Stopping services..."
    kill $ROSBRIDGE_PID 2>/dev/null
    kill $HTTP_PID 2>/dev/null
    fuser -k 9090/tcp 2>/dev/null
    fuser -k 8000/tcp 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for processes
wait $ROSBRIDGE_PID $HTTP_PID
