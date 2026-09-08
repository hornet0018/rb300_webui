from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.conditions import IfCondition
from launch.substitutions import LaunchConfiguration, PathJoinSubstitution
from launch_ros.actions import Node
from launch_ros.substitutions import FindPackageShare


def generate_launch_description():
    """保存した Cartographer 地図 (.pbstream) を読み込み、ローカライゼーションを行う。

    ロボットはマッピング時の開始位置付近で起動する必要がある
    (Cartographer は保存済みの凍結トラジェクトリに新しいトラジェクトリを追加して
     位置推定する方式のため、AMCL のようなグローバル再配置はない)。

    使用例:
      ros2 launch rb300_webui localization_launch.py \
        load_state_filename:=/home/sunrise/.rb300/maps/room1.pbstream
    """
    load_state_filename = LaunchConfiguration('load_state_filename')
    configuration_basename = LaunchConfiguration('configuration_basename')
    use_sim_time = LaunchConfiguration('use_sim_time')
    launch_occupancy_grid = LaunchConfiguration('launch_occupancy_grid')

    pkg_share = FindPackageShare('rb300_webui')
    configuration_directory = PathJoinSubstitution([pkg_share, 'config'])

    return LaunchDescription([
        DeclareLaunchArgument(
            'load_state_filename',
            description='Path to the saved Cartographer map (.pbstream)'
        ),
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
                '-load_state_filename', load_state_filename,
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
