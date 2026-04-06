<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte'

  export let corruption: number = 0
  export let manifestationQueue: string[] = []
  export let hostName: string = ''
  export let disabled: boolean = false
  export let progress: number = 0
  export let hostCompleted: boolean = false
  export let firstTime: boolean = false

  const dispatch = createEventDispatcher<{ click: void }>()

  // Dismiss the hint the moment the player clicks once
  let hintDismissed = false
  $: showHint = firstTime && !hintDismissed && !hostCompleted

  // CSS filter values driven by corruption percentage
  $: sepia = Math.min(100, corruption * 1.2)
  $: brightness = 100 + corruption * 0.15
  $: contrast = 100 + corruption * 0.4
  $: hueRotate = corruption * 0.35
  $: saturate = 100 + corruption * 0.8
  $: glitchOpacity = corruption > 75 ? (corruption - 75) / 50 : 0
  $: veinOpacity = Math.min(1, corruption / 100)
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

  // Hit animation state — cycles a key to force re-trigger on rapid clicks after cooldown
  let hitting = false
  let hitKey = 0
  let hitTimer: ReturnType<typeof setTimeout> | undefined

  function handleClick() {
    if (disabled || hostCompleted) return
    hintDismissed = true
    dispatch('click')
    hitting = false
    // Force DOM re-trigger by toggling off then on in next microtask
    hitKey += 1
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
      handleClick()
    }
  }

  // Manifestation toast visibility
  let visibleToast: string | null = null
  let activeQueueHead: string | null = null
  let toastTimer: ReturnType<typeof setTimeout> | undefined

  $: {
    const nextQueueHead = manifestationQueue[0] ?? null

    if (nextQueueHead && nextQueueHead !== activeQueueHead) {
      activeQueueHead = nextQueueHead
      visibleToast = nextQueueHead
      clearTimeout(toastTimer)
      toastTimer = setTimeout(() => {
        visibleToast = null
      }, 3000)
    }

    if (!nextQueueHead) {
      activeQueueHead = null
    }
  }

  onDestroy(() => {
    clearTimeout(toastTimer)
    clearTimeout(hitTimer)
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
      <span class="host-strip__label" style="opacity: {visibleToast && !hostCompleted ? 0 : 1}">
        {#if hostCompleted}
          {hostName.toUpperCase()} — CONSUMED
        {:else}
          ABSORB
        {/if}
      </span>
      {#if showHint && !visibleToast}
        <span class="host-strip__hint" aria-hidden="true">click to absorb</span>
      {/if}
    </div>

    {#if !hostCompleted}
      <div class="host-strip__veins" style="opacity: {veinOpacity}">
        <svg class="host-strip__infection-svg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
          <defs>
            <pattern id="infectionTile" x="0" y="0" width="64" height="64" patternUnits="userSpaceOnUse">
              <rect width="64" height="64" fill="#3d2a1a"/>
              <rect x="0" y="0" width="8" height="8" fill="#241a0f"/>
              <rect x="32" y="16" width="6" height="6" fill="#241a0f"/>
              <rect x="48" y="40" width="10" height="8" fill="#241a0f"/>
              <rect x="16" y="52" width="8" height="8" fill="#241a0f"/>
              <rect x="8" y="28" width="5" height="5" fill="#241a0f"/>
              <rect x="56" y="8" width="6" height="6" fill="#241a0f"/>
              <rect x="20" y="8" width="4" height="4" fill="#e8a020"/>
              <rect x="40" y="32" width="5" height="4" fill="#d4921a"/>
              <rect x="4" y="44" width="4" height="5" fill="#e8a020"/>
              <rect x="52" y="52" width="4" height="4" fill="#d4921a"/>
              <rect x="28" y="36" width="3" height="3" fill="#f0b830"/>
              <rect x="12" y="56" width="3" height="3" fill="#e8a020"/>
              <rect x="44" y="20" width="4" height="3" fill="#d4921a"/>
              <rect x="12" y="12" width="4" height="4" fill="#c47a10"/>
              <rect x="44" y="8" width="3" height="5" fill="#b8700e"/>
              <rect x="28" y="48" width="5" height="3" fill="#c47a10"/>
              <rect x="2" y="58" width="4" height="4" fill="#b8700e"/>
              <rect x="58" y="28" width="4" height="4" fill="#c47a10"/>
              <rect x="24" y="20" width="3" height="3" fill="#f0b830"/>
              <rect x="50" y="18" width="3" height="3" fill="#e8a020"/>
              <rect x="8" y="38" width="2" height="3" fill="#f5c040"/>
              <rect x="36" y="54" width="3" height="2" fill="#e8a020"/>
              <rect x="60" y="44" width="2" height="2" fill="#f0b830"/>
              <rect x="10" y="22" width="2" height="1" fill="#8a5a0e"/>
              <rect x="12" y="23" width="1" height="2" fill="#8a5a0e"/>
              <rect x="30" y="28" width="4" height="1" fill="#9a6a12"/>
              <rect x="34" y="29" width="1" height="3" fill="#9a6a12"/>
              <rect x="46" y="36" width="1" height="4" fill="#8a5a0e"/>
              <rect x="42" y="38" width="4" height="1" fill="#8a5a0e"/>
              <rect x="18" y="42" width="3" height="1" fill="#9a6a12"/>
              <rect x="20" y="43" width="1" height="3" fill="#9a6a12"/>
              <rect x="54" y="48" width="2" height="1" fill="#8a5a0e"/>
              <rect x="14" y="4" width="1" height="1" fill="#f5c040"/>
              <rect x="38" y="12" width="1" height="1" fill="#ffd050"/>
              <rect x="2" y="18" width="1" height="1" fill="#f5c040"/>
              <rect x="62" y="34" width="1" height="1" fill="#ffd050"/>
              <rect x="26" y="56" width="1" height="1" fill="#f5c040"/>
              <rect x="34" y="4" width="1" height="1" fill="#ffd050"/>
              <rect x="48" y="24" width="1" height="1" fill="#f5c040"/>
              <rect x="6" y="48" width="1" height="1" fill="#ffd050"/>
              <rect x="32" y="40" width="2" height="2" fill="#6a4410"/>
              <rect x="16" y="16" width="2" height="2" fill="#6a4410"/>
              <rect x="56" y="56" width="2" height="2" fill="#6a4410"/>
              <rect x="0" y="32" width="3" height="2" fill="#d4921a"/>
              <rect x="60" y="12" width="3" height="3" fill="#e8a020"/>
              <rect x="36" y="0" width="2" height="3" fill="#f0b830"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#infectionTile)"/>
        </svg>
      </div>

      {#if glitchOpacity > 0}
        <div class="host-strip__glitch" style="opacity: {glitchOpacity}">
          <div class="glitch-r"></div>
          <div class="glitch-g"></div>
          <div class="glitch-b"></div>
        </div>
      {/if}

      <!-- Pixel shatter overlay -->
      {#if hitting}
        <div class="host-strip__shatter" aria-hidden="true"></div>
      {/if}
    {/if}

    {#if visibleToast}
      <div class="manifestation-toast" role="status" aria-live="polite">
        {visibleToast}
      </div>
    {/if}

    <!-- Cooldown progress bar at bottom edge -->
    {#if progress > 0 && !hostCompleted}
      <div class="host-strip__cooldown">
        <div class="host-strip__cooldown-fill" style="width: {progress}%"></div>
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

  /* Dead state — host fully consumed */
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

  /*
   * Pixel Shatter click animation
   * Phase 1 (0-150ms): press down + pixelate + brightness spike
   * Phase 2 (150-400ms): snap back crisp + green border glow
   * Phase 3 (400-1000ms): glow fades, fully settled
   */
  .host-strip--hit {
    animation: pixelHit 1s ease forwards;
    border-color: rgba(220, 160, 0, 0.8);
    box-shadow: 0 0 14px rgba(220, 160, 0, 0.4), inset 0 0 24px rgba(220, 160, 0, 0.08);
  }

  @keyframes pixelHit {
    /* Press down + pixelate burst — amber damage flash */
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
    /* Hold pixelated — deep amber */
    8% {
      transform: translateY(2px);
      filter: brightness(1.2) contrast(1.3) sepia(0.5) hue-rotate(15deg) saturate(2);
      image-rendering: pixelated;
    }
    /* Snap back — residual amber */
    15% {
      transform: translateY(0);
      filter: brightness(1.1) sepia(0.2) hue-rotate(10deg) saturate(1.4);
      image-rendering: auto;
    }
    /* Fade out */
    30% {
      transform: translateY(0);
      filter: brightness(1.05) sepia(0.05) saturate(1.1);
    }
    /* Settle */
    50% {
      transform: translateY(0);
      filter: brightness(1);
    }
    100% {
      transform: translateY(0);
      filter: brightness(1);
    }
  }

  /* Pixelation shatter overlay — blocky noise with amber tones */
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

  /* Cooldown progress bar — thin strip at the bottom */
  .host-strip__cooldown {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: rgba(0, 0, 0, 0.6);
    z-index: 3;
  }

  .host-strip__cooldown-fill {
    height: 100%;
    background: linear-gradient(90deg, rgba(255, 176, 0, 0.6), rgba(255, 176, 0, 0.9));
    box-shadow: 0 0 8px rgba(255, 176, 0, 0.4);
    transition: width 16ms linear;
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
    gap: 0.35rem;
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
    font-size: 1.25rem;
    letter-spacing: 0.25em;
    color: #fff;
    text-transform: uppercase;
    text-shadow: 0 0 8px rgba(0, 0, 0, 0.8), 0 0 16px rgba(0, 0, 0, 0.5);
  }

  .host-strip__veins {
    position: absolute;
    inset: 0;
    pointer-events: none;
    transition: opacity 0.5s ease;
  }

  .host-strip__veins svg {
    width: 100%;
    height: 100%;
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
    z-index: 1;
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
  }
</style>
