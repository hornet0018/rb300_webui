// ===== ROS Connection =====
const ros = new ROSLIB.Ros({ url: 'ws://' + location.hostname + ':9090' })
const statusBadge = document.getElementById('statusBadge')

ros.on('connection', () => {
    statusBadge.className = 'status-badge connected'
    statusBadge.textContent = 'Connected'
})
ros.on('error', (err) => {
    statusBadge.className = 'status-badge disconnected'
    statusBadge.textContent = 'Error'
})
ros.on('close', () => {
    statusBadge.className = 'status-badge disconnected'
    statusBadge.textContent = 'Disconnected'
})

// ===== Topics =====
const cmdVelTopic = new ROSLIB.Topic({
    ros, name: '/cmd_vel', messageType: 'geometry_msgs/msg/Twist'
})
const odomTopic = new ROSLIB.Topic({
    ros, name: '/odom', messageType: 'nav_msgs/msg/Odometry'
})
const scanTopic = new ROSLIB.Topic({
    ros, name: '/scan', messageType: 'sensor_msgs/msg/LaserScan'
})
const mapTopic = new ROSLIB.Topic({
    ros, name: '/map', messageType: 'nav_msgs/msg/OccupancyGrid'
})
const encoderLTopic = new ROSLIB.Topic({
    ros, name: '/esp/position_l_rad', messageType: 'std_msgs/msg/Float64'
})
const encoderRTopic = new ROSLIB.Topic({
    ros, name: '/esp/position_r_rad', messageType: 'std_msgs/msg/Float64'
})
const cpuTopic = new ROSLIB.Topic({
    ros, name: '/system/cpu_usage', messageType: 'std_msgs/msg/Float64'
})
const memAvailTopic = new ROSLIB.Topic({
    ros, name: '/system/memory_available_gb', messageType: 'std_msgs/msg/Float64'
})
const memPercentTopic = new ROSLIB.Topic({
    ros, name: '/system/memory_usage_percent', messageType: 'std_msgs/msg/Float64'
})

// ===== SLAM Control Topics & Services =====
const SLAM_COMMAND_TOPIC = '/rb300_webui/slam_command'   // std_msgs/String: "start" | "stop"
const SAVE_MAP_SERVICE   = '/slam_toolbox/save_map'       // slam_toolbox/srv/SaveMap

const slamCommandTopic = new ROSLIB.Topic({
    ros, name: SLAM_COMMAND_TOPIC, messageType: 'std_msgs/msg/String'
})

let saveMapClient = null
try {
    saveMapClient = new ROSLIB.Service({ ros, name: SAVE_MAP_SERVICE, serviceType: 'slam_toolbox/srv/SaveMap' })
} catch (e) { console.warn('SaveMap service not available:', e) }



let cmdInterval = null
let encoderL = 0, encoderR = 0

function publishCmdVel(linear, angular) {
    cmdVelTopic.publish(new ROSLIB.Message({
        linear: { x: linear, y: 0, z: 0 },
        angular: { x: 0, y: 0, z: angular }
    }))
}
function stopRobot() {
    if (cmdInterval) { clearInterval(cmdInterval); cmdInterval = null }
    publishCmdVel(0, 0)
    const estop = document.getElementById('headerEstop')
    estop.textContent = 'READY'
    estop.className = 'status-badge ok'
}
function setEstopActive() {
    const estop = document.getElementById('headerEstop')
    estop.textContent = 'ACTIVE'
    estop.className = 'status-badge estop'
}

function startMapping() {
    slamCommandTopic.publish(new ROSLIB.Message({ data: 'start' }))
    console.log('Published "start" to ' + SLAM_COMMAND_TOPIC)
}

function stopMapping() {
    slamCommandTopic.publish(new ROSLIB.Message({ data: 'stop' }))
    console.log('Published "stop" to ' + SLAM_COMMAND_TOPIC)
}

function saveMap() {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
    const mapPath = '/home/sunrise/ros2_ws/maps/map_' + timestamp

    if (saveMapClient) {
        const request = new ROSLIB.ServiceRequest({ name: { data: mapPath } })
        saveMapClient.callService(request, (result) => {
            console.log('Map saved via service:', result)
            alert('Map saved to: ' + mapPath)
        }, (error) => {
            console.error('SaveMap service failed:', error)
            alert('SaveMap service failed: ' + error)
        })
        return
    }

    alert('SaveMap service not configured. Check SLAM_COMMAND_TOPIC and SAVE_MAP_SERVICE settings.')
}

function calibrate(type, value, duration) {
    stopRobot()
    setEstopActive()
    let linear = 0, angular = 0
    switch(type) {
        case 'forward': linear = value; break
        case 'backward': linear = -value; break
        case 'rotate_left': angular = value; break
        case 'rotate_right': angular = -value; break
    }
    resetPath()
    cmdInterval = setInterval(() => publishCmdVel(linear, angular), 100)
    setTimeout(stopRobot, duration * 1000)
}
function customMove() {
    const linear = parseFloat(document.getElementById('linearSpeed').value) || 0
    const angular = parseFloat(document.getElementById('angularSpeed').value) || 0
    const duration = parseFloat(document.getElementById('duration').value) || 5
    stopRobot(); resetPath()
    setEstopActive()
    cmdInterval = setInterval(() => publishCmdVel(linear, angular), 100)
    setTimeout(stopRobot, duration * 1000)
}
function setContinuous() {
    const linear = parseFloat(document.getElementById('linearSpeed').value) || 0
    const angular = parseFloat(document.getElementById('angularSpeed').value) || 0
    stopRobot()
    setEstopActive()
    cmdInterval = setInterval(() => publishCmdVel(linear, angular), 100)
}
function startDPad(linear, angular) {
    if (!manualModeEnabled) return
    stopRobot()
    setEstopActive()
    publishCmdVel(linear, angular)
    cmdInterval = setInterval(() => publishCmdVel(linear, angular), 100)
}

