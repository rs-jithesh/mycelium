<script lang="ts">
  import { BALANCE } from '../engine/balance.config'
  import { generatorDefinitions } from './game'
  import { game } from '../stores/gameStore'

  // Signal economy temporarily disabled.
  const signalActions = {
    coordinationCommand: (_sourceTier: number, _targetTier: number) => false,
    vulnerabilityWindow: () => false,
    rivalSuppression: () => false,
  }

  let selectedSource = ''
  let selectedTarget = ''

  $: signal = $game.signal
  $: cap = $game.signalCap
  $: sps = $game.signalPerSecond
  $: decaying = $game.signalDecaying
  $: overspent = $game.signalOverspent
  $: fillPercent = cap > 0 ? Math.min(100, (signal / cap) * 100) : 0
  $: decayZone = BALANCE.SIGNAL.DECAY_THRESHOLD * 100
  $: penaltyZone = BALANCE.SIGNAL.PENALTY_THRESHOLD * 100
  $: vulnActive = Boolean($game.activeVulnerabilityWindow)
  $: vulnRemaining = $game.activeVulnerabilityWindow?.remainingMs ?? 0
  $: suppressed = $game.rivalSuppressed
  $: suppRemaining = $game.rivalSuppressionRemainingMs
  $: coordLinks = $game.activeCoordinationLinks
  $: eligibleSourceTiers = generatorDefinitions.filter(
    (generator, index) => $game.visibility.generatorTiers[index] && $game.generators[generator.id].owned > 0
  )

  function handleCoordinationCommand() {
    if (selectedSource === '' || selectedTarget === '') return
    signalActions.coordinationCommand(Number(selectedSource), Number(selectedTarget))
    selectedSource = ''
    selectedTarget = ''
  }

  function formatMs(ms: number) {
    return `${Math.ceil(ms / 1000)}s`
  }
</script>

