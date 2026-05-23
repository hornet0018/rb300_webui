from launch import LaunchDescription
from launch_ros.actions import Node


def generate_launch_description():
    return LaunchDescription([
        Node(
            package='rb300_webui',
            executable='webui_node',
            name='rb300_webui',
            output='screen',
        ),
    ])