// ===== Gamepad (HID Controller) =====
const GP_MAX_LINEAR = 0.3   // m/s
const GP_MAX_ANGULAR = 1.0  // rad/s
const GP_DEADZONE = 0.15
let gamepad = null
let selectedGamepadIndex = -1
let manualModeEnabled = false
let gamepadEnabled = false

document.getElementById('gpMaxLin').textContent = GP_MAX_LINEAR.toFixed(1)
document.getElementById('gpMaxAng').textContent = GP_MAX_ANGULAR.toFixed(1)

// Create button display elements
const gpButtonsContainer = document.getElementById('gpButtons')
for (let i = 0; i < 16; i++) {
    const div = document.createElement('div')
    div.className = 'gp-btn'
    div.id = 'gpBtn' + i
    div.textContent = i
    gpButtonsContainer.appendChild(div)
}

function applyDeadzone(val) {
    if (Math.abs(val) < GP_DEADZONE) return 0
    const sign = val > 0 ? 1 : -1
    return sign * (Math.abs(val) - GP_DEADZONE) / (1 - GP_DEADZONE)
}

function updateManualModeUI() {
    const toggle = document.getElementById('manualModeToggle')
    const status = document.getElementById('manualModeStatus')
    toggle.checked = manualModeEnabled
    status.textContent = manualModeEnabled ? 'ON' : 'OFF'
    status.className = 'toggle-status ' + (manualModeEnabled ? 'on' : 'off')

    // Update header
    const header = document.getElementById('headerManual')
    header.textContent = manualModeEnabled ? 'Manual' : 'Auto'
    header.className = 'status-badge ' + (manualModeEnabled ? 'on' : 'off')

    // Disable/enable D-Pad buttons
    const dpadButtons = document.querySelectorAll('.d-pad button')
    for (const btn of dpadButtons) {
        btn.disabled = !manualModeEnabled
        btn.style.opacity = manualModeEnabled ? '1' : '0.4'
        btn.style.cursor = manualModeEnabled ? 'pointer' : 'not-allowed'
    }

    if (!manualModeEnabled) {
        stopRobot()
    }
}

function updateGamepadUI() {
    const toggle = document.getElementById('gamepadToggle')
    const status = document.getElementById('gamepadStatus')
    const content = document.getElementById('gpContent')
    toggle.checked = gamepadEnabled
    status.textContent = gamepadEnabled ? 'ON' : 'OFF'
    status.className = 'toggle-status ' + (gamepadEnabled ? 'on' : 'off')

    // Update header
    const header = document.getElementById('headerGamepad')
    header.textContent = gamepadEnabled ? 'ON' : 'OFF'
    header.className = 'status-badge ' + (gamepadEnabled ? 'on' : 'off')

    if (!gamepadEnabled || !manualModeEnabled) {
        content.classList.add('gp-disabled-overlay')
    } else {
        content.classList.remove('gp-disabled-overlay')
    }

    if (!gamepadEnabled) {
        stopRobot()
    }
}

function toggleManualMode() {
    manualModeEnabled = document.getElementById('manualModeToggle').checked
    updateManualModeUI()
    updateGamepadUI()
}

function toggleGamepad() {
    gamepadEnabled = document.getElementById('gamepadToggle').checked
    updateGamepadUI()
}

function populateGamepadList() {
    const select = document.getElementById('gpSelect')
    const pads = navigator.getGamepads ? navigator.getGamepads() : []
    const connectedPads = []
    for (let i = 0; i < pads.length; i++) {
        if (pads[i] && pads[i].connected) connectedPads.push({ index: i, pad: pads[i] })
    }

    // Preserve current selection if still connected
    const prevSelection = select.value

    // Clear and rebuild options
    select.innerHTML = ''
    if (connectedPads.length === 0) {
        const opt = document.createElement('option')
        opt.value = ''; opt.textContent = '-- No controller --'
        select.appendChild(opt)
        selectedGamepadIndex = -1
    } else {
        for (const item of connectedPads) {
            const opt = document.createElement('option')
            opt.value = item.index
            opt.textContent = item.pad.id.substring(0, 45)
            select.appendChild(opt)
        }
        // Restore selection or default to first
        if (prevSelection !== '' && connectedPads.some(c => String(c.index) === prevSelection)) {
            select.value = prevSelection
            selectedGamepadIndex = parseInt(prevSelection)
        } else {
            select.value = String(connectedPads[0].index)
            selectedGamepadIndex = connectedPads[0].index
        }
    }
}

