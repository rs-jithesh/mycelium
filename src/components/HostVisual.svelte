<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte'

  export let corruption: number = 0
  export let manifestationQueue: string[] = []
  export let hostName: string = ''
  export let disabled: boolean = false
  export let hostCompleted: boolean = false
  export let firstTime: boolean = false
  export let hostFlavor: string = ''
  export let activeDefenseCount: number = 0

  const dispatch = createEventDispatcher<{ click: void }>()

  // --- Audio: soft thud on click ---
  let audioCtx: AudioContext | null = null

  function playThud() {
    try {
      if (!audioCtx) {
        audioCtx = new AudioContext()
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume()
      }
      const ctx = audioCtx
      const now = ctx.currentTime

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const filter = ctx.createBiquadFilter()

      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(150, now)
      filter.frequency.exponentialRampToValueAtTime(40, now + 0.1)

      osc.type = 'sine'
      osc.frequency.setValueAtTime(80, now)
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.08)

      gain.gain.setValueAtTime(0.3, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.15)
    } catch {
      // audio not supported
    }
  }

  let hintDismissed = false
  $: showHint = firstTime && !hintDismissed && !hostCompleted

  // --- Color interpolation based on corruption ---
  function lerpColor(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
    return [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t),
    ]
  }

  const healthyGreen: [number, number, number] = [0, 255, 65]
  const amber: [number, number, number] = [255, 170, 0]
  const orange: [number, number, number] = [255, 102, 0]
  const deepRed: [number, number, number] = [255, 34, 0]

  $: waveColor = (() => {
    const c = corruption
    let rgb: [number, number, number]
    if (c < 50) {
      const t = c / 49
      rgb = lerpColor(healthyGreen, amber, t)
    } else if (c < 75) {
      const t = (c - 50) / 24
      rgb = lerpColor(amber, orange, t)
    } else if (c < 90) {
      const t = (c - 75) / 14
      rgb = lerpColor(orange, deepRed, t)
    } else {
      rgb = deepRed
    }
    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`
  })()

  $: showFlicker = corruption >= 90

  // --- Amplitude scaling based on corruption ---
  // Healthy: gentle waves (amplitude 1.0), Critical: erratic tall waves (amplitude up to 1.5)
  $: waveAmplitude = 1 + (corruption / 100) * 0.5

  // --- CSS filter values driven by corruption percentage ---
  $: sepia = Math.min(100, corruption * 1.2)
  $: brightness = 100 + corruption * 0.15
  $: contrast = 100 + corruption * 0.4
  $: hueRotate = corruption * 0.35
  $: saturate = 100 + corruption * 0.8
  $: glitchOpacity = corruption > 75 ? (corruption - 75) / 50 : 0
  $: veinOpacity = Math.min(1, corruption / 30)

  $: filterString = `sepia(${sepia}%) brightness(${brightness}%) contrast(${contrast}%) hue-rotate(${hueRotate}deg) saturate(${saturate}%)`

  // Background and border shift with corruption — amber palette
  $: corruptionRed = Math.round(13 + corruption * 0.55)
  $: corruptionGreen = Math.round(13 + corruption * 0.28)
  $: corruptionBlue = Math.round(13 + corruption * 0.03)
  $: bgCenter = `rgb(${corruptionRed + 18}, ${corruptionGreen + 8}, ${corruptionBlue + 2})`
  $: bgEdge = `rgb(${corruptionRed}, ${corruptionGreen}, ${corruptionBlue})`
  $: borderAlpha = Math.min(0.8, corruption / 100)
  $: borderColor = corruption > 5
    ? `rgba(${160 + Math.round(corruption * 0.6)}, ${100 + Math.round(corruption * 0.4)}, ${10 + Math.round(corruption * 0.1)}, ${borderAlpha})`
    : '#2a2a2a'

  // --- Click ripple and wave spike ---
  let hitting = false
  let hitKey = 0
  let hitTimer: ReturnType<typeof setTimeout> | undefined

  let rippleCanvas: HTMLCanvasElement
  let ripples: Array<{ x: number; y: number; startTime: number }> = []
  let animationFrameId: number

  let waveSpike = 0
  let waveSpikeTimer: ReturnType<typeof setTimeout> | undefined

  interface Ripple { x: number; y: number; startTime: number }

  function startRippleAnimation() {
    function animate(now: number) {
      if (!rippleCanvas) return
      const ctx = rippleCanvas.getContext('2d')
      if (!ctx) return

      ctx.clearRect(0, 0, rippleCanvas.width, rippleCanvas.height)

      const duration = 300
      const activeRipples: Ripple[] = []
      for (const r of ripples) {
        const elapsed = Math.max(0, now - r.startTime)
        if (elapsed < duration) {
          const progress = elapsed / duration
          const radius = Math.max(0.1, progress * 60)
          const alpha = Math.max(0, 1 - progress)
          ctx.beginPath()
          ctx.arc(r.x, r.y, radius, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(0, 255, 65, ${alpha * 0.6})`
          ctx.lineWidth = 2
          ctx.stroke()
          activeRipples.push(r)
        }
      }
      ripples = activeRipples

      if (ripples.length > 0) {
        animationFrameId = requestAnimationFrame(animate)
      }
    }
    animationFrameId = requestAnimationFrame(animate)
  }

  function handleClick(e: MouseEvent) {
    if (disabled || hostCompleted) return
    hintDismissed = true
    dispatch('click')
    playThud()

    // Ripple at click position
    if (rippleCanvas) {
      const rect = rippleCanvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const now = performance.now()
      ripples.push({ x, y, startTime: now })
      if (ripples.length === 1) {
        startRippleAnimation()
      }
    }

    // Wave spike
    hitting = false
    hitKey += 1
    waveSpike = 1
    clearTimeout(waveSpikeTimer)
    waveSpikeTimer = setTimeout(() => {
      waveSpike = 0
      hitting = false
    }, 200)
    requestAnimationFrame(() => {
      hitting = true
      clearTimeout(hitTimer)
      hitTimer = setTimeout(() => {
        hitting = false
      }, 1000)
    })
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const rect = rippleCanvas?.getBoundingClientRect()
      handleClick({
        clientX: (rect?.left ?? 0) + (rect?.width ?? 0) / 2,
        clientY: (rect?.top ?? 0) + (rect?.height ?? 0) / 2,
      } as MouseEvent)
    }
  }

  // --- Defense event interference ---
  let defenseNoiseLevel = 0
  let defenseNoiseTimer: ReturnType<typeof setTimeout> | undefined
  let lastDefenseCount = 0

  $: {
    if (activeDefenseCount > 0) {
      if (lastDefenseCount === 0) {
        defenseNoiseLevel = 1
        clearTimeout(defenseNoiseTimer)
        defenseNoiseTimer = setTimeout(() => {
          defenseNoiseLevel = 0.15
        }, 1500)
      }
    } else if (lastDefenseCount > 0) {
      defenseNoiseLevel = 0.5
      clearTimeout(defenseNoiseTimer)
      defenseNoiseTimer = setTimeout(() => {
        defenseNoiseLevel = 0
      }, 500)
    }
    lastDefenseCount = activeDefenseCount
  }

  // --- Waveform path generation ---
  function generateWavePath(baseY: number, amplitude: number, noise: number, seed: number): string {
    const points: string[] = []
    const segments = 10
    const width = 200

    for (let i = 0; i <= segments; i++) {
      const x = (i / segments) * width
      const noiseVal = noise > 0 ? (Math.sin(i * 3 + seed) * 0.3 + Math.sin(i * 7 + seed * 2) * 0.2) * noise : 0
      const y = baseY + (i % 2 === 0 ? amplitude : -amplitude) * (1 + noiseVal)
      points.push(i === 0 ? `M${x},${y}` : `T${x},${y}`)
    }
    return points.join(' ')
  }

  $: waveSeed = Math.random() * 100

  $: path1 = generateWavePath(38, 8 * waveAmplitude + waveSpike * 12, defenseNoiseLevel, waveSeed)
  $: path2 = generateWavePath(20, 5 * waveAmplitude + waveSpike * 8, defenseNoiseLevel, waveSeed + 1)
  $: path3 = generateWavePath(41, 6 * waveAmplitude + waveSpike * 10, defenseNoiseLevel, waveSeed + 2)
  $: path4 = generateWavePath(15, 4 * waveAmplitude + waveSpike * 6, defenseNoiseLevel, waveSeed + 3)
  $: path5 = generateWavePath(48, 4 * waveAmplitude + waveSpike * 8, defenseNoiseLevel, waveSeed + 4)
  $: path6 = generateWavePath(50, 3 * waveAmplitude + waveSpike * 5, defenseNoiseLevel, waveSeed + 5)

  // --- Manifestation toast visibility ---
  let visibleToast: string | null = null
  let toastTimer: ReturnType<typeof setTimeout> | undefined

  $: if (manifestationQueue.length > 0 && manifestationQueue[0] !== visibleToast) {
    visibleToast = manifestationQueue[0]
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      visibleToast = null
    }, 3000)
  }

  onDestroy(() => {
    clearTimeout(toastTimer)
    clearTimeout(hitTimer)
    clearTimeout(waveSpikeTimer)
    clearTimeout(defenseNoiseTimer)
    if (animationFrameId) cancelAnimationFrame(animationFrameId)
  })
