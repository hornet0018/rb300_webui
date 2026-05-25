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
const mapTopic = new ROSLIB.Topic({
    ros, name: '/map', messageType: 'nav_msgs/msg/OccupancyGrid'
})
const batteryTopic = new ROSLIB.Topic({
    ros, name: 'esp/battery_voltage', messageType: 'std_msgs/msg/Float32'
})

// ===== SLAM Control Topics & Services =====
// Adjust these to match your SLAM package (slam_toolbox, cartographer, gmapping, etc.)
const SLAM_COMMAND_TOPIC = '/rb300_webui/slam_command'   // std_msgs/String: "start" | "stop"
const SAVE_MAP_SERVICE   = '/slam_toolbox/save_map'       // slam_toolbox/srv/SaveMap
const SERIALIZE_SERVICE  = '/slam_toolbox/serialize_map' // slam_toolbox/srv/SerializePoseGraph

const slamCommandTopic = new ROSLIB.Topic({
    ros, name: SLAM_COMMAND_TOPIC, messageType: 'std_msgs/msg/String'
})

let saveMapClient = null
try {
    saveMapClient = new ROSLIB.Service({ ros, name: SAVE_MAP_SERVICE, serviceType: 'slam_toolbox/srv/SaveMap' })
} catch (e) { console.warn('SaveMap service not available:', e) }

let serializeClient = null
try {
    serializeClient = new ROSLIB.Service({ ros, name: SERIALIZE_SERVICE, serviceType: 'slam_toolbox/srv/SerializePoseGraph' })
} catch (e) { console.warn('SerializePoseGraph service not available:', e) }


let cmdInterval = null

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
    cmdInterval = setInterval(() => publishCmdVel(linear, angular), 100)
    setTimeout(stopRobot, duration * 1000)
}
function customMove() {
    const linear = parseFloat(document.getElementById('linearSpeed').value) || 0
    const angular = parseFloat(document.getElementById('angularSpeed').value) || 0
    const duration = parseFloat(document.getElementById('duration').value) || 5
    stopRobot()
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
const GP_MAX_LINEAR = 0.3
const GP_MAX_ANGULAR = 1.0
const GP_DEADZONE = 0.15
let gamepad = null
let selectedGamepadIndex = -1
let manualModeEnabled = false
let gamepadEnabled = false

document.getElementById('gpMaxLin').textContent = GP_MAX_LINEAR.toFixed(1)
document.getElementById('gpMaxAng').textContent = GP_MAX_ANGULAR.toFixed(1)

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

    const header = document.getElementById('headerManual')
    header.textContent = manualModeEnabled ? 'Manual' : 'Auto'
    header.className = 'status-badge ' + (manualModeEnabled ? 'on' : 'off')

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

    const prevSelection = select.value
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

    for (let i = 0; i < gamepad.buttons.length && i < 16; i++) {
        const btn = document.getElementById('gpBtn' + i)
        if (!btn) continue
        const pressed = gamepad.buttons[i].pressed
        if (pressed) btn.classList.add('pressed')
        else btn.classList.remove('pressed')
    }

    if (!manualModeEnabled || !gamepadEnabled) {
        document.getElementById('gpCmdLinear').textContent = '0.000'
        document.getElementById('gpCmdAngular').textContent = '0.000'
        if (!cmdInterval) publishCmdVel(0, 0)
        requestAnimationFrame(updateGamepad)
        return
    }

    const rawLinear = -gamepad.axes[1]
    const rawAngular = -gamepad.axes[0]

    const linear = applyDeadzone(rawLinear) * GP_MAX_LINEAR
    const angular = applyDeadzone(rawAngular) * GP_MAX_ANGULAR

    document.getElementById('gpCmdLinear').textContent = linear.toFixed(3)
    document.getElementById('gpCmdAngular').textContent = angular.toFixed(3)

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
    if (selectedGamepadIndex === e.gamepad.index) {
        stopRobot()
    }
})

