<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import { BALANCE } from '../engine/balance.config'
  import { countermeasureDefinitions, SEVERITY_COLORS } from '../lib/game'
  import type { ActiveDefenseEvent, DefenseEventId, GameState } from '../lib/game'
  import { defenseToasts, dismissDefenseToast, type DefenseToastEntry } from '../stores/gameStore'

  export let state: GameState

  const DISMISSED_ACTIVE_TOASTS_STORAGE_KEY = 'mycelium-dismissed-defense-toasts'

  let forecastDismissed = false
  let lastForecastKey = ''
  let missedRollToast: { key: string; eventName: string } | null = null
  let previousForecastEventId: DefenseEventId | null = null
  let previousNextDefenseCheckAt = 0
  let previousActiveEventKeys = ''
  let previousWasInWarningWindow = false
  let missedRollTimer: number | undefined
  let dismissedActiveToastKeys = new Set<string>()

  let swipeState: Record<string, { startX: number; currentX: number }> = {}
  const SWIPE_THRESHOLD = 100

  function handleTouchStart(e: TouchEvent, eventKey: string) {
    swipeState[eventKey] = { startX: e.touches[0].clientX, currentX: e.touches[0].clientX }
  }

  function handleTouchMove(e: TouchEvent, eventKey: string) {
    if (!swipeState[eventKey]) return
    swipeState[eventKey] = { ...swipeState[eventKey], currentX: e.touches[0].clientX }
  }

  function handleTouchEnd(eventKey: string, event?: ActiveDefenseEvent) {
    if (!swipeState[eventKey]) return
    const { startX, currentX } = swipeState[eventKey]
    if (currentX - startX > SWIPE_THRESHOLD) {
      if (event) {
        dismissActiveToast(event)
      } else {
        forecastDismissed = true
      }
    }
    delete swipeState[eventKey]
  }

  function getSwipeTransform(eventKey: string): string {
    const state = swipeState[eventKey]
    if (!state) return 'translateX(0)'
    const offset = Math.max(0, state.currentX - state.startX)
    return `translateX(${offset}px)`
  }

  function getSwipeOpacity(eventKey: string): number {
    const state = swipeState[eventKey]
    if (!state) return 1
    const offset = state.currentX - state.startX
    if (offset <= 0) return 1
    return Math.max(0, 1 - offset / 300)
  }

  const eventDisplayNames: Partial<Record<DefenseEventId, string>> = {
    drought: 'Drought',
    'beetle-disruption': 'Beetle Disruption',
    'cold-snap': 'Cold Snap',
    'spore-competition': 'Spore Competition',
    'immune-response': 'Immune Response',
  }

  function formatFallbackName(eventId: string): string {
    return eventId
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  }

  function getRemainingSeconds(event: ActiveDefenseEvent): number {
    return Math.max(0, Math.ceil((event.endsAt - Date.now()) / 1000))
  }

  function formatCountdown(seconds: number): string {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60

    return minutes > 0
      ? `${minutes}m ${String(remainingSeconds).padStart(2, '0')}s remaining`
      : `${remainingSeconds}s remaining`
  }

  function getPenaltyLabel(event: ActiveDefenseEvent): string {
    const lines: string[] = []

    if (event.multiplier.lt(1)) {
      const pct = Math.round((1 - event.multiplier.toNumber()) * 100)
      lines.push(`- ${pct}% passive production`)
    }

    if (event.clickMultiplier && event.clickMultiplier.lt(1)) {
      const pct = Math.round((1 - event.clickMultiplier.toNumber()) * 100)
      lines.push(`- ${pct}% click absorption`)
    }

    if (event.disabledGeneratorId) {
      lines.push(`- ${event.disabledGeneratorId} severed`)
    }

    return lines.join('\n')
  }

  function showClickHint(event: ActiveDefenseEvent): boolean {
    return event.multiplier.lt(1)
  }

  function getActiveEventKey(event: ActiveDefenseEvent): string {
    return `${event.id}:${event.endsAt}`
  }

  function persistDismissedActiveToastKeys() {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(
      DISMISSED_ACTIVE_TOASTS_STORAGE_KEY,
      JSON.stringify(Array.from(dismissedActiveToastKeys))
    )
  }

  function dismissActiveToast(event: ActiveDefenseEvent) {
    dismissedActiveToastKeys = new Set([...dismissedActiveToastKeys, getActiveEventKey(event)])
    persistDismissedActiveToastKeys()
  }

  function clearMissedRollToastTimer() {
    if (missedRollTimer) {
      window.clearTimeout(missedRollTimer)
      missedRollTimer = undefined
    }
  }

  function showMissedRollToast(eventName: string, key: string) {
    clearMissedRollToastTimer()
    missedRollToast = { key, eventName }
    missedRollTimer = window.setTimeout(() => {
      missedRollToast = null
      missedRollTimer = undefined
    }, 4500)
  }

  const TOAST_DURATION_MS = 5000

  function startDrainTimer(toastId: string) {
    const el = document.getElementById(`drain-fill-${toastId}`)
    if (!el) return
    const start = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - start
      const pct = Math.max(0, 100 - (elapsed / TOAST_DURATION_MS * 100))
      el.style.width = pct + '%'
      if (elapsed >= TOAST_DURATION_MS) {
        clearInterval(interval)
        dismissDefenseToast(toastId)
      }
    }, 50)
  }

  let seenToastIds = new Set<string>()
  $: {
    for (const toast of $defenseToasts) {
      if (!seenToastIds.has(toast.id)) {
        seenToastIds.add(toast.id)
        setTimeout(() => startDrainTimer(toast.id), 0)
      }
    }
  }

  $: activeEvents = state.activeDefenseEvents
  $: visibleActiveEvents = activeEvents.filter((event) => !dismissedActiveToastKeys.has(getActiveEventKey(event)))
  $: activeEventKeys = activeEvents.map((event) => `${event.id}:${event.endsAt}`).join('|')
  $: timeUntilCheck = state.nextDefenseCheckAt - Date.now()
  $: forecastSeconds = Math.max(0, Math.ceil(timeUntilCheck / 1000))
  $: forecastName = state.nextDefenseEventId
    ? eventDisplayNames[state.nextDefenseEventId] ?? formatFallbackName(state.nextDefenseEventId)
    : ''
  $: mitigatingCountermeasure = state.nextDefenseEventId
    ? countermeasureDefinitions.find((countermeasure) => countermeasure.targetEventIds.includes(state.nextDefenseEventId as DefenseEventId)) ?? null
    : null

  $: forecastKey = state.nextDefenseEventId
    ? `${state.nextDefenseEventId}:${state.nextDefenseCheckAt}`
    : ''

  $: if (forecastKey !== lastForecastKey) {
    forecastDismissed = false
    lastForecastKey = forecastKey
  }

  $: {
    const defenseCheckAdvanced = previousNextDefenseCheckAt > 0 && state.nextDefenseCheckAt > previousNextDefenseCheckAt
    const activeEventsUnchanged = previousActiveEventKeys === activeEventKeys

    if (defenseCheckAdvanced && activeEventsUnchanged && previousWasInWarningWindow && previousForecastEventId !== null) {
      const eventName = eventDisplayNames[previousForecastEventId] ?? formatFallbackName(previousForecastEventId)
      showMissedRollToast(eventName, `${previousForecastEventId}:${state.nextDefenseCheckAt}`)
    }

    previousForecastEventId = state.nextDefenseEventId
    previousNextDefenseCheckAt = state.nextDefenseCheckAt
    previousActiveEventKeys = activeEventKeys
    previousWasInWarningWindow = (
      state.currentStage >= BALANCE.DEFENSE_FORECAST_UNLOCK_STAGE &&
      state.nextDefenseEventId !== null &&
      timeUntilCheck > 0 &&
      timeUntilCheck <= BALANCE.DEFENSE_FORECAST_WARNING_MS
    )
  }

  $: forecastVisible = (
    !forecastDismissed &&
    state.currentStage >= BALANCE.DEFENSE_FORECAST_UNLOCK_STAGE &&
    state.nextDefenseEventId !== null &&
    timeUntilCheck > 0 &&
    timeUntilCheck <= BALANCE.DEFENSE_FORECAST_WARNING_MS
  )

  $: {
    const activeKeys = new Set(activeEvents.map((event) => getActiveEventKey(event)))
    const nextDismissedKeys = new Set(
      Array.from(dismissedActiveToastKeys).filter((key) => activeKeys.has(key))
    )

    if (nextDismissedKeys.size !== dismissedActiveToastKeys.size) {
      dismissedActiveToastKeys = nextDismissedKeys
      persistDismissedActiveToastKeys()
    }
  }

  onMount(() => {
    const raw = window.localStorage.getItem(DISMISSED_ACTIVE_TOASTS_STORAGE_KEY)
    if (!raw) {
      return
    }

    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        dismissedActiveToastKeys = new Set(parsed.filter((value): value is string => typeof value === 'string'))
      }
    } catch {
      dismissedActiveToastKeys = new Set()
    }
  })

  onDestroy(() => {
    clearMissedRollToastTimer()
  })
