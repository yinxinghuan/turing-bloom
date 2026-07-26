/**
 * Turing Bloom
 *
 * Reaction-diffusion simulation adapted directly from Amanda Ghassaei's
 * gpu-io reaction-diffusion example:
 * https://github.com/amandaghassaei/gpu-io/tree/main/examples/reaction-diffusion
 *
 * Original code and gpu-io are MIT licensed.
 * Copyright (c) 2020 Amanda Ghassaei.
 */
import {
  GPUComposer,
  GPUProgram,
  GPULayer,
  FLOAT,
  INT,
  CLAMP_TO_EDGE,
  LINEAR,
  renderAmplitudeProgram,
  setValueProgram,
} from 'gpu-io'
import './style.css'

const app = document.querySelector('#app')
const canvas = document.querySelector('#field')
const maturityEl = document.querySelector('#maturity')
const demoEl = document.querySelector('#demo')
const gestureEl = document.querySelector('#gesture')
const resultEl = document.querySelector('#result')
const resultSpeciesEl = document.querySelector('#result-species')
const resultDetailEl = document.querySelector('#result-detail')
const resetButton = document.querySelector('#reset')
const againButton = document.querySelector('#again')
const errorEl = document.querySelector('#error')
const retryButton = document.querySelector('#retry')

const zh = navigator.language.toLowerCase().startsWith('zh')
const copy = zh
  ? {
      canvas: '可触摸的反应扩散生长场',
      reset: '重新开始',
      gesture: '双指移动 · 缩放参数空间',
      again: '再培养一次',
      error: '这台设备暂时无法培养这片纹样',
    }
  : {
      canvas: 'Interactive reaction diffusion field',
      reset: 'Reset',
      gesture: 'Two fingers move · zoom parameter space',
      again: 'Grow again',
      error: 'This device cannot grow the field yet',
    }

canvas.setAttribute('aria-label', copy.canvas)
resetButton.setAttribute('aria-label', copy.reset)
gestureEl.textContent = copy.gesture
againButton.textContent = copy.again
errorEl.querySelector('p').textContent = copy.error

const PARAMS_DEFAULT = Object.freeze({
  diffusionA: 0.2097,
  diffusionB: 0.105,
  feedMin: 0.016,
  feedMax: 0.044,
  removalMin: 0.05,
  removalMax: 0.066,
})

const params = { ...PARAMS_DEFAULT }
const activePointers = new Map()
const visitedZones = new Set()
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

let composer
let state
let reactionProgram
let renderProgram
let touchProgram
let transformProgram
let frameId = 0
let resizeTimer = 0
let pinchState = null
let isVisible = false
let hasInteracted = false
let hasShownGesture = false
let phase = 'idle'
let pathDistance = 0
let lastSoloPoint = null
let lastMaturity = 0
let lastInputAt = 0
let maturityTonePlayed = false
let audioContext = null

const SIM_SCALE = innerWidth <= 430 ? 1.55 : 1.35
const STEPS_PER_FRAME = innerWidth <= 430 ? 6 : 8