function onGamepadSelected() {
    const select = document.getElementById('gpSelect')
    const val = select.value
    selectedGamepadIndex = val === '' ? -1 : parseInt(val)
}

function updateGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : []
    populateGamepadList()

    const indicator = document.getElementById('gpIndicator')
    const nameEl = document.getElementById('gpName')

    let activePad = null
    if (selectedGamepadIndex >= 0 && selectedGamepadIndex < pads.length) {
        activePad = pads[selectedGamepadIndex]
    }

    if (!activePad || !activePad.connected) {
        if (gamepad) {
            stopRobot()
            gamepad = null
        }
        indicator.classList.remove('active')
        nameEl.textContent = 'No controller connected'
        for (let i = 0; i < 4; i++) {
            const bar = document.getElementById('gpBar' + i)
            if (bar) { bar.style.left = '50%'; bar.style.width = '0%' }
        }
        for (let i = 0; i < 16; i++) {
            const btn = document.getElementById('gpBtn' + i)
            if (btn) btn.classList.remove('pressed')
        }
        document.getElementById('gpCmdLinear').textContent = '0.000'
        document.getElementById('gpCmdAngular').textContent = '0.000'
        requestAnimationFrame(updateGamepad)
        return
    }

    gamepad = activePad
    indicator.classList.add('active')
    nameEl.textContent = gamepad.id.substring(0, 40)

    // Update axis bars
    for (let i = 0; i < 4 && i < gamepad.axes.length; i++) {
        const val = gamepad.axes[i]
        const bar = document.getElementById('gpBar' + i)
        if (!bar) continue
        const pct = Math.abs(val) * 50
        if (val >= 0) {
            bar.style.left = '50%'
            bar.style.width = pct + '%'
        } else {
            bar.style.left = (50 - pct) + '%'
            bar.style.width = pct + '%'
        }
    }

    // Update button display
    for (let i = 0; i < gamepad.buttons.length && i < 16; i++) {
        const btn = document.getElementById('gpBtn' + i)
        if (!btn) continue
        const pressed = gamepad.buttons[i].pressed
        if (pressed) btn.classList.add('pressed')
        else btn.classList.remove('pressed')
    }

    // Only send commands when both manual mode and gamepad are enabled
    if (!manualModeEnabled || !gamepadEnabled) {
        document.getElementById('gpCmdLinear').textContent = '0.000'
        document.getElementById('gpCmdAngular').textContent = '0.000'
        if (!cmdInterval) publishCmdVel(0, 0)
        requestAnimationFrame(updateGamepad)
        return
    }

    // Map controls:
    const rawLinear = -gamepad.axes[1]
    const rawAngular = -gamepad.axes[0]

    const linear = applyDeadzone(rawLinear) * GP_MAX_LINEAR
    const angular = applyDeadzone(rawAngular) * GP_MAX_ANGULAR

    document.getElementById('gpCmdLinear').textContent = linear.toFixed(3)
    document.getElementById('gpCmdAngular').textContent = angular.toFixed(3)

    // Emergency stop buttons: B (1) or RB (5)
    const stopPressed = gamepad.buttons[1].pressed || gamepad.buttons[5].pressed
    if (stopPressed) {
        stopRobot()
    } else if (Math.abs(linear) > 0 || Math.abs(angular) > 0) {
        setEstopActive()
        publishCmdVel(linear, angular)
    } else {
        if (!cmdInterval) publishCmdVel(0, 0)
    }

    requestAnimationFrame(updateGamepad)
}

window.addEventListener('gamepadconnected', (e) => {
    console.log('Gamepad connected:', e.gamepad.id)
    populateGamepadList()
})
window.addEventListener('gamepaddisconnected', (e) => {
    console.log('Gamepad disconnected:', e.gamepad.id)
    populateGamepadList()
    // If the currently selected gamepad was disconnected, stop the robot
    if (selectedGamepadIndex === e.gamepad.index) {
        stopRobot()
    }
})

// Start gamepad loop
requestAnimationFrame(updateGamepad)

// ===== LiDAR Canvas =====
const lidarCanvas = document.getElementById('lidarCanvas')
const lidarCtx = lidarCanvas.getContext('2d')
const lidarCenterX = lidarCanvas.width / 2
const lidarCenterY = lidarCanvas.height / 2
const lidarScale = 80 // 80 px per meter
let lastScanTime = 0

function drawLidarGrid() {
    lidarCtx.fillStyle = '#0f0f1a'
    lidarCtx.fillRect(0, 0, lidarCanvas.width, lidarCanvas.height)
    lidarCtx.strokeStyle = '#2a2a3e'
    lidarCtx.lineWidth = 1

    // concentric circles every 0.5m
    for (let r = 0.5; r <= 4; r += 0.5) {
        lidarCtx.beginPath()
        lidarCtx.arc(lidarCenterX, lidarCenterY, r * lidarScale, 0, Math.PI * 2)
        lidarCtx.stroke()
    }
    // cross
    lidarCtx.strokeStyle = '#3a3a4e'
    lidarCtx.lineWidth = 1
    lidarCtx.beginPath()
    lidarCtx.moveTo(0, lidarCenterY); lidarCtx.lineTo(lidarCanvas.width, lidarCenterY)
    lidarCtx.moveTo(lidarCenterX, 0); lidarCtx.lineTo(lidarCenterX, lidarCanvas.height)
    lidarCtx.stroke()
}

