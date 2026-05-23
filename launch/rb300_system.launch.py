#!/usr/bin/env python3

import os
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription
from launch.substitutions import LaunchConfiguration
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch_ros.actions import Node
from ament_index_python import get_package_share_directory
from ament_index_python.packages import get_package_share_path


def generate_launch_description():
    # RPLidar Launch
    rplidar_launch = IncludeLaunchDescription(
        PythonLaunchDescriptionSource([
            get_package_share_directory('rplidar_ros'),
            '/launch/rplidar_c1_launch.py'
        ]),
        launch_arguments={
            'serial_port': LaunchConfiguration('rplidar_serial_port'),
            'serial_baudrate': LaunchConfiguration('rplidar_baudrate'),
            'frame_id': LaunchConfiguration('rplidar_frame_id'),
            'inverted': LaunchConfiguration('rplidar_inverted'),
            'angle_compensate': LaunchConfiguration('rplidar_angle_compensate'),
            'scan_mode': LaunchConfiguration('rplidar_scan_mode'),
            'flip_x_axis': LaunchConfiguration('rplidar_flip_x_axis'),
        }.items()
    )

    # ESP Serial Launch
    esp_serial_launch = IncludeLaunchDescription(
        PythonLaunchDescriptionSource([
            get_package_share_directory('esp_serial_v2_cpp'),
            '/launch/esp_serial_launch.py'
        ]),
        launch_arguments={
            'serial_port': LaunchConfiguration('esp_serial_port'),
            'baud_rate': LaunchConfiguration('esp_baud_rate'),
            'wheel_radius': LaunchConfiguration('wheel_radius'),
            'wheel_separation': LaunchConfiguration('wheel_separation'),
            'max_rpm': LaunchConfiguration('max_rpm'),
            'update_rate': LaunchConfiguration('update_rate'),
            'cmd_vel_timeout': LaunchConfiguration('cmd_vel_timeout'),
            'invert_motor_l': LaunchConfiguration('invert_motor_l'),
            'invert_motor_r': LaunchConfiguration('invert_motor_r'),
            'pulses_per_rev': LaunchConfiguration('pulses_per_rev'),
        }.items()
    )

    # Get paths
    rb300_share_path = get_package_share_path('rb300_webui')
    urdf_path = os.path.join(rb300_share_path, 'urdf', 'rb300.urdf.xacro')

    # Robot State Publisher
    robot_state_publisher = Node(
        package='robot_state_publisher',
        executable='robot_state_publisher',
        parameters=[{'robot_description': open(urdf_path).read()}],
        output='screen'
    )

    # Odometry Publisher
    odometry_publisher = Node(
        package='rb300_webui',
        executable='odometry_publisher',
        parameters=[{
            'wheel_radius': LaunchConfiguration('wheel_radius'),
            'wheel_separation': LaunchConfiguration('wheel_separation'),
            'publish_rate': LaunchConfiguration('odometry_publish_rate'),
        }],
        output='screen'
    )

    # System Monitor
    system_monitor = Node(
        package='rb300_webui',
        executable='system_monitor',
        parameters=[{
            'publish_rate': 1.0,
        }],
        output='screen'
    )

    return LaunchDescription([
        # RPLidar Arguments
        DeclareLaunchArgument(
            'rplidar_serial_port',
            default_value='/dev/rplidar_c1',
            description='Serial port for RPLidar'
        ),
        DeclareLaunchArgument(
            'rplidar_baudrate',
            default_value='460800',
            description='Baud rate for RPLidar'
        ),
        DeclareLaunchArgument(
            'rplidar_frame_id',
            default_value='laser',
            description='Frame ID for RPLidar'
        ),
        DeclareLaunchArgument(
            'rplidar_inverted',
            default_value='false',
            description='Invert RPLidar scan data'
        ),
        DeclareLaunchArgument(
            'rplidar_angle_compensate',
            default_value='true',
            description='Enable angle compensation'
        ),
        DeclareLaunchArgument(
            'rplidar_scan_mode',
            default_value='Standard',
            description='RPLidar scan mode'
        ),
        DeclareLaunchArgument(
            'rplidar_flip_x_axis',
            default_value='true',
            description='Flip scan data on X axis'
        ),

        # ESP Serial Arguments
        DeclareLaunchArgument(
            'esp_serial_port',
            default_value='/dev/esp32_serial',
            description='Serial port for ESP32'
        ),
        DeclareLaunchArgument(
            'esp_baud_rate',
            default_value='115200',
            description='Baud rate for ESP32'
        ),
        DeclareLaunchArgument(
            'wheel_radius',
            default_value='0.0473',
            description='Wheel radius in meters'
        ),
        DeclareLaunchArgument(
            'wheel_separation',
            default_value='0.1796',
            description='Wheel separation in meters'
        ),
        DeclareLaunchArgument(
            'max_rpm',
            default_value='115',
            description='Maximum motor RPM'
        ),
        DeclareLaunchArgument(
            'update_rate',
            default_value='50.0',
            description='Serial read rate in Hz'
        ),
        DeclareLaunchArgument(
            'pulses_per_rev',
            default_value='32767.0',
            description='Pulses per revolution for encoder (0-32767 = 0-360 deg)'
        ),
        DeclareLaunchArgument(
            'cmd_vel_timeout',
            default_value='0.5',
            description='Timeout for cmd_vel in seconds'
        ),
        DeclareLaunchArgument(
            'invert_motor_l',
            default_value='true',
            description='Invert left motor rotation'
        ),
        DeclareLaunchArgument(
            'invert_motor_r',
            default_value='true',
            description='Invert right motor rotation'
        ),
        DeclareLaunchArgument(
            'odometry_publish_rate',
            default_value='50.0',
            description='Odometry publish rate in Hz'
        ),

        # Launch nodes
        rplidar_launch,
        esp_serial_launch,
        robot_state_publisher,
        odometry_publisher,
        system_monitor,
    ])