function createPrograms() {
  composer = new GPUComposer({ canvas })

  state = new GPULayer(composer, {
    name: 'state',
    dimensions: [2, 2],
    numComponents: 2,
    type: FLOAT,
    filter: LINEAR,
    numBuffers: 2,
    wrapX: CLAMP_TO_EDGE,
    wrapY: CLAMP_TO_EDGE,
  })

  reactionProgram = new GPUProgram(composer, {
    name: 'reactionDiffusion',
    fragmentShader: `
      in vec2 v_uv;

      uniform sampler2D u_state;
      uniform vec2 u_pxSize;
      uniform vec2 u_feedRateBounds;
      uniform vec2 u_removalRateBounds;
      uniform float u_diffusionA;
      uniform float u_diffusionB;

      out vec2 out_state;

      void main() {
        vec2 current = texture(u_state, v_uv).xy;
        vec2 n = texture(u_state, v_uv + vec2(u_pxSize.x, 0.0)).xy;
        vec2 s = texture(u_state, v_uv - vec2(u_pxSize.x, 0.0)).xy;
        vec2 e = texture(u_state, v_uv + vec2(0.0, u_pxSize.y)).xy;
        vec2 w = texture(u_state, v_uv - vec2(0.0, u_pxSize.y)).xy;
        vec2 laplacian = n + s + e + w - 4.0 * current;

        float reaction = current.x * current.y * current.y;
        float removalRate = mix(u_removalRateBounds.x, u_removalRateBounds.y, v_uv.x);
        float feedRate = mix(u_feedRateBounds.x, u_feedRateBounds.y, v_uv.y);

        out_state = clamp(current + vec2(
          u_diffusionA * laplacian.x - reaction + feedRate * (1.0 - current.x),
          u_diffusionB * laplacian.y + reaction - (removalRate + feedRate) * current.y
        ), 0.0, 1.0);
      }
    `,
    uniforms: [
      { name: 'u_state', value: 0, type: INT },
      { name: 'u_pxSize', value: [0.5, 0.5], type: FLOAT },
      { name: 'u_feedRateBounds', value: [params.feedMin, params.feedMax], type: FLOAT },
      { name: 'u_removalRateBounds', value: [params.removalMin, params.removalMax], type: FLOAT },
      { name: 'u_diffusionA', value: params.diffusionA, type: FLOAT },
      { name: 'u_diffusionB', value: params.diffusionB, type: FLOAT },
    ],
  })

  renderProgram = renderAmplitudeProgram(composer, {
    name: 'renderChemicalB',
    type: state.type,
    scale: 3,
    components: 'y',
  })

  touchProgram = setValueProgram(composer, {
    name: 'seed',
    type: state.type,
    value: [0.5, 0.5],
  })

  transformProgram = new GPUProgram(composer, {
    name: 'transformState',
    fragmentShader: `
      in vec2 v_uv;
      uniform sampler2D u_state;
      uniform vec2 u_offset;
      uniform float u_scale;
      out vec2 out_state;

      void main() {
        vec2 uv = u_offset + u_scale * v_uv;
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
          out_state = vec2(0.5);
        } else {
          out_state = texture(u_state, uv).xy;
        }
      }
    `,
    uniforms: [
      { name: 'u_state', value: 0, type: INT },
      { name: 'u_offset', value: [0, 0], type: FLOAT },
      { name: 'u_scale', value: 1, type: FLOAT },
    ],
  })
}

function getSize() {
  const rect = app.getBoundingClientRect()
  return {
    width: Math.max(2, Math.round(rect.width)),
    height: Math.max(2, Math.round(rect.height)),
  }
}

function randomState(width, height) {
  const simWidth = Math.max(2, Math.round(width / SIM_SCALE))
  const simHeight = Math.max(2, Math.round(height / SIM_SCALE))
  const values = new Float32Array(simWidth * simHeight * 2)
  for (let i = 0; i < values.length; i += 2) {
    values[i] = 0.5 + Math.random() * 0.5
    values[i + 1] = 0.5 + Math.random() * 0.5
  }
  return { simWidth, simHeight, values }
}

function resizeSimulation(reseed = true) {
  const { width, height } = getSize()
  composer.resize([width, height])
  const { simWidth, simHeight, values } = randomState(width, height)
  state.resize([simWidth, simHeight], reseed ? values : undefined)
  reactionProgram.setUniform('u_pxSize', [1 / simWidth, 1 / simHeight])
}

function updateBounds() {
  reactionProgram.setUniform('u_feedRateBounds', [params.feedMin, params.feedMax])
  reactionProgram.setUniform('u_removalRateBounds', [params.removalMin, params.removalMax])
}

function resetSimulation() {
  Object.assign(params, PARAMS_DEFAULT)
  updateBounds()
  resizeSimulation(true)
  hasInteracted = false
  phase = 'idle'
  pathDistance = 0
  lastSoloPoint = null
  lastMaturity = 0
  lastInputAt = 0
  maturityTonePlayed = false
  visitedZones.clear()
  maturityEl.textContent = '00'
  demoEl.hidden = false
  resultEl.hidden = true
  gestureEl.classList.remove('tb__hidden-gesture--show')
}

function tone(frequency, duration, delay = 0, volume = 0.012) {
  try {
    audioContext ??= new AudioContext()
    if (audioContext.state === 'suspended') void audioContext.resume()
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()
    const start = audioContext.currentTime + delay
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(frequency, start)
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.25, start + duration)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.018)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    oscillator.connect(gain).connect(audioContext.destination)
    oscillator.start(start)
    oscillator.stop(start + duration + 0.03)
  } catch {
    // Sound is optional.
  }
}

function beginIncubation() {
  if (phase !== 'idle') return
  phase = 'running'
  lastInputAt = performance.now()
  demoEl.hidden = true
  tone(92, 0.18, 0, 0.018)
}

