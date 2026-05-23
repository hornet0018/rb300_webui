cmake_minimum_required(VERSION 3.8)
project(rb300_webui)

if(CMAKE_COMPILER_IS_GNUCXX OR CMAKE_CXX_COMPILER_ID MATCHES "Clang")
  add_compile_options(-Wall -Wextra -Wpedantic)
endif()

find_package(ament_cmake REQUIRED)
find_package(rclcpp REQUIRED)
find_package(nav_msgs REQUIRED)
find_package(geometry_msgs REQUIRED)
find_package(tf2_ros REQUIRED)
find_package(std_msgs REQUIRED)

add_executable(odometry_publisher src/odometry_publisher.cpp)
ament_target_dependencies(odometry_publisher
  rclcpp
  nav_msgs
  geometry_msgs
  tf2_ros
  std_msgs
)

add_executable(system_monitor src/system_monitor.cpp)
ament_target_dependencies(system_monitor
  rclcpp
  std_msgs
)

install(TARGETS
  odometry_publisher
  system_monitor
  DESTINATION lib/${PROJECT_NAME}
)

# Install launch files
install(DIRECTORY
  launch
  DESTINATION share/${PROJECT_NAME}
)

# Install scripts
install(PROGRAMS
  scripts/test_odom.py
  scripts/monitor_odom.py
  scripts/start_web.sh
  DESTINATION lib/${PROJECT_NAME}
)

# Install URDF files
install(DIRECTORY
  urdf
  DESTINATION share/${PROJECT_NAME}
)

# Install web files
install(DIRECTORY
  web
  DESTINATION share/${PROJECT_NAME}
)

if(BUILD_TESTING)
  find_package(ament_lint_auto REQUIRED)
  ament_lint_auto_find_test_dependencies()
endif()

ament_package()
