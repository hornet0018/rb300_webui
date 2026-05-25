#!/bin/bash
# RB300 Web Viewer Launcher

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$SCRIPT_DIR/../../share/rb300_webui/web"
DEV_MODE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --dev)
      DEV_MODE=true
      shift
      ;;
    *)
      shift
      ;;
  esac
done

echo "Starting RB300 Web Viewer..."
echo "Script directory: $SCRIPT_DIR"
echo "Web directory: $WEB_DIR"
echo "Dev mode: $DEV_MODE"
echo ""

if [ ! -d "$WEB_DIR" ]; then
    echo "Error: Web directory not found!"
    echo "Falling back to source directory..."
    WEB_DIR="/home/sunrise/ros2_ws/src/rb300_ros2/rb300_webui/web"
fi

echo "Using web directory: $WEB_DIR"
echo ""

# Kill any existing processes on ports
fuser -k 9090/tcp 2>/dev/null
fuser -k 8000/tcp 2>/dev/null
fuser -k 5173/tcp 2>/dev/null
sleep 1

# Start rosbridge
source /opt/ros/humble/setup.bash
source ~/ros2_ws/install/setup.bash

ros2 launch rb300_webui web_bridge.launch.py web_dev:=$DEV_MODE &
ROSBRIDGE_PID=$!

if [ "$DEV_MODE" = true ]; then
    echo "Open your browser to: http://localhost:5173"
else
    echo "Open your browser to: http://localhost:8000"
fi

echo ""
echo "Press Ctrl+C to stop"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Stopping services..."
    kill $ROSBRIDGE_PID 2>/dev/null
    fuser -k 9090/tcp 2>/dev/null
    fuser -k 8000/tcp 2>/dev/null
    fuser -k 5173/tcp 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for processes
wait $ROSBRIDGE_PID