function finishIncubation() {
  if (phase !== 'running') return
  phase = 'result'
  const species = visitedZones.size >= 7
    ? 'LABYRINTH'
    : pathDistance >= 760
      ? 'CORAL'
      : 'CELLULAR'
  resultSpeciesEl.textContent = species
  resultDetailEl.textContent = `${String(visitedZones.size).padStart(2, '0')} ZONES / STABLE`
  resultEl.hidden = false
  tone(330, 0.26, 0, 0.014)
  tone(440, 0.26, 0.09, 0.014)
  tone(660, 0.26, 0.18, 0.014)
}

function updateMaturity(now) {
  if (phase !== 'running') return
  const maturity = Math.min(100, Math.round(Math.min(pathDistance, 1600) * 0.12 + visitedZones.size * 12))
  if (maturity !== lastMaturity) {
    lastMaturity = maturity
    maturityEl.textContent = String(maturity).padStart(2, '0')
  }
  if (maturity >= 100 && !maturityTonePlayed) {
    maturityTonePlayed = true
    tone(260, 0.12, 0, 0.008)
  }
  if (maturity >= 100 && activePointers.size === 0 && now - lastInputAt >= 1800) finishIncubation()
}

function seedAt(clientX, clientY, diameter = 34, isDemo = false) {
  const rect = canvas.getBoundingClientRect()
  if (!rect.width || !rect.height) return
  const x = clientX - rect.left
  const y = clientY - rect.top
  if (x < 0 || x > rect.width || y < 0 || y > rect.height) return

  composer.stepCircle({
    program: touchProgram,
    output: state,
    position: [x, rect.height - y],
    diameter,
  })

  if (isDemo) return
  const zoneX = Math.min(2, Math.floor((x / rect.width) * 3))
  const zoneY = Math.min(2, Math.floor((y / rect.height) * 3))
  const zone = zoneY * 3 + zoneX
  if (!visitedZones.has(zone)) {
    visitedZones.add(zone)
    tone(240 + zone * 35, 0.09, 0, 0.01)
  }
}

function applyZoom(centerX, centerY, scale) {
  const { width, height } = getSize()
  const fractionF = 1 - centerY / height
  const fractionK = centerX / width
  let scaleF = params.feedMax - params.feedMin
  let scaleK = params.removalMax - params.removalMin
  const centerF = fractionF * scaleF + params.feedMin
  const centerK = fractionK * scaleK + params.removalMin
  scaleF = Math.max(scaleF * scale, 1e-6)
  scaleK = Math.max(scaleK * scale, 1e-6)
  params.feedMin = centerF - scaleF * fractionF
  params.feedMax = centerF + scaleF * (1 - fractionF)
  params.removalMin = centerK - scaleK * fractionK
  params.removalMax = centerK + scaleK * (1 - fractionK)
  updateBounds()

  transformProgram.setUniform('u_scale', scale)
  transformProgram.setUniform('u_offset', [(1 - scale) * fractionK, (1 - scale) * fractionF])
  composer.step({ program: transformProgram, input: state, output: state })
}

function applyPan(deltaX, deltaY) {
  const { width, height } = getSize()
  const scaleF = params.feedMax - params.feedMin
  const scaleK = params.removalMax - params.removalMin
  const dx = deltaX / width
  const dy = -deltaY / height
  params.feedMin -= scaleF * dy
  params.feedMax -= scaleF * dy
  params.removalMin -= scaleK * dx
  params.removalMax -= scaleK * dx
  updateBounds()

  transformProgram.setUniform('u_scale', 1)
  transformProgram.setUniform('u_offset', [-dx, -dy])
  composer.step({ program: transformProgram, input: state, output: state })
}

function twoPointerMetrics() {
  const points = [...activePointers.values()]
  if (points.length !== 2) return null
  const dx = points[0].x - points[1].x
  const dy = points[0].y - points[1].y
  return {
    distance: Math.hypot(dx, dy),
    centerX: (points[0].x + points[1].x) / 2,
    centerY: (points[0].y + points[1].y) / 2,
  }
}

function showHiddenGestureHint() {
  if (hasShownGesture) return
  hasShownGesture = true
  gestureEl.classList.add('tb__hidden-gesture--show')
  window.setTimeout(() => gestureEl.classList.remove('tb__hidden-gesture--show'), 2400)
}

