<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import TerminalButton from '../lib/ui/TerminalButton.svelte'
  import TerminalPanel from '../lib/ui/TerminalPanel.svelte'
  import type { GameState } from '../lib/game'
  import { BALANCE } from '../engine/balance.config'

  export let state: GameState

  const dispatch = createEventDispatcher<{
    startGrind: void
    triggerGrind: void
    scanDefense: void
    setPreemptive: void
  }>()

  $: enzymeReserves = state.enzymeReserves
  $: enzymeCap = state.currentStage >= 4 ? Math.min(100, 50 + state.currentStage * 10) : 100
  $: enzymePercent = Math.min(100, (enzymeReserves / enzymeCap) * 100)

  $: grindSession = state.activeGrindSession
  $: isGrindActive = grindSession !== null
  $: eventCount = grindSession?.eventCount ?? 0
  $: runEventCount = state.runGrindEventCount
  $: sessionWindowSeconds = BALANCE.GRIND_EVENTS.timerSeconds
  $: sessionElapsedMs = grindSession ? Date.now() - grindSession.windowStartTime : 0
  $: sessionElapsedSeconds = Math.floor(sessionElapsedMs / 1000)
  $: sessionRemainingSeconds = Math.max(0, sessionWindowSeconds - sessionElapsedSeconds)
  $: sessionPercent = Math.min(100, (sessionElapsedMs / (sessionWindowSeconds * 1000)) * 100)

  $: currentFailRate = runEventCount * BALANCE.GRIND_EVENTS.failRateEscalation.increasePerEvent + BALANCE.GRIND_EVENTS.baseFailRate
  $: failRatePercent = Math.round(Math.min(BALANCE.GRIND_EVENTS.failRateEscalation.maxFailRate, currentFailRate) * 100)

  $: baseFailRatePercent = Math.round(BALANCE.GRIND_EVENTS.baseFailRate * 100)
  $: escalationPercent = Math.round(BALANCE.GRIND_EVENTS.failRateEscalation.increasePerEvent * 100)

  $: diminishingMultiplier = BALANCE.GRIND_EVENTS.diminishingReturns.enabled
    ? Math.max(BALANCE.GRIND_EVENTS.diminishingReturns.minRewardMultiplier, 1 - (runEventCount * BALANCE.GRIND_EVENTS.diminishingReturns.reductionPerEvent))
    : 1
  $: enzymeRewardDisplay = Math.floor(BALANCE.GRIND_EVENTS.enzymeRewardBase * diminishingMultiplier)

  $: tier2Unlocked = state.currentStage >= 10
  $: tier2ScanActive = state.tier2ScanActive
  $: tier2ScannedEventId = state.tier2ScannedEventId
  $: tier2PreemptiveSet = state.tier2PreemptiveSet
  $: tier2ScanCost = BALANCE.PROACTIVE_COUNTERMEASURES.signalCost
  $: tier2PreemptiveBonus = Math.round(BALANCE.PROACTIVE_COUNTERMEASURES.preemptiveSuccessRateBonus * 100)
  $: canAffordScan = state.signal >= tier2ScanCost
  $: canAffordPreemptive = state.signal >= tier2ScanCost

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${String(secs).padStart(2, '0')}`
  }

  function handleStartGrind() {
    dispatch('startGrind')
  }

  function handleTriggerGrind() {
    dispatch('triggerGrind')
  }

  function handleScanDefense() {
    dispatch('scanDefense')
  }

  function handleSetPreemptive() {
    dispatch('setPreemptive')
  }
</script>

{#if state.currentStage >= 4}
  <TerminalPanel
    title="ENZYME GRIND"
    tag="GRIND"
    variant="low"
    className="grind-panel"
  >
    <div class="grind-panel__section">
      <div class="grind-panel__label">ENZYME RESERVES</div>
      <div class="grind-panel__value-row">
        <span class="grind-panel__value">{enzymeReserves.toFixed(1)}</span>
        <span class="grind-panel__value-sep"> / </span>
        <span class="grind-panel__value-max">{enzymeCap}</span>
      </div>
      <div class="grind-panel__bar">
        <div class="grind-panel__bar-fill" style="width: {enzymePercent}%"></div>
      </div>
    </div>

    <div class="grind-panel__divider"></div>

    {#if isGrindActive}
      <div class="grind-panel__section">
        <div class="grind-panel__label">SESSION WINDOW</div>
        <div class="grind-panel__session-row">
          <span class="grind-panel__time">{formatTime(sessionRemainingSeconds)}</span>
          <span class="grind-panel__time-label">remaining</span>
        </div>
        <div class="grind-panel__bar grind-panel__bar--session">
          <div class="grind-panel__bar-fill grind-panel__bar-fill--session" style="width: {sessionPercent}%"></div>
        </div>
      </div>

      <div class="grind-panel__section">
        <div class="grind-panel__label">SUPPRESSION ATTEMPTS</div>
        <div class="grind-panel__value-row">
          <span class="grind-panel__value grind-panel__value--highlight">{eventCount}</span>
          <span class="grind-panel__value-sep"> events this session</span>
        </div>
      </div>

      <div class="grind-panel__section">
        <div class="grind-panel__label">CURRENT FAIL RATE</div>
        <div class="grind-panel__fail-rate">
          <span class="grind-panel__fail-rate-value">{failRatePercent}%</span>
          <span class="grind-panel__fail-rate-breakdown">
            ({baseFailRatePercent}% + {eventCount} × {escalationPercent}%)
          </span>
        </div>
      </div>

      <div class="grind-panel__actions">
        <TerminalButton variant="primary" on:click={handleTriggerGrind}>
          SUPPRESS
        </TerminalButton>
      </div>
    {:else}
      <div class="grind-panel__section">
        <div class="grind-panel__inactive-message">
          No active grind session.<br />
          Initiate to earn Enzyme Reserves.
        </div>
      </div>

      <div class="grind-panel__actions">
        <TerminalButton variant="primary" on:click={handleStartGrind}>
          INITIATE GRIND
        </TerminalButton>
      </div>
    {/if}

    {#if tier2Unlocked}
      <div class="grind-panel__divider"></div>

      <div class="grind-panel__section">
        <div class="grind-panel__label">TIER 2 SCAN</div>
        {#if tier2ScanActive}
          <div class="grind-panel__tier2-status">
            <span class="grind-panel__tier2-scanned">
              Scanned: {tier2ScannedEventId ?? 'Unknown'}
            </span>
            {#if tier2PreemptiveSet}
              <span class="grind-panel__tier2-active">PREEMPTIVE SET</span>
            {/if}
          </div>
          {#if tier2PreemptiveSet}
            <div class="grind-panel__tier2-bonus">
              +{tier2PreemptiveBonus}% success vs scanned threat
            </div>
          {/if}
        {:else}
          <div class="grind-panel__inactive-message">
            Scan next defense event for preemptive bonus.
          </div>
          <div class="grind-panel__actions">
            <TerminalButton 
              variant="secondary" 
              disabled={!canAffordScan}
              on:click={handleScanDefense}
            >
              SCAN [{tier2ScanCost} SIGNAL]
            </TerminalButton>
          </div>
        {/if}
      </div>

      {#if tier2ScanActive && !tier2PreemptiveSet}
        <div class="grind-panel__actions">
          <TerminalButton 
            variant="primary" 
            disabled={!canAffordPreemptive}
            on:click={handleSetPreemptive}
          >
            SET PREEMPTIVE [{tier2ScanCost} SIGNAL]
          </TerminalButton>
        </div>
      {/if}
    {/if}

    <div class="grind-panel__divider"></div>

    <div class="grind-panel__info">
      <div class="grind-panel__info-row">
        <span class="grind-panel__info-label">Enzyme reward:</span>
        <span class="grind-panel__info-value">+{enzymeRewardDisplay}</span>
      </div>
      <div class="grind-panel__info-row">
        <span class="grind-panel__info-label">Base fail rate:</span>
        <span class="grind-panel__info-value">{baseFailRatePercent}%</span>
      </div>
      <div class="grind-panel__info-row">
        <span class="grind-panel__info-label">Escalation:</span>
        <span class="grind-panel__info-value">+{escalationPercent}% per event</span>
      </div>
    </div>
  </TerminalPanel>
{/if}

<style>
  .grind-panel__section {
    margin-bottom: 0.75rem;
  }

  .grind-panel__label {
    font-size: 10px;
    letter-spacing: 0.12em;
    color: var(--text-secondary);
    margin-bottom: 0.25rem;
  }

  .grind-panel__value-row {
    display: flex;
    align-items: baseline;
    gap: 2px;
  }

  .grind-panel__value {
    font-size: 1.25rem;
    font-weight: 500;
    color: var(--text-primary);
  }

  .grind-panel__value--highlight {
    color: var(--accent-primary);
  }

  .grind-panel__value-sep,
  .grind-panel__value-max {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .grind-panel__bar {
    height: 4px;
    background: rgba(255, 255, 255, 0.08);
    margin-top: 0.375rem;
    position: relative;
  }

  .grind-panel__bar-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));
    transition: width 0.3s ease;
  }

  .grind-panel__bar--session {
    margin-top: 0.5rem;
  }

  .grind-panel__bar-fill--session {
    background: linear-gradient(90deg, rgba(255, 200, 0, 0.7), rgba(255, 100, 0, 0.7));
  }

  .grind-panel__divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.06);
    margin: 0.875rem 0;
  }

  .grind-panel__session-row {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }

  .grind-panel__time {
    font-size: 1.5rem;
    font-weight: 500;
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;
  }

  .grind-panel__time-label {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .grind-panel__fail-rate {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .grind-panel__fail-rate-value {
    font-size: 1.25rem;
    font-weight: 500;
    color: #e85d5d;
  }

  .grind-panel__fail-rate-breakdown {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .grind-panel__inactive-message {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    line-height: 1.5;
    text-align: center;
    padding: 0.5rem 0;
  }

  .grind-panel__actions {
    display: flex;
    justify-content: center;
    margin-top: 1rem;
  }

  .grind-panel__info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .grind-panel__info-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.6875rem;
    color: var(--text-secondary);
  }

  .grind-panel__info-value {
    color: var(--text-primary);
  }

  .grind-panel__tier2-status {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-bottom: 0.5rem;
  }

  .grind-panel__tier2-scanned {
    font-size: 0.8125rem;
    color: var(--text-primary);
  }

  .grind-panel__tier2-active {
    font-size: 0.6875rem;
    color: var(--accent-primary);
    letter-spacing: 0.1em;
  }

  .grind-panel__tier2-bonus {
    font-size: 0.75rem;
    color: #4ade80;
    margin-top: 0.25rem;
  }
</style>
