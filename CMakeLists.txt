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

add_executable(system_monitor src/system_monitor.cpp)
ament_target_dependencies(system_monitor
  rclcpp
  std_msgs
)

install(TARGETS
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

# Build web UI with Vite if npm is available
if(AMENT_CMAKE_SYMLINK_INSTALL)
  # In symlink-install mode, make dist/ a symlink to web/ so source edits are reflected immediately.
  # This lets you run `npm run dev` from the source tree without rebuilding.
  if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/web/dist" AND NOT IS_SYMLINK "${CMAKE_CURRENT_SOURCE_DIR}/web/dist")
    file(REMOVE_RECURSE "${CMAKE_CURRENT_SOURCE_DIR}/web/dist")
  endif()
  if(NOT EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/web/dist")
    execute_process(
      COMMAND ${CMAKE_COMMAND} -E create_symlink
        "${CMAKE_CURRENT_SOURCE_DIR}/web"
        "${CMAKE_CURRENT_SOURCE_DIR}/web/dist"
    )
  endif()
  message(STATUS "Symlink-install: web/dist -> web/ (npm run dev compatible)")
else()
  # Normal build: compile with Vite
  find_program(NPM_EXECUTABLE npm)
  if(NPM_EXECUTABLE AND EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/web/package.json")
    message(STATUS "Building web UI with Vite...")
    if(NOT EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/web/node_modules")
      execute_process(
        COMMAND ${NPM_EXECUTABLE} install
        WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/web
        RESULT_VARIABLE npm_install_result
      )
      if(NOT npm_install_result EQUAL 0)
        message(WARNING "npm install failed for web UI")
      endif()
    endif()
    execute_process(
      COMMAND ${NPM_EXECUTABLE} run build
      WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/web
      RESULT_VARIABLE npm_build_result
    )
    if(NOT npm_build_result EQUAL 0)
      message(WARNING "npm run build failed for web UI")
    endif()
  endif()
endif()

# Install web files (built by Vite, or symlinked to web/ for dev)
install(DIRECTORY
  web/dist/
  DESTINATION share/${PROJECT_NAME}/web
)

if(BUILD_TESTING)
  find_package(ament_lint_auto REQUIRED)
  ament_lint_auto_find_test_dependencies()
endif()

ament_package()