function onPointerDown(event) {
  if (phase === 'result') return
  event.preventDefault()
  lastInputAt = performance.now()
  canvas.setPointerCapture?.(event.pointerId)
  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  if (activePointers.size === 2) {
    pinchState = twoPointerMetrics()
    lastSoloPoint = null
    showHiddenGestureHint()
  } else {
    lastSoloPoint = { x: event.clientX, y: event.clientY }
  }
}

function onPointerMove(event) {
  if (!activePointers.has(event.pointerId) || phase === 'result') return
  event.preventDefault()
  const previous = activePointers.get(event.pointerId)
  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

  if (activePointers.size === 1) {
    if (!hasInteracted) hasInteracted = true
    beginIncubation()
    demoEl.hidden = true
    const distance = Math.hypot(event.clientX - previous.x, event.clientY - previous.y)
    pathDistance += Math.min(distance, 80)
    lastInputAt = performance.now()
    seedAt(event.clientX, event.clientY)
    lastSoloPoint = { x: event.clientX, y: event.clientY }
    return
  }

  if (activePointers.size === 2 && pinchState) {
    const next = twoPointerMetrics()
    if (!next) return
    const scale = Math.max(0.82, Math.min(1.18, pinchState.distance / Math.max(next.distance, 1)))
    applyZoom(next.centerX, next.centerY, scale)
    applyPan(next.centerX - pinchState.centerX, next.centerY - pinchState.centerY)
    pinchState = next
  }
}

function onPointerEnd(event) {
  activePointers.delete(event.pointerId)
  if (activePointers.size !== 2) pinchState = null
  if (activePointers.size === 1) {
    const point = [...activePointers.values()][0]
    lastSoloPoint = { ...point }
  } else if (activePointers.size === 0) {
    lastSoloPoint = null
    lastInputAt = performance.now()
  }
}

function injectDemo(now) {
  if (hasInteracted || phase !== 'idle' || reducedMotion) return
  const rect = canvas.getBoundingClientRect()
  const cycle = (now % 3600) / 3600
  if (cycle < 0.16 || cycle > 0.78) return
  const progress = (cycle - 0.16) / 0.62
  const x = rect.left + rect.width * (0.28 + 0.42 * progress)
  const y = rect.top + rect.height * (0.58 - 0.11 * Math.sin(progress * Math.PI))
  seedAt(x, y, 28, true)
}

function loop(now) {
  frameId = 0
  if (!isVisible || document.hidden || !composer) return

  injectDemo(now)
  const steps = phase === 'result' ? Math.max(3, Math.floor(STEPS_PER_FRAME / 2)) : STEPS_PER_FRAME
  for (let i = 0; i < steps; i += 1) {
    composer.step({ program: reactionProgram, input: state, output: state })
  }
  composer.step({ program: renderProgram, input: state })
  updateMaturity(now)
  frameId = requestAnimationFrame(loop)
}

function requestLoop() {
  if (!frameId && isVisible && !document.hidden && composer) {
    frameId = requestAnimationFrame(loop)
  }
}

function setVisibility(visible) {
  if (visible === isVisible) return
  isVisible = visible
  if (!visible) {
    cancelAnimationFrame(frameId)
    frameId = 0
  } else {
    requestLoop()
  }
}

function onDocumentVisibility() {
  if (document.hidden) {
    cancelAnimationFrame(frameId)
    frameId = 0
  } else {
    requestLoop()
  }
}

function init() {
  try {
    createPrograms()
    resizeSimulation(true)

    const observer = new IntersectionObserver(
      ([entry]) => setVisibility(entry.isIntersecting && entry.intersectionRatio >= 0.35),
      { threshold: [0, 0.35, 0.7] },
    )
    observer.observe(app)

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerEnd)
    canvas.addEventListener('pointercancel', onPointerEnd)
    canvas.addEventListener('lostpointercapture', onPointerEnd)
    canvas.addEventListener('contextmenu', (event) => event.preventDefault())
    document.addEventListener('visibilitychange', onDocumentVisibility)

    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(() => resizeSimulation(true), 160)
    })

    resetButton.addEventListener('pointerdown', (event) => {
      event.stopPropagation()
      resetSimulation()
    })
    againButton.addEventListener('pointerdown', (event) => {
      event.stopPropagation()
      resetSimulation()
    })
    retryButton.addEventListener('pointerdown', () => location.reload())
  } catch (error) {
    console.error('[TuringBloom] gpu-io initialization failed', error)
    errorEl.hidden = false
  }
}

init()
