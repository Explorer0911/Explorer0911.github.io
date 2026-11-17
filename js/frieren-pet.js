/*
 * frieren-pet.js — 网页版 Frieren 像素桌宠
 * 复刻 dsh-desktop-pet（DeepSeek Harness 桌宠插件）的核心体验：
 *   待命/东张西望/挥手/跳跃/跑步/喘气/闲逛/打盹 + 台词气泡 + 拖动 + 位置记忆
 * 精灵图：/img/frieren/spritesheet.webp（8 列 × 11 行，单格 192×208）
 * 外部接口：window.FrierenPet = { setStatus(name), show(), hide(), setScale(n) }
 */
(function () {
  'use strict'

  var CELL_W = 192
  var CELL_H = 208
  var SHEET_W = 1536
  var SHEET_H = 2288
  var STORAGE_KEY = 'frieren_pet_state_v1'

  // 动画状态表：与 frieren_pet.py 的 STATES 一一对应
  var STATES = {
    idle:       { row: 0, frames: 7, fps: 6 },
    'run-right':{ row: 1, frames: 8, fps: 10 },
    'run-left': { row: 2, frames: 8, fps: 10 },
    waving:     { row: 3, frames: 4, fps: 8 },
    jumping:    { row: 4, frames: 5, fps: 10 },
    panting:    { row: 6, frames: 6, fps: 6 },
    running:    { row: 7, frames: 6, fps: 10 },
    'look-a':   { row: 9, frames: 8, fps: 6 },
    'look-b':   { row: 10, frames: 8, fps: 6 }
  }

  // 台词池（对齐原版）
  var LINES = {
    idle: ['待命中…', '在呢在呢', '好无聊呀', '摸摸我？', '芙莉莲也想要甜甜圈', '发呆中…', '今天也是好天气'],
    wave: ['你好呀！', '嗨～', '交给我吧！'],
    jump: ['完成啦！', '好耶！', '顺利收工！'],
    walk: ['散步中…', '溜达溜达', '天气不错'],
    hover: ['轻轻飘起～', '呼～', '魔法漂浮中…'],
    pant: ['呼呼…', '累死啦…']
  }

  // 常量（对齐原版参数）
  var DRAG_THRESHOLD = 5        // 判定为拖动的位移阈值 px
  var PANTING_MS = 1300         // 拖完喘气时长
  var HOVER_CYCLES = 3          // 鼠标移入连播跳跃轮数
  var LOOK_CHANCE = 0.045       // 空闲每 tick 随机扭头概率
  var ROAM_IDLE_DELAY = 25000   // 空闲多久开始闲逛 ms
  var ROAM_STEP_MS = 40
  var ROAM_SPEED = 3
  var ROAM_WALK_MIN = 2000
  var ROAM_WALK_MAX = 6000
  var ROAM_REST_MIN = 4000
  var ROAM_REST_MAX = 12000
  var SLEEP_AFTER = 180000      // 无操作多久打盹 ms
  var IDLE_LINE_EVERY = 18000   // 空闲随机台词间隔 ms

  var root = null
  var sprite = null
  var bubble = null
  var zzz = null
  var menu = null
  var mini = null

  var scale = 0.6
  var state = 'idle'
  var frameIdx = 0
  var stateTimer = null
  var stateCyclesLeft = 1
  var stateLoop = false

  var saved = { x: null, y: null, hidden: false, roam: true }

  // ---------- 工具 ----------
  function rand (list) { return list[Math.floor(Math.random() * list.length)] }
  function clamp (v, min, max) { return Math.min(max, Math.max(min, v)) }

  function loadState () {
    try {
      var raw = localStorage.getItem(STORAGE_KEY)
      if (raw) { var data = JSON.parse(raw); for (var k in saved) { if (data[k] !== undefined) saved[k] = data[k] } }
    } catch (e) { /* ignore */ }
  }

  function saveState () {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)) } catch (e) { /* ignore */ }
  }

  // ---------- 帧动画引擎 ----------
  function applyFrame () {
    var spec = STATES[state] || STATES.idle
    var row = spec.row
    var col = frameIdx % spec.frames
    sprite.style.backgroundSize = (SHEET_W * scale) + 'px ' + (SHEET_H * scale) + 'px'
    sprite.style.backgroundPosition = (-col * CELL_W * scale) + 'px ' + (-row * CELL_H * scale) + 'px'
  }

  // mode: 'loop' 循环 | 'once' 播一遍（cycles 指定轮数）
  function play (name, mode, cycles) {
    clearTimeout(stateTimer)
    state = name
    frameIdx = 0
    stateLoop = mode === 'loop'
    stateCyclesLeft = mode === 'loop' ? 0 : (cycles || 1)
    applyFrame()
    if (stateLoop) {
      tickLoop()
    } else {
      tickOnce()
    }
  }

  function tickLoop () {
    var spec = STATES[state] || STATES.idle
    stateTimer = setTimeout(function () {
      frameIdx = (frameIdx + 1) % spec.frames
      applyFrame()
      tickLoop()
    }, 1000 / spec.fps)
  }

  function tickOnce () {
    var spec = STATES[state] || STATES.idle
    stateTimer = setTimeout(function () {
      frameIdx += 1
      if (frameIdx >= spec.frames) {
        frameIdx = 0
        stateCyclesLeft -= 1
        if (stateCyclesLeft > 0) {
          applyFrame()
          tickOnce()
          return
        }
        backToIdle()
        return
      }
      applyFrame()
      tickOnce()
    }, 1000 / spec.fps)
  }

  function backToIdle () {
    clearTimeout(stateTimer)
    state = 'idle'
    frameIdx = 0
    stateLoop = true
    applyFrame()
    tickLoop()
  }

  // ---------- 气泡 ----------
  var bubbleTimer = null
  function say (text, ms) {
    if (!text) { bubble.classList.remove('fp-show'); return }
    bubble.textContent = text
    bubble.classList.add('fp-show')
    clearTimeout(bubbleTimer)
    bubbleTimer = setTimeout(function () { bubble.classList.remove('fp-show') }, ms || 2000)
  }

  // ---------- 位置 ----------
  function applyPosition () {
    if (saved.x !== null && saved.y !== null) {
      root.style.left = saved.x + 'px'
      root.style.top = saved.y + 'px'
      root.style.right = 'auto'
      root.style.bottom = 'auto'
    } else {
      root.style.right = '24px'
      root.style.bottom = '24px'
      root.style.left = 'auto'
      root.style.top = 'auto'
    }
  }

  function resetPosition () {
    saved.x = null
    saved.y = null
    applyPosition()
    saveState()
    say('我回角落待着啦', 1600)
  }

  function savePosition () {
    var rect = root.getBoundingClientRect()
    saved.x = Math.round(clamp(rect.left, 4, window.innerWidth - rect.width - 4))
    saved.y = Math.round(clamp(rect.top, 4, window.innerHeight - rect.height - 4))
    saveState()
  }

  // ---------- 闲逛 ----------
  var roamTimer = null
  var roamDir = 1
  var roamUntil = 0
  var restUntil = 0

  function scheduleRoam () {
    clearTimeout(roamTimer)
    if (!saved.roam) return
    roamTimer = setTimeout(function () {
      roamUntil = Date.now() + randInt(ROAM_WALK_MIN, ROAM_WALK_MAX)
      say(rand(LINES.walk), 1400)
      startRoam()
    }, ROAM_IDLE_DELAY)
  }

  function randInt (a, b) { return Math.floor(a + Math.random() * (b - a)) }

  function startRoam () {
    clearTimeout(roamTimer)
    tickRoam()
  }

  function tickRoam () {
    if (root.dataset.dragging || state !== 'idle') { stopRoam(); return }
    if (Date.now() >= roamUntil) {
      restUntil = Date.now() + randInt(ROAM_REST_MIN, ROAM_REST_MAX)
      play('idle', 'loop')
      roamTimer = setTimeout(function () {
        roamDir = Math.random() < 0.5 ? -1 : 1
        roamUntil = Date.now() + randInt(ROAM_WALK_MIN, ROAM_WALK_MAX)
        tickRoam()
      }, Math.max(0, restUntil - Date.now()))
      return
    }
    var rect = root.getBoundingClientRect()
    var next = rect.left + roamDir * ROAM_SPEED
    if (next < 8 || next > window.innerWidth - rect.width - 8) {
      roamDir = -roamDir
      next = clamp(next, 8, window.innerWidth - rect.width - 8)
    }
    root.style.left = next + 'px'
    root.style.right = 'auto'
    var want = roamDir > 0 ? 'run-right' : 'run-left'
    if (state !== want) play(want, 'loop')
    roamTimer = setTimeout(tickRoam, ROAM_STEP_MS)
  }

  function stopRoam () {
    clearTimeout(roamTimer)
    if (state === 'run-right' || state === 'run-left') backToIdle()
  }

  // ---------- 打盹 ----------
  var sleepTimer = null
  var lastActivity = Date.now()

  function scheduleSleep () {
    clearTimeout(sleepTimer)
    sleepTimer = setTimeout(function () {
      root.classList.add('fp-sleeping')
      clearTimeout(stateTimer)
      state = 'idle'
      frameIdx = 0
      stateLoop = false
      applyFrame()
    }, SLEEP_AFTER)
  }

  function wakeUp () {
    if (root.classList.contains('fp-sleeping')) {
      root.classList.remove('fp-sleeping')
      backToIdle()
      say('嗯？谁叫我…', 1500)
    }
    lastActivity = Date.now()
    scheduleSleep()
  }

  function noteActivity () {
    if (Date.now() - lastActivity > 3000) scheduleSleep()
    lastActivity = Date.now()
    clearTimeout(sleepTimer)
    scheduleSleep()
  }

  // ---------- 手势：单击 / 双击 / 拖动 ----------
  var downX = 0
  var downY = 0
  var moved = false
  var lastTap = 0
  var pressTimer = null

  function onPointerDown (e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    wakeUp()
    downX = e.clientX
    downY = e.clientY
    moved = false
    root.dataset.dragging = '1'
    try { sprite.setPointerCapture(e.pointerId) } catch (err) { /* ignore */ }
  }

  function onPointerMove (e) {
    if (!root.dataset.dragging) return
    var dx = e.clientX - downX
    var dy = e.clientY - downY
    if (!moved && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return
    if (!moved) {
      moved = true
      stopRoam()
      clearTimeout(pressTimer)
    }
    var rect = root.getBoundingClientRect()
    var left = clamp(rect.left + dx, 0, window.innerWidth - rect.width)
    var top = clamp(rect.top + dy, 0, window.innerHeight - rect.height)
    root.style.left = left + 'px'
    root.style.top = top + 'px'
    root.style.right = 'auto'
    root.style.bottom = 'auto'
    var want = dx >= 0 ? 'run-right' : 'run-left'
    if (state !== want) play(want, 'loop')
    downX = e.clientX
    downY = e.clientY
  }

  function onPointerUp (e) {
    if (!root.dataset.dragging) return
    delete root.dataset.dragging
    try { sprite.releasePointerCapture(e.pointerId) } catch (err) { /* ignore */ }

    if (moved) {
      savePosition()
      say(rand(LINES.pant), 1400)
      play('panting', 'once', 1)
      setTimeout(function () { backToIdle(); scheduleRoam() }, PANTING_MS)
      return
    }

    var now = Date.now()
    if (now - lastTap < 300) {
      clearTimeout(pressTimer)
      lastTap = 0
      say(rand(LINES.jump), 1600)
      play('jumping', 'once', 1)
    } else {
      lastTap = now
      clearTimeout(pressTimer)
      pressTimer = setTimeout(function () {
        say(rand(LINES.wave), 1600)
        play('waving', 'once', 1)
      }, 300)
    }
    scheduleRoam()
  }

  // ---------- 魔法漂浮（鼠标移入） ----------
  var hoverCool = 0
  function onPointerEnter () {
    var now = Date.now()
    if (now - hoverCool < 1500) return
    hoverCool = now
    stopRoam()
    say(rand(LINES.hover), 1600)
    play('jumping', 'once', HOVER_CYCLES)
  }

  // ---------- 菜单 ----------
  function toggleMenu (show) {
    var open = show !== undefined ? show : !menu.classList.contains('fp-open')
    menu.classList.toggle('fp-open', open)
    root.classList.toggle('fp-gear-open', open)
  }

  function showMini () {
    root.hidden = true
    mini.hidden = false
  }

  function restorePet () {
    mini.hidden = true
    root.hidden = false
    saved.hidden = false
    saveState()
    backToIdle()
    scheduleRoam()
    say('我回来啦！', 1600)
    noteActivity()
  }

  function hidePet () {
    saved.hidden = true
    saveState()
    clearTimeout(stateTimer)
    clearTimeout(roamTimer)
    showMini()
  }

  // ---------- 初始化 ----------
  function buildDom () {
    root = document.createElement('div')
    root.id = 'frieren-pet'

    bubble = document.createElement('div')
    bubble.className = 'fp-bubble'

    zzz = document.createElement('div')
    zzz.className = 'fp-zzz'
    zzz.textContent = 'Zzz'

    sprite = document.createElement('div')
    sprite.className = 'fp-sprite'
    sprite.setAttribute('role', 'img')
    sprite.setAttribute('aria-label', '芙莉莲桌宠')

    var gear = document.createElement('button')
    gear.className = 'fp-gear'
    gear.type = 'button'
    gear.title = '桌宠菜单'
    gear.setAttribute('aria-label', '桌宠菜单')
    gear.innerHTML = '&#9881;'

    menu = document.createElement('div')
    menu.className = 'fp-menu'
    menu.innerHTML =
      '<button type="button" data-fp="toggle-roam"></button>' +
      '<button type="button" data-fp="reset">回到右下角</button>' +
      '<div class="fp-sep"></div>' +
      '<button type="button" data-fp="hide">隐藏桌宠</button>'

    root.appendChild(bubble)
    root.appendChild(zzz)
    root.appendChild(sprite)
    root.appendChild(gear)
    root.appendChild(menu)

    document.body.appendChild(root)

    mini = document.createElement('button')
    mini.className = 'fp-mini'
    mini.type = 'button'
    mini.title = '把芙莉莲叫出来'
    mini.hidden = true
    document.body.appendChild(mini)
  }

  function refreshMenuLabel () {
    var btn = menu.querySelector('[data-fp="toggle-roam"]')
    if (btn) btn.textContent = saved.roam ? '自动闲逛：开' : '自动闲逛：关'
  }

  function bindEvents () {
    sprite.addEventListener('pointerdown', onPointerDown)
    sprite.addEventListener('pointermove', onPointerMove)
    sprite.addEventListener('pointerup', onPointerUp)
    sprite.addEventListener('pointercancel', onPointerUp)
    sprite.addEventListener('pointerenter', onPointerEnter)
    sprite.addEventListener('contextmenu', function (e) { e.preventDefault(); toggleMenu() })

    root.querySelector('.fp-gear').addEventListener('click', function (e) {
      e.stopPropagation()
      toggleMenu()
    })

    menu.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-fp]')
      if (!btn) return
      var action = btn.getAttribute('data-fp')
      if (action === 'toggle-roam') {
        saved.roam = !saved.roam
        saveState()
        refreshMenuLabel()
        if (!saved.roam) stopRoam()
        else scheduleRoam()
        say(saved.roam ? '散步去咯～' : '那我乖乖待着', 1500)
      } else if (action === 'reset') {
        resetPosition()
      } else if (action === 'hide') {
        hidePet()
      }
      toggleMenu(false)
    })

    document.addEventListener('pointerdown', function () { toggleMenu(false) })
    document.addEventListener('keydown', noteActivity)
    document.addEventListener('scroll', noteActivity, true)
    document.addEventListener('pointermove', noteActivity)
    window.addEventListener('resize', function () {
      if (saved.x !== null && saved.y !== null) {
        var rect = root.getBoundingClientRect()
        saved.x = clamp(saved.x, 4, window.innerWidth - rect.width - 4)
        saved.y = clamp(saved.y, 4, window.innerHeight - rect.height - 4)
        applyPosition()
      }
    })
  }

  function init () {
    loadState()
    buildDom()
    mini.addEventListener('click', restorePet)
    root.style.setProperty('--fp-scale', String(scale))
    applyPosition()
    refreshMenuLabel()

    if (saved.hidden) {
      showMini()
      return
    }

    bindEvents()
    play('idle', 'loop')
    scheduleRoam()
    scheduleSleep()

    // 空闲随机台词 / 东张西望
    setInterval(function () {
      if (state === 'idle' && !root.dataset.dragging && !root.hidden) {
        if (Math.random() < 0.5) say(rand(LINES.idle), 1800)
        if (Math.random() < 0.35) {
          play(Math.random() < 0.5 ? 'look-a' : 'look-b', 'once', 1)
        }
      }
    }, IDLE_LINE_EVERY)

    window.FrierenPet = {
      setStatus: function (name) {
        if (STATES[name]) play(name, name === 'idle' ? 'loop' : 'once', 1)
      },
      show: restorePet,
      hide: hidePet,
      setScale: function (n) {
        scale = clamp(n || 0.6, 0.3, 1.2)
        root.style.setProperty('--fp-scale', String(scale))
        applyFrame()
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
