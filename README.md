# rb300_webui

RB300 ロボット向け Web UI および ROS 2 ブリッジパッケージ。

React + Vite で構築したフロントエンドと、Flask + Socket.IO + ROS 2 (`rclpy`) を組み合わせたバックエンドで、ブラウザからロボットを操作・監視できます。

---

## 機能

- **リアルタイム操縦**
  - 画面のコントロールパッドまたはキーボード（W/A/S/D など）で移動・旋回
  - `geometry_msgs/Twist` (`cmd_vel`) を ROS 2 にパブリッシュ
- **ステータス監視**
  - バッテリー電圧・残量 (`sensor_msgs/BatteryState`) のリアルタイム表示
  - ロボット状態メッセージ (`std_msgs/String`) の表示
- **WebSocket 通信**
  - Socket.IO でブラウザと ROS 2 ノードを双方向通信
- **ロボット上での実行**
  - ビルド済みフロントエンド (`dist/`) を Flask から配信し、ロボットの IP にアクセスするだけで使用可能

---

## 構成

```
rb300_webui/
├── rb300_webui/
│   └── webui_node.py       # ROS 2 ノード + Flask サーバー
├── frontend/
│   ├── src/
│   │   ├── App.jsx         # メイン画面
│   │   ├── components/     # BatteryPanel, StatusPanel, ControlPad
│   │   └── hooks/          # useSocket, useKeyboard
│   └── dist/               # ビルド済み静的ファイル（ros2 run で配信）
├── launch/
│   └── webui_launch.py     # ROS 2 Launch ファイル
├── package.xml
├── setup.py
└── README.md
```

---

## 前提環境

- ROS 2（Humble など、`rclpy` が使用できる環境）
- Python 3.10+
- Node.js 18+（フロントエンド開発・ビルド時のみ）

---

## インストール

### 1. ワークスペースに配置

```bash
cd ~/ros2_ws/src
git clone <リポジトリURL> rb300_webui
cd ~/ros2_ws
```

### 2. Python 依存のインストール

```bash
pip install -r src/rb300_webui/requirements.txt
```

### 3. フロントエンドのビルド

```bash
cd src/rb300_webui/frontend
npm install
npm run build
cd ~/ros2_ws
```

ビルド成果物は `frontend/dist/` に出力され、`setup.py` の `collect_dist()` により ROS 2 パッケージに含まれます。

### 4. パッケージのビルド

```bash
colcon build --packages-select rb300_webui
source install/setup.bash
```

---

## 使い方

### 起動

#### 本番モード（ビルド済み `dist/` を配信）

```bash
ros2 launch rb300_webui webui_launch.py
```

#### 開発モード（Vite 開発サーバーも同時起動）

フロントエンドのホットリロードを有効にしたい場合は `dev:=true` を付けます。

```bash
ros2 launch rb300_webui webui_launch.py dev:=true
```

開発モードでは、ブラウザで Vite の dev サーバー（通常 `http://localhost:5173`）を開いてください。Flask サーバー（ポート 5000）も並行して起動し、ROS 2 ブリッジとして動作します。

### 個別起動

ROS 2 ノードだけを起動したい場合は以下でも可能です。

```bash
ros2 run rb300_webui webui_node
```

### アクセス

- **本番モード**: ブラウザでロボット（または起動したマシン）の IP を開きます。
  ```
  http://<robot_ip>:5000/
  ```
- **開発モード**: Vite dev サーバーの URL を開きます（通常は `http://localhost:5173`）。
  CORS が有効なため、dev サーバーからでも Flask API（ポート 5000）と通信できます。

※ ポートは `webui_node.py` 内の `port=5000` で変更可能です。

### 操作方法

- **コントロールパッド**: 画面のボタンで前後左右移動・旋回
- **キーボード**: ブラウザ画面にフォーカスがある状態で W/A/S/D などを押すと `cmd_vel` が送信されます

---

## トピック

| 名前 | 型 | 方向 | 説明 |
|---|---|---|---|
| `cmd_vel` | `geometry_msgs/Twist` | Pub | Web UI からの速度指令 |
| `battery_state` | `sensor_msgs/BatteryState` | Sub | バッテリー情報の受信・表示 |
| `robot_status` | `std_msgs/String` | Sub | ロボット状態メッセージの受信・表示 |

---

## ローカル開発

PC（ロボット以外）でフロントエンドとバックエンドを動かし、ホットリロードで開発できます。

### 1. 環境準備

- **ROS 2** がインストールされ、`rclpy` が使えること
- **Node.js 18+** と **npm** がインストールされていること

### 2. 依存インストール

ターミナルを **2 つ**開いて、以下を実行してください。

**ターミナル 1（バックエンド）:**

```bash
cd ~/ros2_ws/src/rb300_webui
pip install -r requirements.txt
```

**ターミナル 2（フロントエンド）:**

```bash
cd ~/ros2_ws/src/rb300_webui/frontend
npm install
```

### 3. 起動方法

#### A. launch ファイルで一括起動（推奨）

`dev:=true` を付けると、ROS 2 ノードと Vite 開発サーバーを同時に起動します。

```bash
cd ~/ros2_ws
source install/setup.bash
ros2 launch rb300_webui webui_launch.py dev:=true
```

ブラウザで `http://localhost:5173` を開いてください。

#### B. 手動で別々に起動

2 つのターミナルでそれぞれ起動します。

**ターミナル 1（バックエンド）:**

```bash
cd ~/ros2_ws
source install/setup.bash
ros2 run rb300_webui webui_node
```

**ターミナル 2（フロントエンド）:**

```bash
cd ~/ros2_ws/src/rb300_webui/frontend
npm run dev
```

ブラウザで `http://localhost:5173` を開いてください。

### 4. 開発時の通信フロー

- **フロントエンド** (`localhost:5173`) ←→ **Flask/Socket.IO** (`localhost:5000`)
- Flask は CORS を許可しているため、Vite dev サーバーからでも通信可能です。
- ROS 2 トピック（`cmd_vel`, `battery_state` など）は通常通り動作します。

### 5. ビルド（本番反映）

開発が完了したら、ビルドして `dist/` を更新してください。

```bash
cd ~/ros2_ws/src/rb300_webui/frontend
npm run build
```

その後、ROS 2 ワークスペースで `colcon build` を実行し、本番モードで確認してください。

---

## ライセンス

MIT
