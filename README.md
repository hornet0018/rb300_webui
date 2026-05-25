# RB300 Launch Package

ROS2 Jazzy向けのRB300ロボット統合パッケージ。RPLidar、ESP32シリアル通信、オドメトリ計算、Webベースの可視化・制御UIを統合しています。

## 概要

このパッケージは、RB300ロボットのシステム全体を起動・管理するためのROS2パッケージです。以下の機能を提供します：

- **RPLidar C1** センサー統合
- **ESP32** シリアル通信によるモーター制御・エンコーダ読み取り
- **オドメトリ計算** (wheel odometry)
- **システムモニタリング** (CPU・メモリ使用率)
- **Webベースの可視化・制御UI** (ROSBridge経由、Vite + Vanilla JS)

## パッケージ構造

```
rb300_webui/
├── CMakeLists.txt              # C++パッケージビルド設定
├── package.xml                 # ROS2パッケージ設定
├── DESIGN.md                   # UIデザイン仕様書 (SpaceX-inspired)
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
└── web/                        # Web UI (Vite + Vanilla JS)
    ├── package.json
    ├── vite.config.js
    ├── index.html              # ダッシュボードページ
    ├── debug.html              # デバッグページ
    ├── src/
    │   ├── dashboard.js        # ダッシュボードロジック
    │   ├── debug.js            # デバッグページロジック
    │   ├── main.js             # デバッグページエントリ
    │   └── style.css           # スタイルシート
    └── dist/                   # ビルド成果物 (npm run build)
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
colcon build --symlink-install --packages-select rb300_webui

# 環境を読み込み
source install/setup.bash
```

ビルド時に `CMakeLists.txt` が自動的に `npm install` と `npm run build` を実行し、`web/dist/` を生成・インストールします。

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

#### 開発サーバで起動

```bash
cd ~/ros2_ws/src/rb300_ros2/rb300_webui/web
npm install   # 初回のみ
npm run dev   # 開発サーバ (http://localhost:5173)
```

#### 本番ビルド

```bash
cd ~/ros2_ws/src/rb300_ros2/rb300_webui/web
npm run build
```

#### HTTPサーバで起動

```bash
# インストール後のdistディレクトリから起動
ros2 run rb300_webui start_web.sh
# または手動
python3 -m http.server 8000 --directory ~/ros2_ws/install/rb300_webui/share/rb300_webui/web
```

ブラウザで以下のURLを開きます：

- **ダッシュボード**（操作メイン）: `http://<robot_ip>:8000/index.html`
- **デバッグ**（詳細モニタリング）: `http://<robot_ip>:8000/debug.html`

### 4. Web UI ページ構成

#### ダッシュボード (`index.html`)

運転・ナビゲーション時のメインビュー。

| パネル | 内容 |
|--------|------|
| 🗺️ **Map** | 占有格子地図（`/map`）のリアルタイム表示 + ロボット位置重畳 |
| 🎮 **Gamepad** | ゲームパッド接続・入力モニタ、Manual Mode トグル |
| 🎮 **Controls** | Calibration Actions（前進/後進/回転）、カスタム速度指定、D-Pad |
| | 🗺️ **Map Controls** | Start Mapping / Stop Mapping / Save Map |

#### デバッグ (`debug.html`)

開発・調整時の詳細ビュー。全パネルを常時表示。

| パネル | 内容 |
|--------|------|
| 📡 **LiDAR Scan** | `/scan` リアルタイム点群表示 |
| 🛤️ **Odometry Path** | `/odom` 軌跡表示、Auto Scale |
| 📊 **Odometry** | X/Y/Theta/Linear/Angular/Distance 数値表示 |
| ⚙️ **Encoders** | 左右エンコーダ値、差分、速度、総移動距離 |
| 🖥️ **System Monitor** | CPU/Mem 使用率 + リアルタイム折れ線グラフ |
| 🎮 **Gamepad** | コントローラー詳細（軸/ボタン/Cmd 出力） |
| 🎮 **Test Controls** | Calibration + D-Pad + ESTOP |
| 📋 **Raw Data** | トピック生データ JSON 表示 |

### 5. Web UI デザイン

Web UI のデザインは [`DESIGN.md`](./DESIGN.md) に基づき、**SpaceX-inspired** のミニマル工業デザインを採用しています。

- **カラー**: 純粋な黒白のみ（`#000000` / `#ffffff`）— ブランドアクセントなし
- **タイポグラフィ**: D-DIN 代替（Arial Narrow）、全大文字、正の字間隔（letter-spacing: 1.17px）
- **ボタン**: ゴーストピル（透明背景 + 白枠、角丸 32px）— ホバーで白背景に反転
- **ヘッダー**: 透明オーバーレイ + `backdrop-filter: blur(4px)`
- **パネル**: ボーダーのみ（hairline `#3a3a3f`）、シャドウなし

### 6. 個別ノードの起動

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

## マッピング操作

ダッシュボードの **Map Controls** からマッピングの開始・停止・保存が行えます。

### トピック・サービス割り当て

| ボタン | トピック / サービス | 型 | 内容 |
|--------|-------------------|-----|------|
| **▶️ Start Mapping** | `/rb300_webui/slam_command` | `std_msgs/String` | `"start"` を publish |
| **⏹️ Stop Mapping** | `/rb300_webui/slam_command` | `std_msgs/String` | `"stop"` を publish |
| **💾 Save Map** | `/slam_toolbox/save_map` | Service | 地図を PGM/YAML で保存 |

### 設定変更

お使いの SLAM パッケージに合わせて、`web/src/dashboard.js`（または `main.js`）の先頭を編集してください：

```javascript
const SLAM_COMMAND_TOPIC = '/rb300_webui/slam_command'  // マッピング開始/停止用
const SAVE_MAP_SERVICE   = '/slam_toolbox/save_map'      // slam_toolbox 用
// const SAVE_MAP_SERVICE = '/map_server/save_map'        // nav2_map_server 用
```

### 受信側ノードの例

```python
#!/usr/bin/env python3
import rclpy
from rclpy.node import Node
from std_msgs.msg import String

class SlamCommandListener(Node):
    def __init__(self):
        super().__init__('slam_command_listener')
        self.subscription = self.create_subscription(
            String, '/rb300_webui/slam_command', self.listener_callback, 10)
        self.slam_process = None

    def listener_callback(self, msg):
        if msg.data == 'start':
            self.get_logger().info('Start mapping requested')
            # TODO: SLAMノード起動 or lifecycle activate
            # 例: subprocess.Popen(['ros2', 'launch', 'slam_toolbox', 'online_async_launch.py'])
        elif msg.data == 'stop':
            self.get_logger().info('Stop mapping requested')
            # TODO: SLAMノード停止 or lifecycle deactivate

if __name__ == '__main__':
    rclpy.init()
    node = SlamCommandListener()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()
```

### Save Map の動作

1. **サービスが利用可能な場合**: `SaveMap` サービスを呼び出し、
   `~/ros2_ws/maps/map_YYYY-MM-DDTHH-MM-SS` に保存
2. **サービスが利用できない場合**: アラートを表示

---

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
