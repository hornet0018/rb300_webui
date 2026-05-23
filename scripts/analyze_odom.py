#!/usr/bin/env python3
import rclpy
from rclpy.serialization import deserialize_message
from rosidl_runtime_py.utilities import get_message
import rosbag2_py
from nav_msgs.msg import Odometry
import math

def analyze_bag(bag_path):
    storage_options = rosbag2_py.StorageOptions(uri=bag_path, storage_id='sqlite3')
    converter_options = rosbag2_py.ConverterOptions('', '')
    reader = rosbag2_py.SequentialReader()
    reader.open(storage_options, converter_options)

    first_pose = None
    last_pose = None
    count = 0

    while reader.has_next():
        topic, data, timestamp = reader.read_next()
        if topic == '/odom':
            msg = deserialize_message(data, Odometry)
            if first_pose is None:
                first_pose = msg.pose.pose.position
            last_pose = msg.pose.pose.position
            count += 1

    if first_pose and last_pose:
        dx = last_pose.x - first_pose.x
        dy = last_pose.y - first_pose.y
        distance = math.sqrt(dx*dx + dy*dy)

        print(f"Total messages: {count}")
        print(f"First position: x={first_pose.x:.6f}, y={first_pose.y:.6f}")
        print(f"Last position:  x={last_pose.x:.6f}, y={last_pose.y:.6f}")
        print(f"Delta:          dx={dx:.6f}, dy={dy:.6f}")
        print(f"\nDistance traveled: {distance:.6f} meters")
        print(f"Expected:          1.0 meters (0.1 m/s × 10s)")
        print(f"Error:            {abs(distance - 1.0):.6f} meters ({abs(distance - 1.0)*100:.2f}%)")

if __name__ == '__main__':
    import sys
    if len(sys.argv) < 2:
        print("Usage: analyze_odom.py <bag_path>")
        sys.exit(1)

    analyze_bag(sys.argv[1])
