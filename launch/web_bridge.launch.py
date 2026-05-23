#!/usr/bin/env python3

import os
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, ExecuteProcess
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node
from ament_index_python.packages import get_package_share_directory


def generate_launch_description():
    pkg_share = get_package_share_directory('rb300_webui')
    web_dir = os.path.join(pkg_share, 'web')

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
        DeclareLaunchArgument(
            'web_port',
            default_value='8080',
            description='HTTP server port for web UI'
        ),

        # ROSBridge WebSocket server
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

        # HTTP server for index.html
        ExecuteProcess(
            cmd=[
                'python3', '-m', 'http.server',
                LaunchConfiguration('web_port'),
                '--directory', web_dir
            ],
            output='screen'
        ),
    ])
