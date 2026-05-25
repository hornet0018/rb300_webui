import './style.css'

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

let encoderL = 0, encoderR = 0
let prevEncoderL = 0, prevEncoderR = 0
let encoderLSpeed = 0, encoderRSpeed = 0
let encoderTotalL = 0, encoderTotalR = 0

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

const sysHistory = { cpu: [], mem: [] }
const MAX_HISTORY = 60

cpuTopic.subscribe(function(msg) {
    const val = msg.data
    document.getElementById('cpuUsage').textContent = val.toFixed(1) + '%'
    document.getElementById('headerCpu').textContent = val.toFixed(1) + '%'
    updateSystemStatus(val, parseFloat(document.getElementById('memPercent').textContent) || 0)
    updateRawSystem()
    sysHistory.cpu.push(val)
    if (sysHistory.cpu.length > MAX_HISTORY) sysHistory.cpu.shift()
    drawSysChart()
})
memAvailTopic.subscribe(function(msg) {
    document.getElementById('memAvailable').textContent = msg.data.toFixed(2) + ' GB'
    updateRawSystem()
})
memPercentTopic.subscribe(function(msg) {
    const val = msg.data
    document.getElementById('memPercent').textContent = val.toFixed(1) + '%'
    document.getElementById('headerMem').textContent = val.toFixed(1) + '%'
    updateSystemStatus(parseFloat(document.getElementById('cpuUsage').textContent) || 0, val)
    sysHistory.mem.push(val)
    if (sysHistory.mem.length > MAX_HISTORY) sysHistory.mem.shift()
    drawSysChart()
    updateRawSystem()
})

function updateRawSystem() {
    document.getElementById('rawSystem').textContent = JSON.stringify({
        cpu: document.getElementById('cpuUsage').textContent,
        memAvailable: document.getElementById('memAvailable').textContent,
        memPercent: document.getElementById('memPercent').textContent,
    }, null, 2)
}

// System Chart
const sysCanvas = document.getElementById('sysChart')
const sysCtx = sysCanvas.getContext('2d')
function drawSysChart() {
    const w = sysCanvas.width, h = sysCanvas.height
    sysCtx.fillStyle = '#0f0f1a'
    sysCtx.fillRect(0, 0, w, h)
    sysCtx.strokeStyle = '#2a2a3e'
    sysCtx.lineWidth = 1
    for (let y = 0; y <= h; y += 30) {
        sysCtx.beginPath(); sysCtx.moveTo(0, y); sysCtx.lineTo(w, y); sysCtx.stroke()
    }

    if (sysHistory.cpu.length < 2) return

    const step = w / MAX_HISTORY

    // CPU line (blue)
    sysCtx.strokeStyle = '#4dabf7'
    sysCtx.lineWidth = 2
    sysCtx.beginPath()
    for (let i = 0; i < sysHistory.cpu.length; i++) {
        const x = i * step
        const y = h - (sysHistory.cpu[i] / 100) * h
        if (i === 0) sysCtx.moveTo(x, y)
        else sysCtx.lineTo(x, y)
    }
    sysCtx.stroke()

    // Mem line (red)
    sysCtx.strokeStyle = '#ff6b6b'
    sysCtx.lineWidth = 2
    sysCtx.beginPath()
    for (let i = 0; i < sysHistory.mem.length; i++) {
        const x = i * step
        const y = h - (sysHistory.mem[i] / 100) * h
        if (i === 0) sysCtx.moveTo(x, y)
        else sysCtx.lineTo(x, y)
    }
    sysCtx.stroke()

    // Labels
    sysCtx.fillStyle = '#8a8a9e'
    sysCtx.font = '10px sans-serif'
    sysCtx.fillText('CPU', 4, 12)
    sysCtx.fillStyle = '#ff6b6b'
    sysCtx.fillText('Mem', 4, 24)
}

// ===== Encoders =====
encoderLTopic.subscribe(function(msg) {
    const val = msg.data
    encoderLSpeed = val - prevEncoderL
    prevEncoderL = val
    encoderL = val
    encoderTotalL += Math.abs(encoderLSpeed) * 0.0473  // rough dist (rad * r)
    document.getElementById('encoderL').textContent = val.toFixed(3)
    document.getElementById('encoderLSpeed').textContent = encoderLSpeed.toFixed(3)
    updateEncoderDiff()
    updateRawEncoder()
})
encoderRTopic.subscribe(function(msg) {
    const val = msg.data
    encoderRSpeed = val - prevEncoderR
    prevEncoderR = val
    encoderR = val
    encoderTotalR += Math.abs(encoderRSpeed) * 0.0473
    document.getElementById('encoderR').textContent = val.toFixed(3)
    document.getElementById('encoderRSpeed').textContent = encoderRSpeed.toFixed(3)
    updateEncoderDiff()
    updateRawEncoder()
})
function updateEncoderDiff() {
    document.getElementById('encoderDiff').textContent = (encoderR - encoderL).toFixed(3)
    document.getElementById('encoderTotal').textContent = ((encoderTotalL + encoderTotalR) / 2).toFixed(3)
}
function updateRawEncoder() {
    document.getElementById('rawEncoder').textContent = JSON.stringify({
        left: encoderL.toFixed(4),
        right: encoderR.toFixed(4),
        diff: (encoderR - encoderL).toFixed(4),
        lSpeed: encoderLSpeed.toFixed(4),
        rSpeed: encoderRSpeed.toFixed(4),
        totalDist: ((encoderTotalL + encoderTotalR) / 2).toFixed(4)
    }, null, 2)
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

    if (!manualModeEnabled) {
        // stop robot via topic if needed
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
        if (gamepad) { gamepad = null }
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
        requestAnimationFrame(updateGamepad)
        return
    }

    const rawLinear = -gamepad.axes[1]
    const rawAngular = -gamepad.axes[0]
    const linear = applyDeadzone(rawLinear) * GP_MAX_LINEAR
    const angular = applyDeadzone(rawAngular) * GP_MAX_ANGULAR

    document.getElementById('gpCmdLinear').textContent = linear.toFixed(3)
    document.getElementById('gpCmdAngular').textContent = angular.toFixed(3)

    requestAnimationFrame(updateGamepad)
}

window.addEventListener('gamepadconnected', (e) => {
    console.log('Gamepad connected:', e.gamepad.id)
    populateGamepadList()
})
window.addEventListener('gamepaddisconnected', (e) => {
    console.log('Gamepad disconnected:', e.gamepad.id)
    populateGamepadList()
})

requestAnimationFrame(updateGamepad)

// ===== Panel Toggle =====
function togglePanel(id) {
    const panel = document.getElementById('panel-' + id)
    if (panel) {
        panel.style.display = panel.style.display === 'none' ? '' : 'none'
    }
}

// ===== Init =====
updateManualModeUI()
updateGamepadUI()

// Expose globals
window.toggleManualMode = toggleManualMode
window.toggleGamepad = toggleGamepad
window.onGamepadSelected = onGamepadSelected
window.togglePanel = togglePanel
