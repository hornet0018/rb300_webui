-- RB300 用 Cartographer 2D 設定
-- 前提: RPLidar C1 (/scan) + ESP32 オドメトリ (/odom, odom->base_link TF)
--       IMU はなし (use_imu_data = false)
--
-- テンプレート (map_builder.lua / trajectory_builder.lua) は
-- cartographer_ros パッケージの configuration_files から解決される。
include "map_builder.lua"
include "trajectory_builder.lua"

options = {
  map_builder = MAP_BUILDER,
  trajectory_builder = TRAJECTORY_BUILDER,
  map_frame = "map",
  tracking_frame = "base_link",
  -- 外部オドメトリ (RB300 の odometry_publisher) が odom->base_link を配信する
  published_frame = "odom",
  odom_frame = "odom",
  provide_odom_frame = false,
  publish_frame_projected_to_2d = false,
  use_odometry = true,
  use_nav_sat = false,
  use_landmarks = false,
  num_laser_scans = 1,
  num_multi_echo_laser_scans = 0,
  num_subdivisions_per_laser_scan = 1,
  num_point_clouds = 0,
  lookup_transform_timeout_sec = 0.2,
  submap_publish_period_sec = 0.3,
  pose_publish_period_sec = 5e-3,
  trajectory_publish_period_sec = 30e-3,
  rangefinder_sampling_ratio = 1.,
  odometry_sampling_ratio = 1.,
  fixed_frame_pose_sampling_ratio = 1.,
  imu_sampling_ratio = 1.,
  landmarks_sampling_ratio = 1.,
}

-- IMU なし・オドメトリあり (ESP32 エンコーダ)
MAP_BUILDER.use_trajectory_builder_2d = true
TRAJECTORY_BUILDER_2D.use_imu_data = false

return options
