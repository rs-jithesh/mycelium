<script lang="ts">
  import { BALANCE } from '../engine/balance.config'
  import { SEVERITY_COLORS } from '../lib/game'
  import type { GameState } from '../lib/game'
  import { defenseToasts, dismissDefenseToast, type DefenseToastEntry } from '../stores/gameStore'

  export let state: GameState

  const TOAST_DURATION_MS = 10000
  const FORECAST_DURATION_MS = 8000

  function startDrainTimer(toastId: string, durationMs: number) {
    const el = document.getElementById(`drain-fill-${toastId}`)
    if (!el) return
    const start = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - start
      const pct = Math.max(0, 100 - (elapsed / durationMs * 100))
      el.style.width = pct + '%'
      if (elapsed >= durationMs) {
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
        const duration = toast.type === 'forecast' ? FORECAST_DURATION_MS : TOAST_DURATION_MS
        setTimeout(() => startDrainTimer(toast.id, duration), 0)
      }
    }
  }

  function getBadgeLabel(type: DefenseToastEntry['type'], severity: string): string {
    if (type === 'expire') return 'EXPIRED'
    if (type === 'forecast') return 'INCOMING'
    return severity.toUpperCase()
  }
</script>

<div class="toast-container">
  {#each $defenseToasts as toast (toast.id)}
    {@const c = toast.type === 'forecast'
      ? { border: '#f59e0b', badgeBg: '#f59e0b', badgeText: '#000', badgeBorder: '#d97706', nameText: '#fbbf24', impactText: '#fbbf24' }
      : toast.type === 'expire'
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
          {getBadgeLabel(toast.type, toast.severity)}
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

<style>
  .toast-container {
    position: absolute;
    bottom: 20px;
    left: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 360px;
    z-index: 100;
    pointer-events: none;
  }

  .toast {
    background: #0c0f09;
    padding: 14px 18px 18px 18px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    position: relative;
    animation: slideIn 0.25s ease forwards;
  }

  @keyframes slideIn {
    from { opacity: 0; transform: translateX(-10px); }
    to   { opacity: 1; transform: translateX(0); }
  }

  .toast-header {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .toast-badge {
    font-family: 'Courier New', monospace;
    font-size: 11px;
    letter-spacing: 0.12em;
    padding: 3px 8px;
    border-radius: 3px;
    flex-shrink: 0;
  }

  .toast-name {
    font-family: 'Courier New', monospace;
    font-size: 14px;
    letter-spacing: 0.1em;
    font-weight: bold;
  }

  .toast-impact {
    font-family: 'Courier New', monospace;
    font-size: 13px;
    letter-spacing: 0.06em;
  }

  .toast-flavor {
    font-family: 'Courier New', monospace;
    font-size: 12px;
    letter-spacing: 0.03em;
    color: #5a7a42;
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

  @media (min-width: 768px) {
    .toast-container {
      bottom: 20px;
      left: 20px;
    }
  }

  @media (max-width: 767px) {
    .toast-container {
      bottom: 16px;
      left: 16px;
      right: 16px;
      width: auto;
    }
  }
</style>