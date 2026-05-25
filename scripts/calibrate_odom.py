#!/usr/bin/env python3
"""
Odometry Calibration Helper

This script analyzes rosbag2 recordings and proposes new calibration parameters.

Usage (linear calibration):
  1. Run robot straight for 1.0 m (e.g. `ros2 topic pub /cmd_vel geometry_msgs/msg/Twist '{linear: {x: 0.1}}'` for 10s)
  2. Record bag: `ros2 bag record /odom`
  3. Run: `python3 calibrate_odom.py linear <bag_path> --target-distance 1.0`

Usage (rotation calibration):
  1. Rotate robot 360 degrees (e.g. `ros2 topic pub /cmd_vel geometry_msgs/msg/Twist '{angular: {z: 0.628}}'` for 10s)
  2. Record bag: `ros2 bag record /odom`
  3. Run: `python3 calibrate_odom.py rotation <bag_path> --target-rotation 6.283185`

To apply the new values, edit:
  esp_serial_v2_cpp/config/odometry_calibration.yaml
and restart the launch files.
"""

import math
import sys
import argparse
from analyze_odom import analyze_bag

# Current calibration defaults (must match the YAML defaults)
DEFAULT_WHEEL_RADIUS = 0.0473
DEFAULT_WHEEL_SEPARATION = 0.1796


def compute_linear_calibration(bag_path, target_distance, current_radius=DEFAULT_WHEEL_RADIUS):
    result = analyze_bag(bag_path, target_distance=target_distance)
    if result is None:
        return None

    measured = result['distance']
    if measured == 0:
        print("ERROR: measured distance is zero")
        return None

    scale = target_distance / measured
    new_radius = current_radius * scale

    print(f"\n=== Proposed Linear Calibration ===")
    print(f"Current wheel_radius: {current_radius:.6f} m")
    print(f"Measured distance:    {measured:.6f} m")
    print(f"Target distance:      {target_distance:.6f} m")
    print(f"Correction scale:     {scale:.6f}")
    print(f"New wheel_radius:     {new_radius:.6f} m")

    return new_radius


def compute_rotation_calibration(bag_path, target_rotation, current_separation=DEFAULT_WHEEL_SEPARATION):
    result = analyze_bag(bag_path, target_distance=0.0, target_rotation=target_rotation)
    if result is None:
        return None

    measured_yaw = result['delta_yaw']
    if measured_yaw == 0:
        print("ERROR: measured rotation is zero")
        return None

    scale = target_rotation / measured_yaw
    new_separation = current_separation * scale

    print(f"\n=== Proposed Rotation Calibration ===")
    print(f"Current wheel_separation: {current_separation:.6f} m")
    print(f"Measured rotation:        {math.degrees(measured_yaw):.2f}deg ({measured_yaw:.6f} rad)")
    print(f"Target rotation:          {math.degrees(target_rotation):.2f}deg ({target_rotation:.6f} rad)")
    print(f"Correction scale:         {scale:.6f}")
    print(f"New wheel_separation:     {new_separation:.6f} m")

    return new_separation


def main():
    parser = argparse.ArgumentParser(description='Odometry calibration helper')
    subparsers = parser.add_subparsers(dest='command', required=True)

    linear_parser = subparsers.add_parser('linear', help='Calibrate wheel radius using straight-line run')
    linear_parser.add_argument('bag_path', help='Path to rosbag2 directory')
    linear_parser.add_argument('--target-distance', type=float, default=1.0, help='Target distance in meters')
    linear_parser.add_argument('--current-radius', type=float, default=DEFAULT_WHEEL_RADIUS, help='Current wheel radius')

    rotation_parser = subparsers.add_parser('rotation', help='Calibrate wheel separation using in-place rotation')
    rotation_parser.add_argument('bag_path', help='Path to rosbag2 directory')
    rotation_parser.add_argument('--target-rotation', type=float, default=2*math.pi, help='Target rotation in radians (default: 2*pi = 360deg)')
    rotation_parser.add_argument('--current-separation', type=float, default=DEFAULT_WHEEL_SEPARATION, help='Current wheel separation')

    args = parser.parse_args()

    if args.command == 'linear':
        compute_linear_calibration(args.bag_path, args.target_distance, args.current_radius)
    elif args.command == 'rotation':
        compute_rotation_calibration(args.bag_path, args.target_rotation, args.current_separation)


if __name__ == '__main__':
    main()