function drawRobotIcon() {
    const r = 8
    lidarCtx.fillStyle = '#4dabf7'
    lidarCtx.beginPath()
    lidarCtx.arc(lidarCenterX, lidarCenterY, r, 0, Math.PI * 2)
    lidarCtx.fill()
    // heading arrow
    lidarCtx.strokeStyle = '#4dabf7'
    lidarCtx.lineWidth = 2
    lidarCtx.beginPath()
    lidarCtx.moveTo(lidarCenterX, lidarCenterY)
    lidarCtx.lineTo(lidarCenterX + r * 1.5, lidarCenterY)
    lidarCtx.stroke()
}

scanTopic.subscribe(function(msg) {
    drawLidarGrid()

    let validPoints = 0
    let minRange = Infinity, maxRange = -Infinity
    lidarCtx.fillStyle = '#4caf50'

    for (let i = 0; i < msg.ranges.length; i++) {
        const r = msg.ranges[i]
        if (r < msg.range_min || r > msg.range_max || !isFinite(r)) continue
        validPoints++
        if (r < minRange) minRange = r
        if (r > maxRange) maxRange = r

        const angle = msg.angle_min + i * msg.angle_increment
        const px = lidarCenterX + r * lidarScale * Math.cos(angle)
        const py = lidarCenterY - r * lidarScale * Math.sin(angle)

        lidarCtx.beginPath()
        lidarCtx.arc(px, py, 1.5, 0, Math.PI * 2)
        lidarCtx.fill()
    }

    drawRobotIcon()

    document.getElementById('scanPoints').textContent = 'Points: ' + validPoints + ' / ' + msg.ranges.length
    document.getElementById('scanRange').textContent = 'Range: ' + (minRange === Infinity ? '--' : minRange.toFixed(2)) + ' ~ ' + (maxRange === -Infinity ? '--' : maxRange.toFixed(2)) + ' m'

    const now = Date.now()
    if (lastScanTime > 0) {
        const hz = 1000 / (now - lastScanTime)
        document.getElementById('scanFreq').textContent = 'Freq: ' + hz.toFixed(1) + ' Hz'
    }
    lastScanTime = now
})

// ===== Map Canvas =====
const mapCanvas = document.getElementById('mapCanvas')
const mapCtx = mapCanvas ? mapCanvas.getContext('2d') : null
let currentMap = null
let mapMeta = null
let robotMapPose = null

function resizeMapCanvas() {
    if (!mapCanvas) return
    const rect = mapCanvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const w = Math.floor(rect.width * dpr)
    const h = Math.floor(rect.height * dpr)
    if (mapCanvas.width !== w || mapCanvas.height !== h) {
        mapCanvas.width = w
        mapCanvas.height = h
    }
}

function drawMap() {
    if (!mapCtx || !currentMap) return
    resizeMapCanvas()
    const { width, height, resolution, origin } = currentMap.info
    const data = currentMap.data

    // Scale to fit canvas
    const scaleX = mapCanvas.width / width
    const scaleY = mapCanvas.height / height
    const displayScale = Math.min(scaleX, scaleY)

    const offsetX = (mapCanvas.width - width * displayScale) / 2
    const offsetY = (mapCanvas.height - height * displayScale) / 2

    // Create image data ( OccupancyGrid: -1=unknown, 0=free, 100=occupied )
    const imageData = mapCtx.createImageData(width, height)
    for (let i = 0; i < data.length; i++) {
        const v = data[i]
        let r, g, b
        if (v === -1) { r = 200; g = 200; b = 200 }      // unknown
        else if (v < 50) { r = 255; g = 255; b = 255 }   // free
        else { r = 0; g = 0; b = 0 }                       // occupied
        imageData.data[i * 4] = r
        imageData.data[i * 4 + 1] = g
        imageData.data[i * 4 + 2] = b
        imageData.data[i * 4 + 3] = 255
    }

    const tmp = document.createElement('canvas')
    tmp.width = width
    tmp.height = height
    tmp.getContext('2d').putImageData(imageData, 0, 0)

    mapCtx.clearRect(0, 0, mapCanvas.width, mapCanvas.height)
    mapCtx.save()
    mapCtx.translate(offsetX, offsetY)
    // Flip Y because canvas Y goes down, map Y goes up from origin
    mapCtx.scale(displayScale, -displayScale)
    mapCtx.translate(0, -height)
    mapCtx.drawImage(tmp, 0, 0)
    mapCtx.restore()

    // Grid overlay (optional)
    mapCtx.strokeStyle = 'rgba(200,200,200,0.3)'
    mapCtx.lineWidth = 1
    for (let x = 0; x <= width; x += 10) {
        const px = offsetX + x * displayScale
        mapCtx.beginPath()
        mapCtx.moveTo(px, offsetY)
        mapCtx.lineTo(px, offsetY + height * displayScale)
        mapCtx.stroke()
    }
    for (let y = 0; y <= height; y += 10) {
        const py = offsetY + y * displayScale
        mapCtx.beginPath()
        mapCtx.moveTo(offsetX, py)
        mapCtx.lineTo(offsetX + width * displayScale, py)
        mapCtx.stroke()
    }

    mapMeta = { displayScale, offsetX, offsetY, width, height, resolution, origin }
    const mapInfoEl = document.getElementById('mapInfo')
    if (mapInfoEl) mapInfoEl.textContent = `${width}x${height} @ ${resolution.toFixed(3)} m/cell`
}

