#!/usr/bin/env python3

from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def generate_launch_description():
    return LaunchDescription([
        DeclareLaunchArgument(
            'port',
            default_value='9090',
            description='WebSocket port'
        ),
        DeclareLaunchArgument(
            'address',
            default_value='',
            description='WebSocket address (empty for all interfaces)'
        ),
        DeclareLaunchArgument(
            'delay',
            default_value='3',
            description='Delay in seconds before launching'
        ),

        Node(
            package='rosbridge_server',
            executable='rosbridge_websocket',
            parameters=[{
                'port': LaunchConfiguration('port'),
                'address': LaunchConfiguration('address'),
                'delay': LaunchConfiguration('delay'),
                'fragment_timeout': 600,
                'delay_between_messages': 0,
                'max_message_size': 10000000,
                'uncompress_timeout': 0,
            }],
            output='screen'
        ),
    ])