</script>

<div class="toast-container">
  {#each $defenseToasts as toast (toast.id)}
    {@const c = toast.type === 'expire'
      ? SEVERITY_COLORS['low']
      : SEVERITY_COLORS[toast.severity]}
    <div
      class="toast"
      style="border-left: 3px solid {c.border};"
    >
      <div class="toast-header">
        <span class="toast-badge" style="
          background: {c.badgeBg};
          color: {c.badgeText};
          border: 1px solid {c.badgeBorder};
        ">
          {toast.type === 'expire' ? 'EXPIRED' : toast.severity.toUpperCase()}
        </span>
        <span class="toast-name" style="color: {c.nameText};">
          {toast.eventName.toUpperCase()}
        </span>
      </div>
      <div class="toast-impact" style="color: {c.impactText};">
        {toast.impactLine}
      </div>
      {#if toast.flavorText}
        <div class="toast-flavor">{toast.flavorText}</div>
      {/if}
      <div class="toast-drain">
        <div
          id="drain-fill-{toast.id}"
          class="toast-drain-fill"
          style="width: 100%; background: {c.border};"
        ></div>
      </div>
    </div>
  {/each}
</div>

<div class="toast-region">
  {#if missedRollToast}
    <div class="toast toast--missed" role="status" aria-live="polite">
      <div class="toast-header">
        <span class="toast-tag toast-tag--missed">// THREAT PATTERN COLLAPSED</span>
      </div>
      <div class="toast-title">{missedRollToast.eventName}</div>
      <div class="toast-body">Host resistance did not materialize. The substrate remains unstable, but no active suppression has taken hold.</div>
    </div>
  {/if}

  {#if forecastVisible}
    <div
      class="toast toast--forecast"
      role="status"
      aria-live="polite"
      style="transform: {getSwipeTransform('forecast')}; opacity: {getSwipeOpacity('forecast')};"
      on:touchstart={(e) => handleTouchStart(e, 'forecast')}
      on:touchmove={(e) => handleTouchMove(e, 'forecast')}
      on:touchend={() => handleTouchEnd('forecast')}
    >
      <div class="toast-header">
        <span class="toast-tag toast-tag--forecast">// INCOMING SIGNAL</span>
        <div class="toast-header__actions">
          <span class="toast-timer">in ~{forecastSeconds}s</span>
          <button
            class="toast-dismiss"
            type="button"
            aria-label="Dismiss forecast"
            on:click={() => (forecastDismissed = true)}
          >
            X
          </button>
        </div>
      </div>
      <div class="toast-title">{forecastName}</div>
      {#if mitigatingCountermeasure}
        <div class="toast-body">{mitigatingCountermeasure.name} would mitigate this threat.</div>
      {:else}
        <div class="toast-body">No countermeasure targets this threat.</div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .toast-container {
    position: absolute;
    bottom: 20px;
    right: 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 360px;
    z-index: 100;
    pointer-events: none;
  }

  .toast {
    background: #0c0f09;
    padding: 10px 14px 14px 14px;
    display: flex;
    flex-direction: column;
    gap: 5px;
    position: relative;
    animation: slideIn 0.25s ease forwards;
  }

  @keyframes slideIn {
    from { opacity: 0; transform: translateX(10px); }
    to   { opacity: 1; transform: translateX(0); }
  }

  .toast-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .toast-badge {
    font-family: 'Courier New', monospace;
    font-size: 9px;
    letter-spacing: 0.12em;
    padding: 1px 6px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .toast-name {
    font-family: 'Courier New', monospace;
    font-size: 12px;
    letter-spacing: 0.1em;
  }

  .toast-impact {
    font-family: 'Courier New', monospace;
    font-size: 10px;
    letter-spacing: 0.06em;
  }

  .toast-flavor {
    font-family: 'Courier New', monospace;
    font-size: 10px;
    letter-spacing: 0.03em;
    color: #3a5228;
    line-height: 1.5;
    font-style: italic;
  }

  .toast-drain {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 2px;
    background: #1a2010;
  }

  .toast-drain-fill {
    height: 100%;
    transition: width 0.05s linear;
  }

  .toast-region {
    position: fixed;
    bottom: 5.5rem;
    left: 50%;
    transform: translateX(-50%);
    width: min(560px, calc(100vw - 2rem));
    display: flex;
    flex-direction: column;
    gap: 10px;
    z-index: 100;
    pointer-events: none;
  }

  .toast {
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-family: monospace;
    border-radius: 0;
    pointer-events: auto;
    touch-action: pan-y;
    user-select: none;
    will-change: transform, opacity;
  }

  .toast--forecast {
    border: 1px solid #2a7a4a;
    background: rgba(0, 10, 5, 0.92);
  }

  .toast--missed {
    border: 1px solid #8a6d1f;
    background: rgba(14, 10, 0, 0.92);
  }

  .toast-header,
  .toast-header__actions {
    display: flex;
    align-items: center;
  }

  .toast-header {
    justify-content: space-between;
    gap: 12px;
  }

  .toast-header__actions {
    gap: 10px;
  }

  .toast-tag {
    font-size: 11px;
    letter-spacing: 0.12em;
    font-weight: 500;
  }

  .toast-tag--forecast {
    color: #2a7a4a;
  }

  .toast-tag--missed {
    color: #b08b2d;
  }

  .toast-timer {
    font-size: 11px;
    color: #7a7a7a;
    font-family: monospace;
    white-space: nowrap;
  }

  .toast-title {
    font-size: 16px;
    color: #e8e8e8;
    font-weight: 500;
  }

  .toast-body {
    font-size: 12px;
    color: #9a9a9a;
    line-height: 1.6;
    white-space: pre-line;
  }

  .toast-dismiss {
    background: none;
    border: none;
    border-radius: 0;
    color: #444;
    font-family: monospace;
    font-size: 14px;
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }

  .toast-dismiss:hover {
    color: #888;
  }

  @media (min-width: 768px) {
    .toast-container {
      bottom: 20px;
      right: 20px;
    }
    .toast-region {
      bottom: 1rem;
    }
  }

  @media (max-width: 767px) {
    .toast-container {
      bottom: 16px;
      left: 16px;
      right: 16px;
      width: auto;
    }
    .toast-region {
      width: calc(100vw - 1rem);
      left: 0.5rem;
      transform: none;
    }
    .toast {
      padding: 12px 14px;
    }
  }
</style>