function drawRobotOnMap() {
    if (!mapCtx || !mapMeta || !robotMapPose) return
    const { displayScale, offsetX, offsetY, height, resolution, origin } = mapMeta

    const mx = (robotMapPose.x - origin.position.x) / resolution
    const my = (robotMapPose.y - origin.position.y) / resolution

    // Canvas Y is inverted relative to map Y
    const cx = offsetX + mx * displayScale
    const cy = offsetY + (height - my) * displayScale

    mapCtx.fillStyle = '#ff6b6b'
    mapCtx.beginPath()
    mapCtx.arc(cx, cy, 5, 0, Math.PI * 2)
    mapCtx.fill()

    mapCtx.strokeStyle = '#ff6b6b'
    mapCtx.lineWidth = 2
    mapCtx.beginPath()
    mapCtx.moveTo(cx, cy)
    mapCtx.lineTo(cx + Math.cos(robotMapPose.theta) * 12, cy - Math.sin(robotMapPose.theta) * 12)
    mapCtx.stroke()
}

function clearMapOverlay() {
    robotMapPose = null
    drawMap()
}

mapTopic.subscribe(function(msg) {
    currentMap = msg
    drawMap()
    drawRobotOnMap()
})

// ===== Odometry Path Canvas =====
const pathCanvas = document.getElementById('pathCanvas')
const pathCtx = pathCanvas.getContext('2d')
const path = []
let firstX = null, firstY = null
let autoScale = true
let pathScale = 80
let pathOffsetX = pathCanvas.width / 2
let pathOffsetY = pathCanvas.height / 2

function drawPathGrid() {
    pathCtx.fillStyle = '#0f0f1a'
    pathCtx.fillRect(0, 0, pathCanvas.width, pathCanvas.height)
    pathCtx.strokeStyle = '#2a2a3e'
    pathCtx.lineWidth = 1
    pathCtx.fillStyle = '#6c757d'
    pathCtx.font = '10px sans-serif'

    // Choose grid step in meters so labels are readable
    let stepM = 1
    if (pathScale >= 120) stepM = 0.5
    else if (pathScale >= 60) stepM = 1
    else if (pathScale >= 30) stepM = 2
    else if (pathScale >= 15) stepM = 5
    else stepM = 10

    const stepPx = stepM * pathScale

    // Vertical grid lines + X-axis labels
    pathCtx.textAlign = 'center'
    pathCtx.textBaseline = 'top'
    const startX = Math.floor((0 - pathOffsetX) / stepPx) * stepPx + pathOffsetX
    for (let x = startX; x < pathCanvas.width; x += stepPx) {
        pathCtx.beginPath(); pathCtx.moveTo(x, 0); pathCtx.lineTo(x, pathCanvas.height); pathCtx.stroke()
        const m = ((x - pathOffsetX) / pathScale).toFixed(stepM < 1 ? 1 : 0)
        pathCtx.fillText(m + 'm', x, pathOffsetY + 4)
    }

    // Horizontal grid lines + Y-axis labels
    pathCtx.textAlign = 'right'
    pathCtx.textBaseline = 'middle'
    const startY = Math.floor((0 - pathOffsetY) / stepPx) * stepPx + pathOffsetY
    for (let y = startY; y < pathCanvas.height; y += stepPx) {
        pathCtx.beginPath(); pathCtx.moveTo(0, y); pathCtx.lineTo(pathCanvas.width, y); pathCtx.stroke()
        const m = ((pathOffsetY - y) / pathScale).toFixed(stepM < 1 ? 1 : 0)
        pathCtx.fillText(m + 'm', pathOffsetX - 4, y)
    }

    // Axes
    pathCtx.strokeStyle = '#4a4a5e'
    pathCtx.lineWidth = 2
    pathCtx.beginPath(); pathCtx.moveTo(0, pathOffsetY); pathCtx.lineTo(pathCanvas.width, pathOffsetY); pathCtx.stroke()
    pathCtx.beginPath(); pathCtx.moveTo(pathOffsetX, 0); pathCtx.lineTo(pathOffsetX, pathCanvas.height); pathCtx.stroke()
}

function drawPath() {
    drawPathGrid()
    if (path.length < 2) return

    pathCtx.strokeStyle = '#4dabf7'
    pathCtx.lineWidth = 2
    pathCtx.beginPath()
    for (let i = 0; i < path.length; i++) {
        const px = pathOffsetX + path[i].x * pathScale
        const py = pathOffsetY - path[i].y * pathScale
        if (i === 0) pathCtx.moveTo(px, py)
        else pathCtx.lineTo(px, py)
    }
    pathCtx.stroke()

    const last = path[path.length - 1]
    const rx = pathOffsetX + last.x * pathScale
    const ry = pathOffsetY - last.y * pathScale
    pathCtx.fillStyle = '#ff6b6b'
    pathCtx.beginPath()
    pathCtx.arc(rx, ry, 6, 0, Math.PI * 2)
    pathCtx.fill()
    pathCtx.strokeStyle = '#ff6b6b'
    pathCtx.lineWidth = 2
    pathCtx.beginPath()
    pathCtx.moveTo(rx, ry)
    pathCtx.lineTo(rx + Math.cos(last.theta) * 12, ry - Math.sin(last.theta) * 12)
    pathCtx.stroke()
}

