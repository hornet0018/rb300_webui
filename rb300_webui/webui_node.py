import os
import rclpy
from rclpy.node import Node
from geometry_msgs.msg import Twist
from sensor_msgs.msg import BatteryState
from std_msgs.msg import String
from flask import Flask, send_from_directory
from flask_socketio import SocketIO
from flask_cors import CORS
import threading

# Resolve dist directory using ament_index (works after install too)
try:
    from ament_index_python.packages import get_package_share_directory
    pkg_share = get_package_share_directory('rb300_webui')
    dist_dir = os.path.join(pkg_share, 'dist')
except Exception:
    # Fallback for development / editable install
    _here = os.path.dirname(os.path.abspath(__file__))
    dist_dir = os.path.join(os.path.dirname(_here), 'dist')

app = Flask(__name__, static_folder=dist_dir)
# Enable CORS for development (Vite dev server on localhost:5173)
CORS(app, resources={r"/api/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*")


class WebUINode(Node):
    def __init__(self):
        super().__init__('rb300_webui_node')

        # Publishers
        self.cmd_vel_pub = self.create_publisher(Twist, 'cmd_vel', 10)

        # Subscribers
        self.battery_sub = self.create_subscription(
            BatteryState,
            'battery_state',
            self.battery_callback,
            10
        )
        self.status_sub = self.create_subscription(
            String,
            'robot_status',
            self.status_callback,
            10
        )

        self.get_logger().info('RB300 WebUI node started')

        # Start Flask server in a separate thread
        self.server_thread = threading.Thread(target=self.run_server)
        self.server_thread.daemon = True
        self.server_thread.start()

    def battery_callback(self, msg):
        data = {
            'voltage': msg.voltage,
            'percentage': msg.percentage,
            'status': msg.power_supply_status
        }
        socketio.emit('battery_update', data)
        self.get_logger().debug(f'Battery: {msg.voltage}V')

    def status_callback(self, msg):
        socketio.emit('status_update', {'status': msg.data})
        self.get_logger().debug(f'Status: {msg.data}')

    def run_server(self):
        socketio.run(app, host='0.0.0.0', port=5000, allow_unsafe_werkzeug=True)


# Serve React/Vite SPA (static files from dist/)
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path and os.path.exists(os.path.join(dist_dir, path)):
        return send_from_directory(dist_dir, path)
    return send_from_directory(dist_dir, 'index.html')


@socketio.on('cmd_vel')
def handle_cmd_vel(json):
    """Receive velocity command from web client and publish to ROS 2"""
    node = app.config.get('ros_node')
    if node is None:
        return

    twist = Twist()
    twist.linear.x = float(json.get('linear_x', 0.0))
    twist.angular.z = float(json.get('angular_z', 0.0))
    node.cmd_vel_pub.publish(twist)
    node.get_logger().debug(f'Published cmd_vel: linear={twist.linear.x}, angular={twist.angular.z}')


def main(args=None):
    rclpy.init(args=args)
    node = WebUINode()
    app.config['ros_node'] = node

    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        node.get_logger().info('Shutting down WebUI node')
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
