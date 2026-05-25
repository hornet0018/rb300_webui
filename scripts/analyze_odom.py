#!/usr/bin/env python3
import rclpy
from rclpy.serialization import deserialize_message
from rosidl_runtime_py.utilities import get_message
import rosbag2_py
from nav_msgs.msg import Odometry
import math
import sys

def analyze_bag(bag_path, target_distance=1.0, target_rotation=None):
    storage_options = rosbag2_py.StorageOptions(uri=bag_path, storage_id='sqlite3')
    converter_options = rosbag2_py.ConverterOptions('', '')
    reader = rosbag2_py.SequentialReader()
    reader.open(storage_options, converter_options)

    first_pose = None
    last_pose = None
    first_orientation = None
    last_orientation = None
    count = 0

    while reader.has_next():
        topic, data, timestamp = reader.read_next()
        if topic == '/odom':
            msg = deserialize_message(data, Odometry)
            if first_pose is None:
                first_pose = msg.pose.pose.position
                first_orientation = msg.pose.pose.orientation
            last_pose = msg.pose.pose.position
            last_orientation = msg.pose.pose.orientation
            count += 1

    if first_pose is None or last_pose is None:
        print(f"ERROR: No /odom messages found in {bag_path}")
        return None

    dx = last_pose.x - first_pose.x
    dy = last_pose.y - first_pose.y
    distance = math.sqrt(dx*dx + dy*dy)

    # Calculate yaw from quaternion
    def quaternion_to_yaw(q):
        siny_cosp = 2.0 * (q.w * q.z + q.x * q.y)
        cosy_cosp = 1.0 - 2.0 * (q.y * q.y + q.z * q.z)
        return math.atan2(siny_cosp, cosy_cosp)

    yaw_start = quaternion_to_yaw(first_orientation)
    yaw_end = quaternion_to_yaw(last_orientation)
    delta_yaw = yaw_end - yaw_start

    print(f"\n=== Bag Analysis: {bag_path} ===")
    print(f"Total messages: {count}")
    print(f"Start position: x={first_pose.x:.6f}, y={first_pose.y:.6f}, yaw={math.degrees(yaw_start):.2f}deg")
    print(f"End position:   x={last_pose.x:.6f}, y={last_pose.y:.6f}, yaw={math.degrees(yaw_end):.2f}deg")

    print(f"\n--- Linear ---")
    print(f"Delta:          dx={dx:.6f}, dy={dy:.6f}")
    print(f"Distance:       {distance:.6f} m")
    print(f"Target:         {target_distance} m")
    print(f"Error:          {abs(distance - target_distance):.6f} m ({(distance/target_distance - 1.0)*100:.2f}%)")

    if target_distance != 0:
        linear_scale = target_distance / distance if distance != 0 else 1.0
        print(f"Radius scale:   {linear_scale:.6f}  (new_r = old_r * {linear_scale:.6f})")

    print(f"\n--- Rotation ---")
    print(f"Delta yaw:      {math.degrees(delta_yaw):.2f}deg ({delta_yaw:.6f} rad)")
    if target_rotation is not None:
        print(f"Target:         {math.degrees(target_rotation):.2f}deg ({target_rotation:.6f} rad)")
        print(f"Error:          {abs(delta_yaw - target_rotation):.6f} rad ({abs(math.degrees(delta_yaw - target_rotation)):.2f}deg)")
        if delta_yaw != 0:
            separation_scale = target_rotation / delta_yaw
            print(f"Sep. scale:     {separation_scale:.6f}  (new_sep = old_sep * {separation_scale:.6f})")

    return {
        'distance': distance,
        'delta_yaw': delta_yaw,
    }

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Analyze odometry from a rosbag2 file.')
    parser.add_argument('bag_path', help='Path to rosbag2 directory')
    parser.add_argument('-d', '--distance', type=float, default=1.0, help='Target distance in meters (default: 1.0)')
    parser.add_argument('-r', '--rotation', type=float, default=None, help='Target rotation in radians (e.g. 6.283 for 360deg)')
    args = parser.parse_args()

    analyze_bag(args.bag_path, target_distance=args.distance, target_rotation=args.rotation)