function resetPath() {
    path.length = 0; firstX = null; firstY = null
    drawPathGrid()
    document.getElementById('pathPoints').textContent = 'Path points: 0'
}
function toggleAutoScale() { autoScale = !autoScale }

function toDegrees(rad) { return rad * 180 / Math.PI }
function quatToYaw(qx, qy, qz, qw) {
    return Math.atan2(2 * (qw * qz + qx * qy), 1 - 2 * (qy * qy + qz * qz))
}

odomTopic.subscribe(function(msg) {
    const x = msg.pose.pose.position.x
    const y = msg.pose.pose.position.y
    const q = msg.pose.pose.orientation
    const theta = quatToYaw(q.x, q.y, q.z, q.w)
    const linear = msg.twist.twist.linear.x
    const angular = msg.twist.twist.angular.z

    if (firstX === null) { firstX = x; firstY = y }
    path.push({ x, y, theta })
    document.getElementById('pathPoints').textContent = 'Path points: ' + path.length

    document.getElementById('x').textContent = x.toFixed(3) + ' m'
    document.getElementById('y').textContent = y.toFixed(3) + ' m'
    document.getElementById('theta').textContent = toDegrees(theta).toFixed(1) + '°'
    document.getElementById('linear').textContent = linear.toFixed(3) + ' m/s'
    document.getElementById('angular').textContent = angular.toFixed(3) + ' rad/s'
    const dist = Math.sqrt(Math.pow(x - firstX, 2) + Math.pow(y - firstY, 2))
    document.getElementById('distance').textContent = dist.toFixed(3) + ' m'

    // Update header status
    document.getElementById('headerPos').textContent = `${x.toFixed(2)} / ${y.toFixed(2)}`
    document.getElementById('headerVel').textContent = `${linear.toFixed(2)} / ${angular.toFixed(2)}`

    if (autoScale && path.length > 1) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
        for (const p of path) {
            if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x
            if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y
        }
        const rangeX = maxX - minX || 1
        const rangeY = maxY - minY || 1
        const scaleX = (pathCanvas.width - 40) / rangeX
        const scaleY = (pathCanvas.height - 40) / rangeY
        pathScale = Math.min(scaleX, scaleY)
        pathOffsetX = pathCanvas.width / 2 - (minX + maxX) / 2 * pathScale
        pathOffsetY = pathCanvas.height / 2 + (minY + maxY) / 2 * pathScale
    }

    drawPath()

    // Update robot pose on map
    robotMapPose = { x, y, theta }
    drawMap()
    drawRobotOnMap()

    onOdomForCal(msg)
})

// ===== Encoders =====
encoderLTopic.subscribe(function(msg) {
    encoderL = msg.data
    document.getElementById('encoderL').textContent = encoderL.toFixed(3)
    updateEncoderDiff()
})
encoderRTopic.subscribe(function(msg) {
    encoderR = msg.data
    document.getElementById('encoderR').textContent = encoderR.toFixed(3)
    updateEncoderDiff()
})
function updateEncoderDiff() {
    document.getElementById('encoderDiff').textContent = (encoderR - encoderL).toFixed(3)
}

// ===== System Monitor =====
function updateSystemStatus(cpu, memPercent) {
    const cpuCell = document.getElementById('cpuCell')
    const memPctCell = document.getElementById('memPctCell')
    cpuCell.classList.remove('warn', 'danger')
    memPctCell.classList.remove('warn', 'danger')
    if (cpu > 80) cpuCell.classList.add('danger')
    else if (cpu > 60) cpuCell.classList.add('warn')
    if (memPercent > 90) memPctCell.classList.add('danger')
    else if (memPercent > 75) memPctCell.classList.add('warn')
}
cpuTopic.subscribe(function(msg) {
    document.getElementById('cpuUsage').textContent = msg.data.toFixed(1) + '%'
    updateSystemStatus(msg.data, parseFloat(document.getElementById('memPercent').textContent) || 0)
})
memAvailTopic.subscribe(function(msg) {
    document.getElementById('memAvailable').textContent = msg.data.toFixed(2) + ' GB'
})
memPercentTopic.subscribe(function(msg) {
    document.getElementById('memPercent').textContent = msg.data.toFixed(1) + '%'
    updateSystemStatus(parseFloat(document.getElementById('cpuUsage').textContent) || 0, msg.data)
})

// ===== Init =====
updateManualModeUI()
updateGamepadUI()
drawLidarGrid()
drawRobotIcon()
drawPathGrid()

function togglePanel(id) {
    const panel = document.getElementById('panel-' + id)
    if (panel) {
        panel.style.display = panel.style.display === 'none' ? '' : 'none'
    }
}