{#if $game.visibility.signalPanel}
  <div class="signal-panel reveal-enter">
    <div class="signal-header">
      <span class="signal-label">SIGNAL</span>
      <span class="signal-value">{signal.toFixed(1)} / {cap.toFixed(0)}</span>
      <span class="signal-rate" class:signal-rate--decaying={decaying} class:signal-rate--overspent={overspent}>
        {#if decaying}
          DECAYING
        {:else if overspent}
          OVESPENT :: BPS DEGRADED
        {:else}
          +{sps.toFixed(2)}/s
        {/if}
      </span>
    </div>

    <div class="signal-bar-track">
      <div class="signal-threshold-marker signal-threshold-penalty" style={`left: ${penaltyZone}%`} title="Below this: BPS penalty"></div>
      <div class="signal-threshold-marker signal-threshold-decay" style={`left: ${decayZone}%`} title="Above this: Signal decays"></div>
      <div
        class="signal-bar-fill"
        class:signal-bar--full={fillPercent >= decayZone}
        class:signal-bar--penalty={overspent}
        style={`width: ${fillPercent}%`}
      ></div>
    </div>

    {#if coordLinks.length > 0}
      <div class="signal-effects">
        {#each coordLinks as link}
          <div class="signal-effect-tag signal-effect--coord">
            T{link.sourceTier + 1}->T{link.targetTier + 1} x{link.boostMultiplier} ({formatMs(link.remainingMs)})
          </div>
        {/each}
      </div>
    {/if}

    {#if vulnActive}
      <div class="signal-effects">
        <div class="signal-effect-tag signal-effect--vuln">
          HOST VULNERABLE x{BALANCE.SIGNAL.VULNERABILITY_DAMAGE_MULT} ({formatMs(vulnRemaining)})
        </div>
      </div>
    {/if}

    {#if suppressed}
      <div class="signal-effects">
        <div class="signal-effect-tag signal-effect--supp">
          RIVALS SUPPRESSED ({formatMs(suppRemaining)})
        </div>
      </div>
    {/if}

    <div class="signal-actions">
      <div class="signal-action-block">
        <div class="signal-action-label">
          Coordination Command
          <span class="signal-cost">({BALANCE.SIGNAL.COST_COORDINATION_COMMAND} Signal)</span>
        </div>
        <div class="signal-action-desc">
          Link two owned generator tiers. Source boosts target x{BALANCE.SIGNAL.COORDINATION_BOOST_MULTIPLIER}
          for {BALANCE.SIGNAL.COORDINATION_DURATION_MS / 1000}s.
        </div>
        <div class="coordination-selectors">
          <select bind:value={selectedSource} class="signal-select">
            <option value="">Source tier...</option>
            {#each eligibleSourceTiers as generator, index (generator.id)}
              <option value={generator.tier - 1}>Tier {generator.tier}</option>
            {/each}
          </select>
          <span class="coord-arrow">-></span>
          <select bind:value={selectedTarget} class="signal-select">
            <option value="">Target tier...</option>
            {#each eligibleSourceTiers as generator (generator.id)}
              {#if String(generator.tier - 1) !== selectedSource}
                <option value={generator.tier - 1}>Tier {generator.tier}</option>
              {/if}
            {/each}
          </select>
          <button
            class="signal-btn"
            disabled={selectedSource === '' || selectedTarget === '' || signal < BALANCE.SIGNAL.COST_COORDINATION_COMMAND}
            on:click={handleCoordinationCommand}
          >
            Issue
          </button>
        </div>
      </div>

      <div class="signal-action-block">
        <div class="signal-action-label">
          Host Vulnerability Window
          <span class="signal-cost">({BALANCE.SIGNAL.COST_VULNERABILITY_WINDOW} Signal)</span>
        </div>
        <div class="signal-action-desc">
          Expose a weakness. Host damage is multiplied by x{BALANCE.SIGNAL.VULNERABILITY_DAMAGE_MULT}
          for {BALANCE.SIGNAL.VULNERABILITY_DURATION_MS / 1000}s.
        </div>
        <button
          class="signal-btn"
          disabled={vulnActive || signal < BALANCE.SIGNAL.COST_VULNERABILITY_WINDOW}
          on:click={() => signalActions.vulnerabilityWindow()}
        >
          {#if vulnActive}
            Active ({formatMs(vulnRemaining)})
          {:else}
            Initiate
          {/if}
        </button>
      </div>

      <div class="signal-action-block">
        <div class="signal-action-label">
          Rival Suppression
          <span class="signal-cost">({BALANCE.SIGNAL.COST_RIVAL_SUPPRESSION} Signal)</span>
        </div>
        <div class="signal-action-desc">
          Saturate the network perimeter for {BALANCE.SIGNAL.SUPPRESSION_COOLDOWN_OVERRIDE_MS / 60000} minutes.
        </div>
        <button
          class="signal-btn"
          disabled={suppressed || signal < BALANCE.SIGNAL.COST_RIVAL_SUPPRESSION}
          on:click={() => signalActions.rivalSuppression()}
        >
          {#if suppressed}
            Active ({formatMs(suppRemaining)})
          {:else}
            Activate
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .signal-panel {
    border: 1px solid var(--color-signal);
    padding: 0.9rem;
    background: rgba(9, 16, 28, 0.45);
    box-shadow: inset 0 0 0 1px rgba(74, 158, 255, 0.08);
    font-size: 0.82rem;
  }

  .signal-header {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 0.45rem;
  }

  .signal-label {
    color: var(--color-signal);
    font-weight: 700;
    letter-spacing: 0.18em;
  }

  .signal-value {
    color: var(--text-strong);
    font-size: 1rem;
  }

  .signal-rate {
    color: var(--primary-container);
    font-size: 0.74rem;
  }

  .signal-rate--decaying {
    color: #ffb347;
  }

  .signal-rate--overspent {
    color: #ff7a7a;
    animation: overspent-flicker 0.8s ease-in-out infinite;
  }

  .signal-bar-track {
    position: relative;
    height: 0.55rem;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--outline-ghost);
    margin-bottom: 0.65rem;
    overflow: hidden;
  }

  .signal-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, rgba(74, 158, 255, 0.72), var(--color-signal));
    transition: width 0.25s ease, background 0.25s ease;
  }

  .signal-bar--full {
    background: linear-gradient(90deg, rgba(255, 179, 71, 0.72), #ffb347);
  }

  .signal-bar--penalty {
    background: linear-gradient(90deg, rgba(255, 122, 122, 0.72), #ff7a7a);
  }

  .signal-threshold-marker {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    opacity: 0.7;
  }

  .signal-threshold-penalty {
    background: #ff7a7a;
  }

  .signal-threshold-decay {
    background: #ffb347;
  }

  .signal-effects {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-bottom: 0.45rem;
  }

  .signal-effect-tag {
    padding: 0.18rem 0.42rem;
    border: 1px solid currentColor;
    font-size: 0.72rem;
    letter-spacing: 0.04em;
  }

  .signal-effect--coord {
    color: var(--color-signal);
  }

  .signal-effect--vuln {
    color: var(--primary-container);
  }

  .signal-effect--supp {
    color: #ffb347;
  }

  .signal-actions {
    display: grid;
    gap: 0.75rem;
  }

  .signal-action-block {
    border-left: 2px solid rgba(74, 158, 255, 0.5);
    padding-left: 0.7rem;
  }

  .signal-action-label {
    color: var(--text-strong);
    font-weight: 700;
    margin-bottom: 0.18rem;
  }

  .signal-cost {
    color: var(--color-signal);
    font-weight: 400;
    margin-left: 0.35rem;
    font-size: 0.76rem;
  }

  .signal-action-desc {
    color: var(--muted);
    font-size: 0.75rem;
    margin-bottom: 0.35rem;
    line-height: 1.4;
  }

  .coordination-selectors {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.45rem;
  }

  .signal-select,
  .signal-btn {
    font: inherit;
    color: var(--text);
    background: rgba(10, 10, 16, 0.8);
    border: 1px solid var(--outline-ghost);
    padding: 0.35rem 0.5rem;
  }

  .signal-btn {
    border-color: var(--color-signal);
    cursor: pointer;
  }

  .signal-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    border-color: var(--outline-ghost);
  }

  .coord-arrow {
    color: var(--color-signal);
  }

  @keyframes overspent-flicker {
    0%,
    100% {
      opacity: 1;
    }

    50% {
      opacity: 0.45;
    }
  }
</style>
