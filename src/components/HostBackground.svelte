<script lang="ts">
  import { BALANCE } from '../engine/balance.config'
  import { hostConfigs } from '../lib/hostBackgrounds/hostConfigs'
  import {
    generateHyphae,
    generateFruitingBodies,
    generateCorruptionPaths,
  } from '../lib/hostBackgrounds/myceliumGenerator'

  export let hostId: string
  export let degradation: number = 0
  export let integrationProgress: number = 0
  export let glitching: boolean = false

  $: config = hostConfigs[hostId] ?? hostConfigs.fallen_leaf
  $: d = Math.min(1, Math.max(0, degradation))

  function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t < 0 ? 0 : a + (b - a) * t
  }

  function interpolateColor(hex1: string, hex2: string, t: number): string {
    const r1 = parseInt(hex1.slice(1, 3), 16)
    const g1 = parseInt(hex1.slice(3, 5), 16)
    const b1 = parseInt(hex1.slice(5, 7), 16)
    const r2 = parseInt(hex2.slice(1, 3), 16)
    const g2 = parseInt(hex2.slice(5, 7), 16)
    const b2 = parseInt(hex2.slice(5, 7), 16)
    const clampedT = Math.min(1, Math.max(0, t))
    const r = Math.round(lerp(r1, r2, clampedT))
      .toString(16)
      .padStart(2, '0')
    const g = Math.round(lerp(g1, g2, clampedT))
      .toString(16)
      .padStart(2, '0')
    const b = Math.round(lerp(b1, b2, clampedT))
      .toString(16)
      .padStart(2, '0')
    return `#${r}${g}${b}`
  }

  $: bgColor = interpolateColor(config.palette.intact, config.palette.consumed, d)
  $: vignetteOpacity = d * 0.75
  $: hostLayerOpacity = Math.max(0, 1 - d * 1.4)
  $: mycLayerOpacity = Math.min(1, d * 1.8)
  $: hyphaeWidth = lerp(0.5, config.mycelium.maxStrokeWidth, d)
  $: fruitingScale = lerp(1, config.mycelium.fruitingScale, d)
  $: corruptionWidth = Math.max(0, (d - 0.25) * config.mycelium.corruptionRate * 10)
  $: ghostOpacity = Math.max(0, (d - 0.65) * 1.7)
  $: shimmerDuration = lerp(config.animation.shimmerSpeed, config.animation.shimmerSpeed * 3, d)
  $: topoLayerOpacity = lerp(config.topoOpacity, config.topoOpacity * 0.3, d)

  $: stage =
    d < 0.25 ? 0 : d < 0.5 ? 1 : d < 0.75 ? 2 : 3

  $: elementColorShift = d > 0.3 ? interpolateColor(config.palette.elementColor, '#3a4a28', (d - 0.3) / 0.7) : config.palette.elementColor

  $: hyphaeColor = interpolateColor(config.mycelium.hyphaeColor, '#2a1800', d)
  $: fruitingColor = interpolateColor(config.mycelium.fruitingColor, '#1a0800', d)

  $: hyphaeBranches = generateHyphae(
    config.topology.originX,
    config.topology.originY,
    config.mycelium.seedPoints,
    hyphaeWidth,
    6
  )

  $: fruitingBodies = generateFruitingBodies(
    config.mycelium.seedPoints,
    4 * fruitingScale
  )

  $: corruptionPaths = generateCorruptionPaths(
    config.topology.originX,
    config.topology.originY,
    config.topology.paths,
    corruptionWidth
  )

  $: integrationRingDash = (() => {
    const circumference = 2 * Math.PI * 160
    const filled = circumference * integrationProgress
    return `${filled} ${circumference - filled}`
  })()

  $: hostIsVisible = hostLayerOpacity > 0.05
  $: mycIsVisible = mycLayerOpacity > 0.05
</script>