// Expose globals for inline onclick handlers
window.resetPath = resetPath
window.toggleAutoScale = toggleAutoScale
window.calibrate = calibrate
window.stopRobot = stopRobot
window.customMove = customMove
window.setContinuous = setContinuous
window.startDPad = startDPad
window.toggleManualMode = toggleManualMode
window.toggleGamepad = toggleGamepad
window.onGamepadSelected = onGamepadSelected
window.clearMapOverlay = clearMapOverlay
window.togglePanel = togglePanel
window.startMapping = startMapping
window.stopMapping = stopMapping
window.saveMap = saveMap

// ===== Odometry Calibration =====
const CAL_DEFAULT_RADIUS = 0.0473
const CAL_DEFAULT_SEPARATION = 0.1796

let calState = 'idle' // 'idle' | 'linear' | 'rotation'
let calStartPose = null
let calStartYaw = null
let calStartTime = null
let calAccumDist = 0
let calAccumYaw = 0
let calPrevPose = null
let calPrevYaw = null
let calTimerInterval = null

function fetchCalibrationParams() {
    document.getElementById('calCurrentRadius').textContent = CAL_DEFAULT_RADIUS.toFixed(6) + ' m'
    document.getElementById('calCurrentSep').textContent = CAL_DEFAULT_SEPARATION.toFixed(6) + ' m'
}

function resetCalibration() {
    calState = 'idle'
    calStartPose = null
    calStartYaw = null
    calStartTime = null
    calAccumDist = 0
    calAccumYaw = 0
    calPrevPose = null
    calPrevYaw = null
    if (calTimerInterval) { clearInterval(calTimerInterval); calTimerInterval = null }
    document.getElementById('calStatus').textContent = 'Idle'
    document.getElementById('calLiveDist').textContent = '0.000 m'
    document.getElementById('calLiveRot').textContent = '0.00°'
    document.getElementById('calLiveTime').textContent = '0.0 s'
}

function updateCalTimer() {
    if (calStartTime) {
        const elapsed = ((Date.now() - calStartTime) / 1000).toFixed(1)
        document.getElementById('calLiveTime').textContent = elapsed + ' s'
    }
}

function onOdomForCal(msg) {
    if (calState === 'idle') return
    const x = msg.pose.pose.position.x
    const y = msg.pose.pose.position.y
    const q = msg.pose.pose.orientation
    const yaw = quatToYaw(q.x, q.y, q.z, q.w)

    if (calStartPose === null) {
        calStartPose = { x, y }
        calStartYaw = yaw
        calPrevPose = { x, y }
        calPrevYaw = yaw
        calStartTime = Date.now()
        calTimerInterval = setInterval(updateCalTimer, 200)
        return
    }

    const dx = x - calPrevPose.x
    const dy = y - calPrevPose.y
    calAccumDist += Math.sqrt(dx * dx + dy * dy)
    calPrevPose = { x, y }

    let dYaw = yaw - calPrevYaw
    while (dYaw > Math.PI) dYaw -= 2 * Math.PI
    while (dYaw < -Math.PI) dYaw += 2 * Math.PI
    calAccumYaw += dYaw
    calPrevYaw = yaw

    document.getElementById('calLiveDist').textContent = calAccumDist.toFixed(4) + ' m'
    document.getElementById('calLiveRot').textContent = (calAccumYaw * 180 / Math.PI).toFixed(2) + '°'
}

function startLinearCal() {
    resetCalibration()
    calState = 'linear'
    document.getElementById('calStatus').textContent = 'Linear: measuring...'
    calibrate('forward', 0.1, 10)
}

function stopLinearCal() {
    stopRobot()
    if (calState === 'linear') {
        calState = 'idle'
        document.getElementById('calStatus').textContent = 'Linear: stopped'
        if (calTimerInterval) { clearInterval(calTimerInterval); calTimerInterval = null }
    }
}

function startRotationCal() {
    resetCalibration()
    calState = 'rotation'
    document.getElementById('calStatus').textContent = 'Rotation: measuring...'
    calibrate('rotate_left', 0.628, 10)
}

function stopRotationCal() {
    stopRobot()
    if (calState === 'rotation') {
        calState = 'idle'
        document.getElementById('calStatus').textContent = 'Rotation: stopped'
        if (calTimerInterval) { clearInterval(calTimerInterval); calTimerInterval = null }
    }
}

function calculateRadius() {
    const target = parseFloat(document.getElementById('calTargetDist').value) || 1.0
    const measured = parseFloat(document.getElementById('calMeasuredDist').value)
    if (!measured || measured <= 0) {
        alert('Please enter a valid measured distance.')
        return
    }
    const currentRadius = CAL_DEFAULT_RADIUS
    const newRadius = currentRadius * (target / measured)
    document.getElementById('calNewRadius').textContent = newRadius.toFixed(6) + ' m'
    document.getElementById('calRadiusResult').style.display = 'block'
    console.log('Proposed wheel_radius:', newRadius)
}

