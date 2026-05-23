# RB300 Launch Package

ROS2 Jazzy向けのRB300ロボット統合パッケージ。RPLidar、ESP32シリアル通信、オドメトリ計算、Webベースの可視化・制御UIを統合しています。

## 概要

このパッケージは、RB300ロボットのシステム全体を起動・管理するためのROS2パッケージです。以下の機能を提供します：

- **RPLidar C1** センサー統合
- **ESP32** シリアル通信によるモーター制御・エンコーダ読み取り
- **オドメトリ計算** (wheel odometry)
- **システムモニタリング** (CPU・メモリ使用率)
- **Webベースの可視化・制御UI** (ROSBridge経由)

## パッケージ構造

```
rb300_webui/
├── CMakeLists.txt              # C++パッケージビルド設定
├── package.xml                 # ROS2パッケージ設定
├── launch/
│   ├── rb300_system.launch.py  # システム全体起動
│   └── web_bridge.launch.py    # WebSocketブリッジ起動
├── scripts/
│   ├── analyze_odom.py         # オドメトリ解析
│   ├── monitor_odom.py         # オドメトリモニタ
│   ├── start_web.sh            # Webサーバー起動
│   └── test_odom.py            # オドメトリテスト
├── src/
│   └── system_monitor.cpp      # システム監視ノード
├── urdf/
│   └── rb300.urdf.xacro        # ロボットモデル
└── web/
    └── index.html              # Web UI (可視化・制御)
```

## 依存パッケージ

- `rclcpp`
- `launch_ros`
- `nav_msgs`
- `geometry_msgs`
- `tf2_ros`
- `std_msgs`
- `rplidar_ros` (外部パッケージ)
- `esp_serial_v2_cpp` (外部パッケージ)
- `robot_state_publisher`
- `rosbridge_server`

## インストール・ビルド

```bash
# ワークスペースのsrcディレクトリに配置
cd ~/ros2_ws/src
git clone <this-repo>

# ワークスペースルートでビルド
cd ~/ros2_ws
colcon build --packages-select rb300_webui

# 環境を読み込み
source install/setup.bash
```

## 使い方

### 1. システム全体の起動

```bash
ros2 launch rb300_webui rb300_system.launch.py
```

### 2. WebSocketブリッジの起動（Web UI用）

```bash
ros2 launch rb300_webui web_bridge.launch.py
```

### 3. Web UIへのアクセス

`web_bridge.launch.py` を起動後、ブラウザで以下のURLを開きます：

```
http://<robot_ip>:8080
```

または `web/index.html` を直接ブラウザで開きます（`rosbridge_server` は別途起動が必要）。

#### Web UI機能

- **オドメトリ可視化**: ロボットの位置・経路をリアルタイム表示
- **キャリブレーションコントロール**:
  - 前進/後進 1m
  - 左右90°回転
  - カスタム速度・時間指定
  - D-Pad手動制御
- **システムモニタリング**: CPU使用率・メモリ使用率表示
- **エンコーダ値表示**: 左右車輪のエンコーダ値と差分

### 4. 個別ノードの起動

```bash
# システムモニター
ros2 run rb300_webui system_monitor
```

## Launch ファイルのパラメータ

### rb300_system.launch.py

| パラメータ | デフォルト値 | 説明 |
|-----------|-------------|------|
| `rplidar_serial_port` | `/dev/rplidar_c1` | RPLidarのシリアルポート |
| `rplidar_baudrate` | `460800` | RPLidarのボーレート |
| `rplidar_frame_id` | `laser` | RPLidarのフレームID |
| `rplidar_inverted` | `false` | スキャンデータを反転 |
| `rplidar_angle_compensate` | `true` | 角度補正を有効化 |
| `rplidar_scan_mode` | `Standard` | スキャンモード |
| `rplidar_flip_x_axis` | `true` | X軸を反転 |
| `esp_serial_port` | `/dev/esp32_serial` | ESP32のシリアルポート |
| `esp_baud_rate` | `115200` | ESP32のボーレート |
| `wheel_radius` | `0.0473` | 車輪半径 (m) |
| `wheel_separation` | `0.1796` | 車輪間距離 (m) |
| `max_rpm` | `115` | 最大モーター回転数 |
| `update_rate` | `50.0` | シリアル読み取りレート (Hz) |
| `pulses_per_rev` | `32767.0` | エンコーダ分解能 (0-32767 = 0-360°) |
| `cmd_vel_timeout` | `0.5` | cmd_velタイムアウト (秒) |
| `invert_motor_l` | `true` | 左モーター回転を反転 |
| `invert_motor_r` | `true` | 右モーター回転を反転 |

### web_bridge.launch.py

| パラメータ | デフォルト値 | 説明 |
|-----------|-------------|------|
| `port` | `9090` | WebSocketポート |
| `address` | `''` | 待受アドレス（空=すべてのインターフェース） |
| `delay` | `3` | 起動遅延 (秒) |

## トピック

### 発行トピック

| トピック名 | 型 | 発行元 | 説明 |
|-----------|-----|--------|------|
| `/system/cpu_usage` | `std_msgs/Float64` | `system_monitor` | CPU使用率 (%) |
| `/system/memory_available_gb` | `std_msgs/Float64` | `system_monitor` | 空きメモリ (GB) |
| `/system/memory_usage_percent` | `std_msgs/Float64` | `system_monitor` | メモリ使用率 (%) |

### 購読トピック

| トピック名 | 型 | 購読元 | 説明 |
|-----------|-----|--------|------|
| `/cmd_vel` | `geometry_msgs/Twist` | `esp_serial_v2_cpp` | 速度指令 |
| `/esp/position_l_rad` | `std_msgs/Float64` | Web UI | 左エンコーダ値 (rad) |
| `/esp/position_r_rad` | `std_msgs/Float64` | Web UI | 右エンコーダ値 (rad) |

## ライセンス

TODO: License declaration

## 作者

sunrise <hornet0018@users.noreply.github.com>
