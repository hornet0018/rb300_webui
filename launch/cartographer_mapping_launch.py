from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.conditions import IfCondition
from launch.substitutions import LaunchConfiguration, PathJoinSubstitution
from launch_ros.actions import Node
from launch_ros.substitutions import FindPackageShare


def generate_launch_description():
    """RB300 用 Cartographer マッピング (スキャンマッチング) を起動する。

    使用例:
      ros2 launch rb300_webui cartographer_mapping_launch.py
    """
    configuration_basename = LaunchConfiguration('configuration_basename')
    use_sim_time = LaunchConfiguration('use_sim_time')
    launch_occupancy_grid = LaunchConfiguration('launch_occupancy_grid')

    pkg_share = FindPackageShare('rb300_webui')
    configuration_directory = PathJoinSubstitution([pkg_share, 'config'])

    return LaunchDescription([
        DeclareLaunchArgument(
            'configuration_basename',
            default_value='rb300_2d.lua',
            description='Cartographer configuration file (Lua)'
        ),
        DeclareLaunchArgument(
            'use_sim_time',
            default_value='false',
            description='Use simulation time'
        ),
        DeclareLaunchArgument(
            'launch_occupancy_grid',
            default_value='true',
            description='Launch the occupancy grid node (publishes /map)'
        ),
        Node(
            package='cartographer_ros',
            executable='cartographer_node',
            name='cartographer_node',
            output='screen',
            parameters=[{'use_sim_time': use_sim_time}],
            arguments=[
                '-configuration_directory', configuration_directory,
                '-configuration_basename', configuration_basename,
            ],
        ),
        Node(
            package='cartographer_ros',
            executable='cartographer_occupancy_grid_node',
            name='cartographer_occupancy_grid_node',
            output='screen',
            condition=IfCondition(launch_occupancy_grid),
        ),
    ])