function calculateSeparation() {
    const targetDeg = parseFloat(document.getElementById('calTargetRot').value) || 360.0
    const measuredDeg = parseFloat(document.getElementById('calMeasuredRot').value)
    if (!measuredDeg || measuredDeg === 0) {
        alert('Please enter a valid measured rotation.')
        return
    }
    const targetRad = targetDeg * Math.PI / 180
    const measuredRad = measuredDeg * Math.PI / 180
    const currentSep = CAL_DEFAULT_SEPARATION
    const newSep = currentSep * (targetRad / measuredRad)
    document.getElementById('calNewSep').textContent = newSep.toFixed(6) + ' m'
    document.getElementById('calSepResult').style.display = 'block'
    console.log('Proposed wheel_separation:', newSep)
}

fetchCalibrationParams()

window.fetchCalibrationParams = fetchCalibrationParams
window.startLinearCal = startLinearCal
window.stopLinearCal = stopLinearCal
window.startRotationCal = startRotationCal
window.stopRotationCal = stopRotationCal
window.calculateRadius = calculateRadius
window.calculateSeparation = calculateSeparation

// ===== LiDAR-based Rotation Calibration =====
// Detects a wall placed in front of the robot and measures the true
// rotation angle from the change in wall normal direction.
let latestScan = null
let lidarCalWait = 'idle' // 'idle' | 'pre' | 'rotate' | 'post'
let lidarCalPreAngle = null
let lidarCalActive = false

scanTopic.subscribe(function(msg) {
    latestScan = msg
    if (lidarCalWait === 'pre') {
        const result = detectWall(msg)
        if (result !== null) {
            lidarCalPreAngle = result.angle
            lidarCalWait = 'rotate'
            document.getElementById('calStatus').textContent = 'LiDAR: pre-angle captured, rotating...'
            console.log('LiDAR pre-angle:', (result.angle * 180 / Math.PI).toFixed(2) + '°', 'points:', result.count, 'avgDist:', result.avgDist.toFixed(3) + 'm')
            calibrate('rotate_left', 0.628, 10)
            setTimeout(() => {
                lidarCalWait = 'post'
                document.getElementById('calStatus').textContent = 'LiDAR: capturing post-angle (wait 1.5s)...'
                setTimeout(captureLidarPostAngle, 1500)
            }, 10000)
        }
    }
})

function detectWall(scan) {
    const ranges = scan.ranges
    const angleMin = scan.angle_min
    const angleInc = scan.angle_increment
    const windowRad = 45 * Math.PI / 180 // front ±45° (widened for robustness)
    let sumX = 0, sumY = 0, count = 0, sumR = 0
    for (let i = 0; i < ranges.length; i++) {
        const r = ranges[i]
        if (!isFinite(r) || r < 0.1 || r > 5.0) continue // valid range 0.1~5m
        const angle = angleMin + i * angleInc
        if (Math.abs(angle) > windowRad) continue
        const x = r * Math.cos(angle)
        const y = r * Math.sin(angle)
        sumX += x
        sumY += y
        sumR += r
        count++
    }
    if (count < 10) {
        console.log('LiDAR wall detect failed: only', count, 'points in ±45°')
        return null
    }
    const angle = Math.atan2(sumY, sumX)
    const avgDist = sumR / count
    // Sanity check: wall should be roughly perpendicular to robot's facing (angle near 0)
    // and at a reasonable distance
    if (Math.abs(angle) > 30 * Math.PI / 180) {
        console.log('LiDAR wall detect rejected: centroid angle too skewed:', (angle * 180 / Math.PI).toFixed(2) + '°')
        return null
    }
    return { angle, count, avgDist }
}

function startLidarRotationCal() {
    if (lidarCalActive) {
        alert('LiDAR calibration already in progress.')
        return
    }
    if (!latestScan) {
        alert('No LiDAR scan received yet. Make sure /scan is publishing.')
        return
    }
    lidarCalActive = true
    resetCalibration()
    lidarCalWait = 'pre'
    document.getElementById('calStatus').textContent = 'LiDAR: place wall in front, capturing pre-angle...'
}

function captureLidarPostAngle() {
    if (lidarCalWait !== 'post') return
    if (!latestScan) {
        document.getElementById('calStatus').textContent = 'LiDAR: no scan data'
        lidarCalWait = 'idle'
        lidarCalActive = false
        return
    }
    const result = detectWall(latestScan)
    if (result === null) {
        document.getElementById('calStatus').textContent = 'LiDAR: wall not detected after rotation (need ±45° window, 10+ points, 0.1~5m range)'
        lidarCalWait = 'idle'
        lidarCalActive = false
        return
    }
    const angle = result.angle
    console.log('LiDAR post-angle:', (angle * 180 / Math.PI).toFixed(2) + '°', 'points:', result.count, 'avgDist:', result.avgDist.toFixed(3) + 'm')
    let diffRad = angle - lidarCalPreAngle
    while (diffRad > Math.PI) diffRad -= 2 * Math.PI
    while (diffRad < -Math.PI) diffRad += 2 * Math.PI
    const diffDeg = diffRad * 180 / Math.PI
    document.getElementById('calMeasuredRot').value = diffDeg.toFixed(2)
    document.getElementById('calStatus').textContent = `LiDAR: measured rotation = ${diffDeg.toFixed(2)}° (${result.count}pts, avg ${result.avgDist.toFixed(2)}m)`
    lidarCalWait = 'idle'
    lidarCalActive = false
}

window.startLidarRotationCal = startLidarRotationCal
