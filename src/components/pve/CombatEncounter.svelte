<script lang="ts">
  import TerminalButton from '../../lib/ui/TerminalButton.svelte'
  import TerminalPanel from '../../lib/ui/TerminalPanel.svelte'
  import TerminalProgressBar from '../../lib/ui/TerminalProgressBar.svelte'
  import { game } from '../../stores/gameStore'
  import { getEnemyById, getCountermeasureName } from '../../engine/pve/enemies'
  import { getCountermeasureEncounterMatchup } from '../../engine/pve/combat'
  import type { GameState } from '../../lib/game'

  export let state: GameState

  $: encounter = state.activeEnemyEncounter
  $: enemy = encounter ? getEnemyById(encounter.enemyId) : null
  $: combat = state.activeEnemyCombat
  $: result = state.lastEnemyCombatResult
  $: resolvedResult = canShowResult && !combat ? result : null
  $: matchup = enemy ? getCountermeasureEncounterMatchup(state, enemy) : 'neutral'
  $: canShowResult = result && (!encounter || result.enemyId !== encounter.enemyId)

  function formatSeconds(ms: number): string {
    return `${Math.max(1, Math.ceil(ms / 1000))}s`
  }

  function getMatchupLabel(): string {
    switch (matchup) {
      case 'advantage':
        return `COUNTERMEASURE ALIGNED :: ${getCountermeasureName(state.equippedCountermeasure!)}`
      case 'resisted':
        return `COUNTERMEASURE RESISTED :: ${getCountermeasureName(state.equippedCountermeasure!)}`
      default:
        return state.equippedCountermeasure ? `COUNTERMEASURE PRESENT :: ${getCountermeasureName(state.equippedCountermeasure)}` : 'NO COUNTERMEASURE ALIGNED'
    }
  }
</script>

{#if enemy && encounter}
  <div class="enemy-overlay">
    <div class="enemy-overlay__backdrop"></div>
    <div class="enemy-overlay__panel">
      <TerminalPanel title="ACTIVE ECOLOGICAL THREAT" tag="PVE" bleedHeader={true} className="enemy-encounter-panel">
        <div class="enemy-encounter">
          <p class="enemy-encounter__eyebrow">{enemy.name.toUpperCase()} :: {enemy.epithet.toUpperCase()}</p>
          <h2>{enemy.description}</h2>
          <p>{enemy.ecology}</p>
          <p>{enemy.counterplay}</p>

          <div class="enemy-encounter__stats">
            <div>
              <span>DETECTED POWER</span>
              <strong>{encounter.detectedPower.toFixed(1)}</strong>
            </div>
            <div>
              <span>BEHAVIOR</span>
              <strong>{enemy.behavior.toUpperCase()}</strong>
            </div>
            <div>
              <span>MATCHUP</span>
              <strong class={`enemy-encounter__matchup enemy-encounter__matchup--${matchup}`}>{getMatchupLabel()}</strong>
            </div>
          </div>

          {#if combat}
            <div class="enemy-combat-shell">
              <TerminalProgressBar value={combat.enemyHealth} max={combat.enemyMaxHealth} prefix={`ENEMY INTEGRITY :: ${combat.enemyHealth}/${combat.enemyMaxHealth}`} />
              <TerminalProgressBar value={combat.playerIntegrity} max={combat.playerMaxIntegrity} prefix={`COLONY INTEGRITY :: ${combat.playerIntegrity}/${combat.playerMaxIntegrity}`} />

              <div class="enemy-encounter__meta-grid">
                <span>PLAYER STRIKE :: {combat.playerAttack.toFixed(1)}</span>
                <span>ENEMY STRIKE :: {combat.enemyAttack.toFixed(1)}</span>
                <span>INCOMING IN :: {formatSeconds(combat.enemyAttackCooldownMs)}</span>
              </div>

              <div class="enemy-combat-log">
                {#each combat.eventLog.slice().reverse() as line}
                  <p>{line}</p>
                {/each}
              </div>

              <div class="enemy-encounter__actions">
                <TerminalButton
                  on:click={() => game.attackEnemy()}
                  progress={combat.attackWindupRemainingMs > 0 ? 100 - (combat.attackWindupRemainingMs / combat.attackWindupMs) * 100 : 100}
                  disabled={combat.attackWindupRemainingMs > 0}
                >
                  [ STRIKE ]
                </TerminalButton>
              </div>
            </div>
          {:else}
            <div class="enemy-encounter__actions">
              <TerminalButton on:click={() => game.engageEnemy()}>[ ENGAGE THREAT ]</TerminalButton>
              <TerminalButton variant="secondary" on:click={() => game.dismissEnemyNotification()}>[ SILENCE ALERT ]</TerminalButton>
            </div>
          {/if}
        </div>
      </TerminalPanel>
    </div>
  </div>
{:else if resolvedResult}
  <div class="enemy-result-card">
    <TerminalPanel title="LAST ENCOUNTER" tag="PVE" variant="low" className="enemy-result-panel">
      <div class="enemy-result">
        <p class={`enemy-result__outcome enemy-result__outcome--${resolvedResult.outcome}`}>{resolvedResult.outcome.toUpperCase()}</p>
        <strong>{resolvedResult.enemyName.toUpperCase()}</strong>
        <p>{resolvedResult.flavorMessage}</p>
        <div class="enemy-result__meta">
          <span>POWER {resolvedResult.playerPower.toFixed(1)} :: {resolvedResult.enemyPower.toFixed(1)}</span>
          {#if resolvedResult.biomassReward > 0}
            <span>+{Math.round(resolvedResult.biomassReward)} BIOMASS</span>
          {/if}
          {#if resolvedResult.signalReward > 0}
            <span>+{resolvedResult.signalReward.toFixed(1)} SIGNAL</span>
          {/if}
        </div>
      </div>
    </TerminalPanel>
  </div>
{/if}