</script>

<!-- Hidden SVG filter for pixelation effect -->
<svg class="host-strip__svg-defs" aria-hidden="true">
  <defs>
    <filter id="pixelate-{hitKey}">
      <feFlood x="4" y="4" height="2" width="2"/>
      <feComposite width="10" height="10"/>
      <feTile result="a"/>
      <feComposite in="SourceGraphic" in2="a" operator="in"/>
      <feMorphology operator="dilate" radius="5"/>
    </filter>
  </defs>
</svg>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class="host-strip-container"
  class:host-strip-container--disabled={disabled}
  class:host-strip-container--dead={hostCompleted}
  on:click={handleClick}
  on:keydown={handleKeydown}
  role="button"
  tabindex={hostCompleted ? -1 : 0}
  aria-label={hostCompleted ? 'Host consumed' : 'Initiate absorption'}
  aria-disabled={disabled || hostCompleted}
>
  <div
    class="host-strip"
    class:host-strip--hit={hitting && !hostCompleted}
    class:host-strip--dead={hostCompleted}
    class:host-strip--attention={showHint}
    style={hostCompleted
      ? ''
      : `filter: ${filterString}; background: linear-gradient(90deg, ${bgEdge} 0%, ${bgCenter} 50%, ${bgEdge} 100%); border-color: ${borderColor};`
    }
  >
    <div class="host-strip__base">
      <span class="host-strip__label">
        {#if hostCompleted}
          {hostName.toUpperCase()} — CONSUMED
        {:else}
          {hostName.toUpperCase()}
        {/if}
      </span>
      {#if hostFlavor && !hostCompleted}
        <span class="host-strip__flavor">{hostFlavor}</span>
      {/if}
      {#if showHint}
        <span class="host-strip__hint" aria-hidden="true">click to absorb</span>
      {/if}
    </div>

    {#if !hostCompleted}
      <div class="host-strip__veins" class:host-strip__veins--flicker={showFlicker} style="opacity: {veinOpacity}">
        <svg viewBox="0 0 200 60" preserveAspectRatio="none">
          <path d={path1} stroke={waveColor} stroke-width="0.8" fill="none" opacity="0.7"/>
          <path d={path2} stroke={waveColor} stroke-width="0.7" fill="none" opacity="0.5"/>
          <path d={path3} stroke={waveColor} stroke-width="0.75" fill="none" opacity="0.6"/>
          <path d={path4} stroke={waveColor} stroke-width="0.5" fill="none" opacity="0.4"/>
          <path d={path5} stroke={waveColor} stroke-width="0.45" fill="none" opacity="0.45"/>
          <path d={path6} stroke={waveColor} stroke-width="0.4" fill="none" opacity="0.35"/>
        </svg>
      </div>

      <!-- Ripple canvas overlay -->
      <canvas
        class="host-strip__ripple-canvas"
        bind:this={rippleCanvas}
        width="736"
        height="120"
        aria-hidden="true"
      ></canvas>

      {#if glitchOpacity > 0}
        <div class="host-strip__glitch" style="opacity: {glitchOpacity}">
          <div class="glitch-r"></div>
          <div class="glitch-g"></div>
          <div class="glitch-b"></div>
        </div>
      {/if}

      {#if hitting}
        <div class="host-strip__shatter" aria-hidden="true"></div>
      {/if}
    {/if}

    {#if visibleToast}
      <div class="manifestation-toast" role="status" aria-live="polite">
        {visibleToast}
      </div>
    {/if}
  </div>
</div>

<style>
  .host-strip__svg-defs {
    position: absolute;
    width: 0;
    height: 0;
    overflow: hidden;
  }

  .host-strip-container {
    position: relative;
    width: min(46rem, 100%);
    margin: 0 auto;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
  }

  .host-strip-container:focus-visible {
    outline: 2px solid rgba(255, 255, 255, 0.9);
    outline-offset: 2px;
  }

  .host-strip-container--disabled {
    cursor: not-allowed;
  }

  .host-strip-container--dead {
    cursor: default;
    pointer-events: none;
  }

  .host-strip {
    position: relative;
    width: 100%;
    height: 120px;
    overflow: hidden;
    transition: filter 0.5s ease, transform 80ms ease, border-color 0.5s ease, box-shadow 0.5s ease, background 0.5s ease;
    background: linear-gradient(90deg, #0d0d0d 0%, #1a1a1a 50%, #0d0d0d 100%);
    border: 1px solid #2a2a2a;
    border-bottom: none;
    image-rendering: auto;
  }

  .host-strip--dead {
    background: #080808 !important;
    border-color: #1a1a1a !important;
    filter: grayscale(1) !important;
    box-shadow: none !important;
    animation: none !important;
  }

  .host-strip--dead .host-strip__label {
    color: #555;
    letter-spacing: 0.35em;
  }

  .host-strip--hit {
    animation: pixelHit 1s ease forwards;
    border-color: rgba(220, 160, 0, 0.8);
    box-shadow: 0 0 14px rgba(220, 160, 0, 0.4), inset 0 0 24px rgba(220, 160, 0, 0.08);
  }

  @keyframes pixelHit {
    0% {
      transform: translateY(0);
      filter: brightness(1);
      image-rendering: auto;
    }
    2% {
      transform: translateY(2px);
      filter: brightness(1.8) contrast(1.4) sepia(0.6) hue-rotate(10deg) saturate(2.5);
      image-rendering: pixelated;
    }
    8% {
      transform: translateY(2px);
      filter: brightness(1.2) contrast(1.3) sepia(0.5) hue-rotate(15deg) saturate(2);
      image-rendering: pixelated;
    }
    15% {
      transform: translateY(0);
      filter: brightness(1.1) sepia(0.2) hue-rotate(10deg) saturate(1.4);
      image-rendering: auto;
    }
    30% {
      transform: translateY(0);
      filter: brightness(1.05) sepia(0.05) saturate(1.1);
    }
    50% {
      transform: translateY(0);
      filter: brightness(1);
    }
    100% {
      transform: translateY(0);
      filter: brightness(1);
    }
  }

  .host-strip__shatter {
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
    background:
      repeating-linear-gradient(
        0deg,
        transparent,
        transparent 6px,
        rgba(220, 160, 0, 0.2) 6px,
        rgba(220, 160, 0, 0.2) 8px
      ),
      repeating-linear-gradient(
        90deg,
        transparent,
        transparent 8px,
        rgba(180, 120, 0, 0.12) 8px,
        rgba(180, 120, 0, 0.12) 10px
      ),
      radial-gradient(
        ellipse at 50% 50%,
        rgba(220, 160, 0, 0.25) 0%,
        rgba(140, 90, 0, 0.15) 40%,
        transparent 70%
      );
    animation: shatterFade 400ms steps(4) forwards;
  }

  @keyframes shatterFade {
    0% {
      opacity: 1;
      transform: scaleY(1.02);
      box-shadow: inset 0 0 30px rgba(220, 160, 0, 0.3);
    }
    30% {
      opacity: 0.8;
      transform: scaleY(1);
      box-shadow: inset 0 0 20px rgba(220, 160, 0, 0.15);
    }
    60% {
      opacity: 0.3;
      transform: scaleY(1);
      box-shadow: inset 0 0 10px rgba(220, 160, 0, 0.05);
    }
    100% {
      opacity: 0;
      transform: scaleY(1);
      box-shadow: inset 0 0 0 transparent;
    }
  }

  .host-strip--attention {
    animation: attentionPulse 2s ease-in-out infinite;
  }

  @keyframes attentionPulse {
    0%, 100% {
      box-shadow: 0 0 0px rgba(220, 160, 0, 0);
    }
    50% {
      box-shadow: 0 0 18px rgba(220, 160, 0, 0.55), inset 0 0 12px rgba(220, 160, 0, 0.1);
    }
  }

  .host-strip__base {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    z-index: 1;
  }

  .host-strip__hint {
    font-family: monospace;
    font-size: 0.6rem;
    letter-spacing: 0.3em;
    color: rgba(220, 170, 50, 0.6);
    text-transform: uppercase;
    animation: hintBlink 1.8s step-end infinite;
  }

  @keyframes hintBlink {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 0.2; }
  }

  .host-strip__label {
    font-family: monospace;
    font-size: 1rem;
    letter-spacing: 0.25em;
    color: #555;
    text-transform: uppercase;
  }

  .host-strip__flavor {
    font-family: monospace;
    font-size: 0.65rem;
    font-style: italic;
    color: #444;
    letter-spacing: 0.02em;
    text-align: center;
    max-width: 80%;
    opacity: 0;
    animation: flavorFadeIn 1s ease forwards;
  }

  @keyframes flavorFadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .host-strip__veins {
    position: absolute;
    inset: 0;
    pointer-events: none;
    transition: opacity 0.5s ease;
  }

  .host-strip__veins--flicker {
    animation: waveFlicker 150ms step-end infinite;
  }

  @keyframes waveFlicker {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.85; }
  }

  .host-strip__veins svg {
    width: 100%;
    height: 100%;
  }

  .host-strip__ripple-canvas {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 3;
  }

  .host-strip__glitch {
    position: absolute;
    inset: 0;
    pointer-events: none;
    mix-blend-mode: screen;
  }

  .glitch-r,
  .glitch-g,
  .glitch-b {
    position: absolute;
    inset: 0;
    animation: glitch 2s step-end infinite;
  }

  .glitch-r {
    background: rgba(255, 180, 0, 0.18);
    transform: translate(4px, -2px);
  }

  .glitch-g {
    background: rgba(200, 140, 0, 0.18);
    transform: translate(-4px, 2px);
    animation-delay: 0.7s;
  }

  .glitch-b {
    background: rgba(160, 100, 0, 0.18);
    transform: translate(2px, 3px);
    animation-delay: 1.3s;
  }

  @keyframes glitch {
    0%, 100% {
      opacity: 0;
    }
    4% {
      opacity: 1;
    }
    8% {
      opacity: 0;
    }
    52% {
      opacity: 0;
    }
    54% {
      opacity: 0.7;
    }
    58% {
      opacity: 0;
    }
  }

  .manifestation-toast {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #27ae60;
    font-style: italic;
    font-family: monospace;
    font-size: 0.75rem;
    letter-spacing: 0.04em;
    background: rgba(0, 0, 0, 0.7);
    animation: toastFade 0.4s ease;
    z-index: 4;
  }

  @keyframes toastFade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .host-strip-container:hover .host-strip {
    background-image: 
      linear-gradient(rgba(220, 160, 0, 0.15) 1px, transparent 1px),
      linear-gradient(90deg, rgba(220, 160, 0, 0.15) 1px, transparent 1px),
      linear-gradient(90deg, #0d0d0d 0%, #1a1a1a 50%, #0d0d0d 100%) !important;
    background-size: 8px 8px, 8px 8px, auto !important;
    background-position: 0 0, 0 0, 0 0 !important;
  }

  @media (max-width: 767px) {

  .host-strip {
      height: 80px;
    }

    .host-strip__label {
      font-size: 0.8rem;
    }

    .manifestation-toast {
      font-size: 0.65rem;
    }

    .host-strip__flavor {
      font-size: 0.55rem;
    }
  }
</style>