<div class="host-bg" class:glitching>
  <svg
    viewBox="0 0 800 450"
    preserveAspectRatio="xMidYMid slice"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    style="
      --hyphae-color: {hyphaeColor};
      --hyphae-opacity: 0.7;
      --fruiting-color: {fruitingColor};
      --fruiting-opacity: 0.6;
    "
  >
    <defs>
      <radialGradient id="vignette-grad" cx="50%" cy="50%" r="60%">
        <stop offset="0%" stop-color="transparent" />
        <stop offset="100%" stop-color="#1a0500" />
      </radialGradient>
      <filter id="myc-blur">
        <feGaussianBlur stdDeviation="1.5" />
      </filter>
    </defs>

    <rect width="800" height="450" fill={bgColor} />

    {#if config.topoOpacity > 0}
      <g opacity={topoLayerOpacity}>
        {#each config.topology.paths.filter((p) => p.role === 'tertiary') as path}
          <path
            d={path.d}
            stroke={elementColorShift}
            stroke-width={path.strokeWidth * 0.5}
            fill="none"
            opacity="0.3"
          />
        {/each}
      </g>
    {/if}

    <g opacity={hostLayerOpacity}>
      {#if glitching && hostIsVisible}
        <g transform="translate(-3.5, 1.5)" opacity="0.7">
          {#each config.topology.paths as path}
            <path
              d={path.d}
              stroke="#ff2050"
              stroke-width={path.strokeWidth + 1}
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          {/each}
        </g>
        <g transform="translate(3.5, -1.5)" opacity="0.7">
          {#each config.topology.paths as path}
            <path
              d={path.d}
              stroke="#20ffc0"
              stroke-width={path.strokeWidth + 1}
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          {/each}
        </g>
      {/if}

      {#each config.topology.paths as path}
        <path
          d={path.d}
          stroke={elementColorShift}
          stroke-width={path.strokeWidth}
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      {/each}

      {#if hostId === 'biosphere'}
        <circle
          cx="400"
          cy="225"
          r="160"
          fill="none"
          stroke={elementColorShift}
          stroke-width="2.5"
          opacity="0.8"
          stroke-dasharray={integrationRingDash}
          transform="rotate(-90 400 225)"
        />
      {/if}
    </g>

    <g opacity={mycLayerOpacity} filter={mycIsVisible ? 'url(#myc-blur)' : ''}>
      {#each hyphaeBranches as branch}
        <path
          d={branch.d}
          stroke="var(--hyphae-color)"
          stroke-width={branch.strokeWidth}
          fill="none"
          opacity="var(--hyphae-opacity)"
        />
      {/each}

      {#each fruitingBodies as body}
        <circle
          cx={body.cx}
          cy={body.cy}
          r={body.r}
          fill="var(--fruiting-color)"
          opacity="var(--fruiting-opacity)"
        />
      {/each}

      {#each corruptionPaths as cp}
        <path
          d={cp.d}
          stroke="var(--hyphae-color)"
          stroke-width={cp.strokeWidth}
          fill="none"
          opacity={cp.opacity}
        />
      {/each}
    </g>

    {#if ghostOpacity > 0}
      <g opacity={ghostOpacity}>
        {#each config.topology.paths.filter((p) => p.role === 'primary') as path}
          <path
            d={path.d}
            stroke={config.palette.elementColor}
            stroke-width={path.strokeWidth * 0.6}
            fill="none"
            stroke-dasharray="8 4"
            opacity="0.4"
          />
        {/each}
      </g>
    {/if}

    <rect
      width="800"
      height="450"
      fill="url(#vignette-grad)"
      opacity={vignetteOpacity}
      pointer-events="none"
    />
  </svg>
</div>

<style>
  .host-bg {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    z-index: -1;
    backdrop-filter: blur(10px);
  }

  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    transition:
      --hyphae-color 150ms ease-in-out,
      --hyphae-opacity 150ms ease-in-out,
      --fruiting-color 150ms ease-in-out,
      --fruiting-opacity 150ms ease-in-out;
  }

  .glitching svg {
    --hyphae-color: #a0ff50;
    --hyphae-opacity: 0.9;
    --fruiting-color: #c0ff70;
    --fruiting-opacity: 0.85;
  }

  :global(.glitching svg) {
    --hyphae-color: #a0ff50;
    --hyphae-opacity: 0.9;
    --fruiting-color: #c0ff70;
    --fruiting-opacity: 0.85;
  }
</style>