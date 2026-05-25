# Odometry Calibration Guide

This document describes the calibration procedure for the RB300 odometry parameters (`wheel_radius` and `wheel_separation`).

## Overview

Odometry parameters are managed in a single YAML file:

```
esp_serial_v2_cpp/config/odometry_calibration.yaml
```

**Key advantage:** Updating values in this file does **not** require a rebuild. Just restart the launch files after editing.

## Prerequisites

- Robot is fully assembled and on a flat, clean floor.
- Motors and encoders are working correctly.
- ROS 2 environment is sourced (`source /opt/ros/humble/setup.bash && source install/setup.bash`).
- A tape measure or ruler for ground truth.
- (Optional) A protractor or printed 360-degree marker for rotation calibration.

---

## Step 1: Linear Calibration (wheel_radius)

The wheel radius directly affects **distance traveled** measurements. If the robot thinks it moved 1.0 m but actually moved 0.95 m, the radius is too large.

### Procedure

1. Place the robot on the floor and mark the starting position (e.g. rear axle center).
2. Open a terminal and start recording:
   ```bash
   ros2 bag record /odom -o straight_cal
   ```
3. In another terminal, send a constant linear velocity for a known duration:
   ```bash
   ros2 topic pub /cmd_vel geometry_msgs/msg/Twist "{linear: {x: 0.1}, angular: {z: 0.0}}"
   ```
4. Let the robot move exactly **1.0 meter** (use a tape measure).  
   At 0.1 m/s this takes 10 seconds.
5. Stop the cmd_vel publisher (`Ctrl+C`) and stop the bag recording (`Ctrl+C`).
6. Measure the actual distance traveled with a tape measure.

### Analyze

```bash
cd /home/sunrise/ros2_ws/src/rb300_ros2/rb300_webui/scripts
python3 calibrate_odom.py linear ~/rosbag2_straight_cal --target-distance 1.0
```

The script will print the measured distance and propose a new `wheel_radius`.

### Apply

1. Open `esp_serial_v2_cpp/config/odometry_calibration.yaml`.
2. Update `wheel_radius` under both `esp_serial_ros2` and `odometry_publisher`.
3. Add a comment with the calibration date and result.
4. Save the file.

---

## Step 2: Rotation Calibration (wheel_separation)

The wheel separation (tread) directly affects **rotation angle** measurements. If the robot thinks it rotated 360 degrees but only rotated 350, the separation is too small.

### Procedure

1. Place the robot on the floor. Mark a reference direction (e.g. align with a wall).
2. Open a terminal and start recording:
   ```bash
   ros2 bag record /odom -o rotate_cal
   ```
3. In another terminal, send a pure rotation command:
   ```bash
   ros2 topic pub /cmd_vel geometry_msgs/msg/Twist "{linear: {x: 0.0}, angular: {z: 0.628}}"
   ```
4. Let the robot rotate exactly **360 degrees** (one full turn).  
   At ~0.628 rad/s (36 deg/s) this takes 10 seconds.
5. Stop the cmd_vel publisher (`Ctrl+C`) and stop the bag recording (`Ctrl+C`).
6. Visually verify that the robot returned to the original orientation.

### Analyze

```bash
python3 calibrate_odom.py rotation ~/rosbag2_rotate_cal --target-rotation 6.283185
```

The script will print the measured rotation and propose a new `wheel_separation`.

### Apply

1. Open `esp_serial_v2_cpp/config/odometry_calibration.yaml`.
2. Update `wheel_separation` under both `esp_serial_ros2` and `odometry_publisher`.
3. Add a comment with the calibration date and result.
4. Save the file.

---

## Step 3: Restart and Verify

After updating the YAML file, restart the robot system so the new parameters are loaded:

```bash
ros2 launch rb300_webui rb300_system.launch.py
```

Repeat Steps 1 and 2 to verify that the error is now within acceptable limits (< 2%).

---

## Parameter File Format

```yaml
# esp_serial_v2_cpp/config/odometry_calibration.yaml

esp_serial_ros2:
  ros__parameters:
    wheel_radius: 0.0473
    wheel_separation: 0.1796

odometry_publisher:
  ros__parameters:
    wheel_radius: 0.0473
    wheel_separation: 0.1796
```

**Important:** Both sections must be updated together to keep the two odometry-related nodes synchronized.

---

## Tips

- Perform calibration on the **same floor type** you will use for normal operation (carpet vs. hard floor affects wheel slip).
- Make sure the **battery is fully charged**; voltage sag can affect motor speed consistency.
- Run each calibration **3 times** and average the results for higher accuracy.
- If you change tires or wheels, recalibrate.

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| Distance error > 5% | Wrong wheel_radius | Re-run linear calibration |
| Rotation error > 5% | Wrong wheel_separation | Re-run rotation calibration |
| Straight path drifts left/right | Unequal wheel diameters or motor speed mismatch | Check mechanical alignment, then consider adding `left_wheel_scale` / `right_wheel_scale` parameters (requires code modification) |
| Parameters not updating after YAML edit | Nodes not restarted | Kill all ROS 2 nodes and relaunch |
