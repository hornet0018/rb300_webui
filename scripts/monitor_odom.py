#!/usr/bin/env python3
import rclpy
from rclpy.node import Node
from nav_msgs.msg import Odometry
import math

class OdomMonitor(Node):
    def __init__(self):
        super().__init__('odom_monitor')
        self.subscription = self.create_subscription(
            Odometry,
            '/odom',
            self.odom_callback,
            10)

        self.first_x = None
        self.first_y = None
        self.last_x = None
        self.last_y = None
        self.count = 0
        self.start_theta = None

        print("Listening to /odom...")
        print("Press Ctrl+C to show summary\n")

    def odom_callback(self, msg):
        x = msg.pose.pose.position.x
        y = msg.pose.pose.position.y

        # Get orientation (yaw)
        q = msg.pose.pose.orientation
        siny_cosp = 2 * (q.w * q.z + q.x * q.y)
        cosy_cosp = 1 - 2 * (q.y * q.y + q.z * q.z)
        theta = math.atan2(siny_cosp, cosy_cosp)

        if self.first_x is None:
            self.first_x = x
            self.first_y = y
            self.start_theta = theta

        self.last_x = x
        self.last_y = y
        self.count += 1

        # Calculate distance from start
        dx = x - self.first_x
        dy = y - self.first_y
        dist = math.sqrt(dx*dx + dy*dy)

        # Print every 10 messages
        if self.count % 10 == 0:
            print(f"[{self.count:4d}] x={x:8.4f}, y={y:8.4f}, theta={math.degrees(theta):7.2f}° | dist_from_start={dist:8.4f}m")

    def show_summary(self):
        if self.first_x is None:
            print("\nNo odom messages received!")
            return

        dx = self.last_x - self.first_x
        dy = self.last_y - self.first_y
        dist = math.sqrt(dx*dx + dy*dy)

        print(f"\n{'='*60}")
        print(f"Summary:")
        print(f"{'='*60}")
        print(f"Messages received:  {self.count}")
        print(f"First position:     x={self.first_x:.6f}, y={self.first_y:.6f}")
        print(f"Last position:      x={self.last_x:.6f}, y={self.last_y:.6f}")
        print(f"Delta:              dx={dx:.6f}, dy={dy:.6f}")
        print(f"Total distance:     {dist:.6f} m")
        print(f"{'='*60}")

def main(args=None):
    rclpy.init(args=args)
    monitor = OdomMonitor()

    try:
        rclpy.spin(monitor)
    except KeyboardInterrupt:
        monitor.show_summary()
    finally:
        monitor.destroy_node()
        rclpy.shutdown()

if __name__ == '__main__':
    main()