requestAnimationFrame(updateGamepad)

// ===== Map Canvas =====
const mapCanvas = document.getElementById('mapCanvas')
const mapCtx = mapCanvas.getContext('2d')
let currentMap = null
let mapMeta = null
let robotMapPose = null

function resizeMapCanvas() {
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
    if (!currentMap) return
    resizeMapCanvas()
    const { width, height, resolution, origin } = currentMap.info
    const data = currentMap.data

    const scaleX = mapCanvas.width / width
    const scaleY = mapCanvas.height / height
    const displayScale = Math.min(scaleX, scaleY)

    const offsetX = (mapCanvas.width - width * displayScale) / 2
    const offsetY = (mapCanvas.height - height * displayScale) / 2

    const imageData = mapCtx.createImageData(width, height)
    for (let i = 0; i < data.length; i++) {
        const v = data[i]
        let r, g, b
        if (v === -1) { r = 200; g = 200; b = 200 }
        else if (v < 50) { r = 255; g = 255; b = 255 }
        else { r = 0; g = 0; b = 0 }
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
    mapCtx.scale(displayScale, -displayScale)
    mapCtx.translate(0, -height)
    mapCtx.drawImage(tmp, 0, 0)
    mapCtx.restore()

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
    document.getElementById('mapInfo').textContent =
        `${width}x${height} @ ${resolution.toFixed(3)} m/cell`
}

function drawRobotOnMap() {
    if (!mapMeta || !robotMapPose) return
    const { displayScale, offsetX, offsetY, height, resolution, origin } = mapMeta

    const mx = (robotMapPose.x - origin.position.x) / resolution
    const my = (robotMapPose.y - origin.position.y) / resolution

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

// ===== Odometry (Header Status + Map Pose) =====
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

    document.getElementById('headerPos').textContent = `${x.toFixed(2)} / ${y.toFixed(2)}`
    document.getElementById('headerVel').textContent = `${linear.toFixed(2)} / ${angular.toFixed(2)}`

    robotMapPose = { x, y, theta }
    drawMap()
    drawRobotOnMap()
})

// ===== Mapping Commands =====
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

    // 1) Try service-based save (slam_toolbox)
    if (saveMapClient) {
        const request = new ROSLIB.ServiceRequest({ name: { data: mapPath } })
        saveMapClient.callService(request, (result) => {
            console.log('Map saved via service:', result)
            alert('Map saved to: ' + mapPath)
        }, (error) => {
            console.error('SaveMap service failed:', error)
            // Fallback to canvas export
            exportMapImage(timestamp)
        })
        return
    }

    // 2) Fallback: export current map canvas as PNG
    exportMapImage(timestamp)
}

function exportMapImage(filename) {
    if (!currentMap) {
        alert('No map received yet. Cannot export.')
        return
    }
    const link = document.createElement('a')
    link.download = 'map_' + filename + '.png'
    link.href = mapCanvas.toDataURL('image/png')
    link.click()
    console.log('Exported map image:', link.download)
    alert('Map image exported: ' + link.download)
}

// ===== Battery Voltage =====
batteryTopic.subscribe(function(msg) {
    const voltage = msg.data
    const el = document.getElementById('headerBattery')
    if (el) el.textContent = voltage.toFixed(2) + ' V'
})

// ===== Init =====
updateManualModeUI()
updateGamepadUI()
document.getElementById('headerPos').textContent = '-- / --'
document.getElementById('headerVel').textContent = '0.00 / 0.00'

// Expose globals for inline onclick handlers
window.startMapping = startMapping
window.stopMapping = stopMapping
window.saveMap = saveMap
window.clearMapOverlay = clearMapOverlay
window.calibrate = calibrate
window.stopRobot = stopRobot
window.customMove = customMove
window.setContinuous = setContinuous
window.startDPad = startDPad
window.toggleManualMode = toggleManualMode
window.toggleGamepad = toggleGamepad
window.onGamepadSelected = onGamepadSelected
