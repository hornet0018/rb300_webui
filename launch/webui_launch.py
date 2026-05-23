from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, ExecuteProcess
from launch.conditions import IfCondition
from launch.substitutions import LaunchConfiguration, PathJoinSubstitution
from launch_ros.actions import Node
from launch_ros.substitutions import FindPackageShare


def generate_launch_description():
    dev_arg = DeclareLaunchArgument(
        'dev',
        default_value='false',
        description='If true, also launch the Vite frontend dev server alongside the ROS node.',
    )
    dev = LaunchConfiguration('dev')

    pkg_share = FindPackageShare('rb300_webui')
    frontend_dir = PathJoinSubstitution([pkg_share, 'frontend'])

    return LaunchDescription([
        dev_arg,
        # ROS 2 WebUI ノード (Flask + Socket.IO)
        Node(
            package='rb300_webui',
            executable='webui_node',
            name='rb300_webui',
            output='screen',
        ),
        # 開発モード時: Vite 開発サーバーを同時起動
        ExecuteProcess(
            cmd=['npm', 'run', 'dev'],
            cwd=frontend_dir,
            output='screen',
            shell=True,
            condition=IfCondition(dev),
        ),
    ])
